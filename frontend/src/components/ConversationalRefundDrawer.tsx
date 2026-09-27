import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CheckCircle2, Headset, Send, Star, WifiOff } from 'lucide-react';
import { Drawer } from './ui/Drawer';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { ErrorState } from './ui/ErrorState';
import { FormErrorBanner } from './ui/FormErrorBanner';
import { DecisionBadge, StatusBadge } from './DecisionBadge';
import { Avatar } from './ui/Avatar';
import { SoundToggle } from './SoundToggle';
import { useRefundSocket } from '../hooks/useRefundSocket';
import { useAuth } from '../contexts/AuthContext';
import * as refundsApi from '../api/refunds';
import {
  askAssistant,
  isAssistantConfigured,
  type AssistantScenario,
  type AssistantTurn,
} from '../api/gemini';
import { cn } from '../lib/cn';
import { formatDateTime } from '../lib/format';
import { chatSound } from '../lib/sound';
import type { Order, RefundMessage, RefundMessageAuthor, RefundReason, RefundRequest } from '../api/types';

interface ConversationalRefundDrawerProps {
  order: Order | null;
  requestId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userRole?: 'CUSTOMER' | 'ADMIN';
}

type WizardStep = 'GREETING' | 'SELECT_REASON' | 'CONDITIONAL_OPTION' | 'CUSTOM_DETAILS' | 'SUBMITTING' | 'THREAD';

type HandlingMode = 'AUTO' | 'HUMAN';

const AUTHOR_LABEL: Record<RefundMessageAuthor, string> = {
  CUSTOMER: 'Customer',
  AI: 'Refund Assistant',
  ADMIN: 'Support Agent',
  SYSTEM: 'System Notice',
};

const messageKey = (message: RefundMessage) => `${message.author}::${message.body}::${message.createdAt}`;

const REASON_CHIPS: { value: RefundReason; label: string }[] = [
  { value: 'DAMAGED', label: 'Arrived damaged' },
  { value: 'WRONG_ITEM', label: 'Wrong item sent' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'NOT_DELIVERED', label: 'Never arrived' },
  { value: 'CHANGED_MIND', label: 'Changed mind' },
];

const REASON_WITH_OPTIONS: RefundReason[] = ['DAMAGED', 'CHANGED_MIND'];

interface PendingAssistantMessage {
  message: RefundMessage;
  meta: refundsApi.AssistantMessageMeta;
}


function HandoffNotice() {
  return (
    <div className="flex items-center gap-3 py-1" role="separator">
      <span className="h-px flex-1 bg-brand-200 dark:bg-brand-900" />
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
        <Headset className="size-3.5 shrink-0" aria-hidden="true" />
        Handed off to customer service
      </span>
      <span className="h-px flex-1 bg-brand-200 dark:bg-brand-900" />
    </div>
  );
}

function TypingIndicator() {  return (
    <div className="flex gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
        <Bot className="size-4 animate-pulse" />
      </div>
      <div className="min-w-0 max-w-[85%]">
        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          Refund Assistant · typing…
        </p>
        <div className="mt-1 inline-flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="size-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="size-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="size-2 rounded-full bg-zinc-500 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

export function ConversationalRefundDrawer({
  order,
  requestId,
  open,
  onClose,
  onSuccess,
  userRole = 'CUSTOMER',
}: ConversationalRefundDrawerProps) {
  const { me } = useAuth();
  const userName = me?.fullName || 'Customer';

  const [detail, setDetail] = useState<RefundRequest | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [messages, setMessages] = useState<RefundMessage[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [closed, setClosed] = useState(false);

  const [step, setStep] = useState<WizardStep>('GREETING');
  const [reason, setReason] = useState<RefundReason | ''>('');
  const [customAmount, setCustomAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);

  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [handlingMode, setHandlingMode] = useState<HandlingMode>('AUTO');

  const endRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<RefundMessage[]>([]);
  const detailRef = useRef<RefundRequest | null>(null);
const pendingAssistantRef = useRef<PendingAssistantMessage[]>([]);
const greetedRef = useRef<string | null>(null);
const catchUpRef = useRef<string | null>(null);
const threadIdRef = useRef<string | null>(null);
const loadTokenRef = useRef(0);

const pingedRef = useRef<Set<string>>(new Set());

const pingOnce = useCallback((message: { author: string; body: string; createdAt: string }) => {
  const key = `${message.author}::${message.body}::${message.createdAt}`;
  if (pingedRef.current.has(key)) return false;
  pingedRef.current.add(key);

  if (pingedRef.current.size > 200) {
    pingedRef.current = new Set(Array.from(pingedRef.current).slice(-100));
  }
  return true;
}, []);

  messagesRef.current = messages;
  detailRef.current = detail;

  const activeId = detail?.id ?? requestId;
  const assistantReady = isAssistantConfigured();

  const maxRefundableCents = useMemo(() => {
    const source = order?.items ?? detail?.order?.items;
    if (!source) return 0;
    return source
      .filter((item) => !item.finalSale)
      .reduce((sum, item) => sum + item.unitAmountCents * item.quantity, 0);
  }, [order, detail]);

  const maxRefundableFormatted = (maxRefundableCents / 100).toFixed(2);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, step, isAiTyping, scrollToBottom]);

  useEffect(() => {
    if (order && !requestId) {
      setStep('GREETING');
      setReason('');
      setCustomAmount(maxRefundableFormatted);
      setDescription('');
      setSubmitError(null);
      setDetail(null);
      setMessages([]);
      setRating(null);
      setClosed(false);
      setChatDraft('');
      setChatError(null);
      setIsAiTyping(false);
      pendingAssistantRef.current = [];
      greetedRef.current = null;
      threadIdRef.current = null;
      loadTokenRef.current += 1;
      pingedRef.current = new Set();
    }
  }, [order, requestId, maxRefundableFormatted]);

  const { connected, ready, send, sendAi } = useRefundSocket({
    requestId: activeId,
    onMessage: (event) => {
      if (event.requestId !== activeId) return;
      setIsAiTyping(false);
      setMessages((current) => {
        const next = [...current];
        if (event.message) next.push(event.message);
        if (event.aiReply) next.push(event.aiReply);
        return next;
      });
    
      if (event.message && pingOnce(event.message)) chatSound.receive();
      if (event.aiReply && pingOnce(event.aiReply)) chatSound.assistant();
      scrollToBottom();
    },
  });


  const handoffMarkerIndex = detail?.aiMeta?.classification?.requestedHuman
    ? messages.reduce((last, message, index) => (message.author === 'AI' ? index : last), -1)
    : -1;

  const persistAssistantMessage = useCallback(
    async (message: RefundMessage, meta: refundsApi.AssistantMessageMeta, id: string) => {
   
      if (ready) {
        const ack = await sendAi(message.body, meta, `ai-${message.createdAt}`);
        if (ack.message) {
          setMessages((current) =>
            current.map((item) => (item === message ? (ack.message as RefundMessage) : item)),
          );
        }
        return;
      }
      const saved = await refundsApi.saveAssistantMessage(id, message.body, meta);
      if (saved.message) {
        setMessages((current) =>
          current.map((item) => (item === message ? saved.message : item)),
        );
      }
    },
    [ready, sendAi],
  );

  
  const askAndShow = useCallback(
    async (options: {
      scenario: AssistantScenario;
      userText?: string;
      selectedReason?: RefundReason | null;
      currentAmount?: number | null;
      requestOverride?: RefundRequest | null;
    }) => {
      const request = options.requestOverride !== undefined ? options.requestOverride : detailRef.current;

      const generationThread = threadIdRef.current;

      let stillOnSameThread = true;
      let history: AssistantTurn[] = messagesRef.current.map((item) => ({
        author: item.author,
        body: item.body,
      }));
      
      if (options.userText) {
        const last = history[history.length - 1];
        if (last && last.author === 'CUSTOMER' && last.body === options.userText) {
          history = history.slice(0, -1);
        }
      }

      setIsAiTyping(true);
      setChatError(null);

      try {
        const result = await askAssistant({
          scenario: options.scenario,
          order,
          request,
          userText: options.userText,
          history,
          customerName: userName,
          assistantActive: handlingMode === 'AUTO',
          selectedReason: options.selectedReason ?? (reason || null),
          maxRefundable: maxRefundableCents,
          currentAmount: options.currentAmount ?? null,
        });

        const message: RefundMessage = {
          author: 'AI',
          body: result.reply,
          createdAt: new Date().toISOString(),
        };
        const meta: refundsApi.AssistantMessageMeta = {
          model: result.model,
          latencyMs: result.latencyMs,
          classification: {
            intent: result.classification.intent,
            detectedReason: result.classification.detectedReason,
            isDispute: result.classification.isDispute,
            urgency: result.classification.urgency,
            requestedHuman: result.classification.requestedHuman,
          },
        };

        stillOnSameThread = threadIdRef.current === generationThread;

        if (result.classification.requestedHuman && stillOnSameThread) {
          setHandlingMode('HUMAN');
        }

        if (request?.id) {
          try {
            await persistAssistantMessage(message, meta, request.id);
          } catch {
            if (stillOnSameThread) {
              setChatError('The reply above is from the assistant but could not be saved yet.');
            }
          }
        } else if (stillOnSameThread) {
          pendingAssistantRef.current.push({ message, meta });
        }

  
        if (!stillOnSameThread) return;

        setMessages((current) => [...current, message]);
        pingOnce(message);
        chatSound.assistant();
      } catch (err) {
        if (!stillOnSameThread) return;
        setChatError(
          err instanceof Error ? err.message : 'The assistant could not answer right now.',
        );
      } finally {
        if (stillOnSameThread) setIsAiTyping(false);
        scrollToBottom();
      }
    },
    [
      order,
      reason,
      maxRefundableCents,
      userName,
      handlingMode,
      persistAssistantMessage,
      scrollToBottom,
    ],
  );

  const loadExisting = useCallback(
    async (id: string) => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      setDetailError(null);
      try {
        const data = await refundsApi.getRefundRequest(id);

        if (token !== loadTokenRef.current) return;
        setDetail(data);
        const server = data.messages ?? [];
        setMessages((current) => {
        
          if (threadIdRef.current !== id) {
            threadIdRef.current = id;
            return server;
          }
          if (!current.length) return server;
          const keys = new Set(server.map(messageKey));
          const unsynced = current.filter((message) => !keys.has(messageKey(message)));
          return unsynced.length ? [...server, ...unsynced] : server;
        });
        setStep('THREAD');

  
        if (data.aiMeta?.classification?.requestedHuman) {
          setHandlingMode('HUMAN');
        }

        const hasAssistantTurn = (data.messages ?? []).some((item) => item.author === 'AI');
        if (
          !hasAssistantTurn &&
          userRole === 'CUSTOMER' &&
          assistantReady &&
          catchUpRef.current !== data.id
        ) {
          catchUpRef.current = data.id;
          void askAndShow({ scenario: 'DECISION_ANNOUNCED', requestOverride: data });
        }
      } catch (err) {
        setDetail(null);
        setDetailError(err instanceof Error ? err.message : 'Could not load refund request.');
      }
    },
    [userRole, assistantReady, askAndShow],
  );


  const loadExistingRef = useRef(loadExisting);
  loadExistingRef.current = loadExisting;

  useEffect(() => {
    if (requestId && open) {
      void loadExistingRef.current(requestId);
    }
  }, [requestId, open]);

 
  useEffect(() => {
    if (!open || !order || requestId || detail) return;
    if (greetedRef.current === order.orderNumber) return;
    if (!assistantReady) return;
    greetedRef.current = order.orderNumber;
    void askAndShow({ scenario: 'GREETING' }).then(() => {
      setStep('SELECT_REASON');
    });
  }, [open, order, requestId, detail, assistantReady, askAndShow]);

  const flushPendingAssistantMessages = useCallback(
    async (created: RefundRequest) => {
      const queued = pendingAssistantRef.current;
      pendingAssistantRef.current = [];
      for (const item of queued) {
        try {
          await refundsApi.saveAssistantMessage(created.id, item.message.body, item.meta);
        } catch {
         
        }
      }
    },
    [],
  );

  async function submitRequest(finalReason: RefundReason, amountVal: number, userMessage: string) {
    if (!order) return;
 
    const stepBefore = step;
    setSubmitting(true);
    setIsAiTyping(true);
    setSubmitError(null);
    setStep('SUBMITTING');

    try {
      const created = await refundsApi.createRefundRequest({
        orderNumber: order.orderNumber,
        reason: finalReason,
        requestedAmount: amountVal,
        claimedItemNames: [],
        message: userMessage,
      });

      setDetail(created);
      setMessages([...pendingAssistantRef.current.map((item) => item.message), ...(created.messages ?? [])]);
      setStep('THREAD');
      onSuccess?.();
      void flushPendingAssistantMessages(created);

      await askAndShow({
        scenario: 'DECISION_ANNOUNCED',
        userText: userMessage,
        selectedReason: finalReason,
        currentAmount: amountVal,
        requestOverride: created,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to process refund request.');
      setStep(stepBefore === 'SUBMITTING' ? 'SELECT_REASON' : stepBefore);
    } finally {
      setSubmitting(false);
      setIsAiTyping(false);
    }
  }

  function handleSelectReason(selected: RefundReason) {
    setReason(selected);
    setCustomAmount(maxRefundableFormatted);
    setMessages((current) => [
      ...current,
      { author: userRole === 'ADMIN' ? 'ADMIN' : 'CUSTOMER', body: selectedReasonLabel(selected), createdAt: new Date().toISOString() },
    ]);

    if (REASON_WITH_OPTIONS.includes(selected)) {
      void askAndShow({ scenario: 'REASON_SELECTED', selectedReason: selected }).then(() => {
        setStep('CONDITIONAL_OPTION');
      });
      return;
    }

    void askAndShow({ scenario: 'REASON_SELECTED', selectedReason: selected }).then(() => {
      void submitRequest(selected, Number(maxRefundableFormatted), selectedReasonLabel(selected));
    });
  }

  function handleOptionChoice(choice: 'FULL' | 'PARTIAL' | 'CUSTOM') {
    const label =
      choice === 'FULL'
        ? `Full refund of $${maxRefundableFormatted}`
        : choice === 'PARTIAL'
          ? `I will keep the item and accept $${(Number(maxRefundableFormatted) / 2).toFixed(2)}`
          : 'I want to enter a different amount';

    setMessages((current) => [
      ...current,
      { author: userRole === 'ADMIN' ? 'ADMIN' : 'CUSTOMER', body: label, createdAt: new Date().toISOString() },
    ]);

    if (choice === 'CUSTOM') {
      void askAndShow({ scenario: 'CUSTOM_DETAILS', selectedReason: reason || null }).then(() => {
        setStep('CUSTOM_DETAILS');
      });
      return;
    }

    const amount =
      choice === 'FULL'
        ? Number(maxRefundableFormatted)
        : Number((Number(maxRefundableFormatted) / 2).toFixed(2));
    void submitRequest(reason as RefundReason, amount, label);
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    const amt = Number(customAmount) || Number(maxRefundableFormatted);
    const note = description.trim();
    void submitRequest(
      reason,
      amt,
      note || `I would like a refund of $${amt.toFixed(2)} for order ${order?.orderNumber}`,
    );
  }


  async function handleSendChatMessage() {
    const body = chatDraft.trim();
    if (!body || chatSending) return;

    const hasThread = detail !== null;
    if (!hasThread && !order) return;

    setChatDraft('');
    setChatError(null);

    if (!hasThread) {
      setChatSending(true);
      setMessages((current) => [
        ...current,
        { author: 'CUSTOMER', body, createdAt: new Date().toISOString() },
      ]);
      chatSound.send();
      try {
        await askAndShow({ scenario: 'PRE_REQUEST_MESSAGE', userText: body });
        setStep((current) => (current === 'GREETING' ? 'SELECT_REASON' : current));
      } finally {
        setChatSending(false);
        scrollToBottom();
      }
      return;
    }

    const threadId = activeId;
    if (!threadId) return;


    const assistantOn = handlingMode === 'AUTO';
    setChatSending(true);
    if (assistantOn) setIsAiTyping(true);

    const tempMsg: RefundMessage = {
      author: userRole === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, tempMsg]);
    chatSound.send();
    scrollToBottom();

    try {
      if (userRole === 'ADMIN') {
        await refundsApi.sendRefundMessage(threadId, body);
      } else {
        await send(body, crypto.randomUUID());
      }
    } catch (caught) {
      setChatError(caught instanceof Error ? caught.message : 'Message failed to send.');
      setMessages((current) => current.filter((item) => item !== tempMsg));
      setChatDraft(body);
      setChatSending(false);
      setIsAiTyping(false);
      return;
    }

    if (userRole === 'CUSTOMER' && assistantOn) {
      await askAndShow({ scenario: 'THREAD_MESSAGE', userText: body });
    } else {
      setIsAiTyping(false);
    }

    setChatSending(false);
    scrollToBottom();
  }

  async function handleRate(star: number) {
    if (rating === star || !activeId) return;
    setRating(star);

    const body = `I rated the support ${star} star${star > 1 ? 's' : ''}.`;
    setMessages((current) => [
      ...current,
      { author: userRole === 'ADMIN' ? 'ADMIN' : 'CUSTOMER', body, createdAt: new Date().toISOString() },
    ]);
    scrollToBottom();

    try {
      await send(body, crypto.randomUUID());
    } catch (caught) {
      setChatError(caught instanceof Error ? caught.message : 'Failed to send rating.');
    }

    if (userRole === 'CUSTOMER' && handlingMode === 'AUTO') {
      await askAndShow({ scenario: 'RATING', userText: body });
    }
    scrollToBottom();
  }

  const wizardOpen = Boolean(order) && !detail && step !== 'SUBMITTING';
  const showReasonChips = wizardOpen && (step === 'SELECT_REASON' || step === 'GREETING') && !isAiTyping;
  const showOptionChips = wizardOpen && step === 'CONDITIONAL_OPTION' && !isAiTyping;
  const showCustomForm = wizardOpen && step === 'CUSTOM_DETAILS';
  const chatEnabled = step === 'THREAD' || Boolean(detail) || wizardOpen;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      bodyClassName="p-0 overflow-hidden flex flex-col h-full min-h-0 flex-1"
      title={
        detail
          ? `Refund Chat · ${detail.reference}`
          : order
            ? `Refund Chat · ${order.orderNumber}`
            : 'Refund Chat'
      }
      description={
        order
          ? `Purchased for ${order.total} (Shipping ${order.shippingCents > 0 ? `$${(order.shippingCents / 100).toFixed(2)}` : '$0.00'} non-refundable)`
          : detail
            ? `Order ${detail.orderNumber} · Requested ${detail.requestedAmount}`
            : undefined
      }
    >
      {detailError ? (
        <div className="p-6">
          <ErrorState message={detailError} onRetry={() => requestId && void loadExisting(requestId)} />
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950">
          <div className="scrollbar-thin flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* Decision facts, straight from the policy engine. */}
            {detail ? (
              <div className="space-y-4">
                <div className="flex gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
                    <Bot className="size-4" />
                  </div>
                  <div className="min-w-0 max-w-[90%] space-y-2">
                    <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                      Refund Assistant · decision record
                    </p>
                    <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50 p-4 text-xs text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-200 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <DecisionBadge decision={detail.decision} />
                        <StatusBadge status={detail.status} />
                        <span className="font-mono text-[11px] font-bold text-zinc-500">Ref: {detail.reference}</span>
                      </div>

                      <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {detail.decisionReason}
                      </p>

                      <div className="grid grid-cols-2 gap-2 border-t border-zinc-200/60 pt-2 text-[11px] dark:border-zinc-800/60">
                        <div>
                          <span className="text-zinc-500">Requested: </span>
                          <strong className="text-zinc-900 dark:text-zinc-100">{detail.requestedAmount}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500">Approved: </span>
                          <strong className="text-zinc-900 dark:text-zinc-100">{detail.approvedAmount}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {messages.map((msg, index) => (
                  <Fragment key={`${msg.author}-${index}-${msg.createdAt}`}>
                    <MessageBubble message={msg} userRole={userRole} userName={userName} />
                    {index === handoffMarkerIndex ? <HandoffNotice /> : null}
                  </Fragment>
                ))}

                {isAiTyping ? <TypingIndicator /> : null}
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <Fragment key={`${msg.author}-${index}-${msg.createdAt}`}>
                    <MessageBubble message={msg} userRole={userRole} userName={userName} />
                    {index === handoffMarkerIndex ? <HandoffNotice /> : null}
                  </Fragment>
                ))}
                {isAiTyping || submitting ? <TypingIndicator /> : null}
                {!assistantReady ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    The assistant is not configured. Add <code>VITE_GEMINI_API_KEY</code> to frontend/.env and restart
                    the dev server.
                  </p>
                ) : null}
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div className="shrink-0 space-y-3 border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <FormErrorBanner message={submitError} />

            {showReasonChips ? (
              <div className="space-y-2 transition-all duration-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Select a return reason to proceed:
                </p>
                <div className="flex flex-wrap gap-2">
                  {REASON_CHIPS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelectReason(option.value)}
                      className="rounded-full border border-zinc-300 bg-zinc-100 px-3.5 py-1.5 text-xs font-bold text-zinc-900 transition-all hover:scale-105 hover:bg-zinc-950 hover:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white dark:hover:text-zinc-950"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {showOptionChips ? (
              <div className="space-y-2 transition-all duration-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Choose refund option:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleOptionChoice('FULL')}
                    className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white transition-all hover:scale-105 dark:bg-zinc-100 dark:text-zinc-950"
                  >
                    Full Refund (${maxRefundableFormatted})
                  </button>
                  {reason === 'DAMAGED' ? (
                    <button
                      type="button"
                      onClick={() => handleOptionChoice('PARTIAL')}
                      className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-800 transition-all hover:scale-105 dark:border-zinc-700 dark:text-zinc-200"
                    >
                      50% Partial Refund (Keep Item)
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleOptionChoice('CUSTOM')}
                    className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-bold text-zinc-800 transition-all hover:scale-105 dark:border-zinc-700 dark:text-zinc-200"
                  >
                    Custom Amount & Details
                  </button>
                </div>
              </div>
            ) : null}

            {showCustomForm ? (
              <form onSubmit={handleCustomSubmit} className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-1/3">
                    <Input
                      label="Amount ($)"
                      type="number"
                      min={0.01}
                      max={Number(maxRefundableFormatted)}
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-2/3">
                    <Input
                      label="Why or tell us more"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. keeping damaged item..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setStep('SELECT_REASON')}>
                    Back
                  </Button>
                  <Button type="submit" size="sm" loading={submitting}>
                    Submit Refund
                  </Button>
                </div>
              </form>
            ) : null}

            {chatEnabled ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {ready ? 'Live' : connected ? 'Joining thread…' : ''}
                  </span>
                  <SoundToggle />
                </div>
                {!connected && Boolean(detail) ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                    <WifiOff className="size-3" aria-hidden="true" />
                    Reconnecting to live chat…
                  </p>
                ) : null}
                {chatError ? <p className="text-[11px] text-red-600 dark:text-red-400">{chatError}</p> : null}

                <div className="relative rounded-2xl border border-zinc-200 bg-zinc-50/70 p-1.5 transition focus-within:border-zinc-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900/60 dark:focus-within:border-zinc-600 dark:focus-within:bg-zinc-900">
                  <Textarea
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendChatMessage();
                      }
                    }}
                    placeholder="Write a message…"
                    rows={2}
                    disabled={closed || isAiTyping || chatSending}
                    className="min-h-[76px] resize-none border-0 bg-transparent py-2.5 pr-12 shadow-none focus:border-0 focus:ring-0 dark:bg-transparent"
                  />
                  <button
                    type="button"
                    aria-label="Send message"
                    disabled={!chatDraft.trim() || chatSending || isAiTyping || closed}
                    onClick={() => void handleSendChatMessage()}
                    className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-xl bg-zinc-950 text-white transition hover:bg-[#e86438] disabled:cursor-not-allowed disabled:opacity-35 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-[#e86438] dark:hover:text-white"
                  >
                    <Send className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {detail && userRole === 'CUSTOMER' ? (
                  <div className="space-y-2 border-t border-zinc-100 pt-2 dark:border-zinc-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div
                        role="group"
                        aria-label="Who is answering"
                        className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        {(
                          [
                            { value: 'AUTO', label: 'Assistant' },
                            { value: 'HUMAN', label: 'Customer service' },
                          ] as const
                        ).map((option) => {
                          const active = handlingMode === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setHandlingMode(option.value)}
                              className={cn(
                                'rounded-full px-3 py-1 text-[11px] font-bold transition-colors',
                                active
                                  ? option.value === 'HUMAN'
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>

                      {!closed ? (
                        <Button variant="ghost" size="sm" onClick={() => setClosed(true)} className="text-[11px] h-7 px-2">
                          <CheckCircle2 className="size-3 mr-1" />
                          Close Ticket
                        </Button>
                      ) : (
                        <Badge variant="success" className="text-[10px]">Ticket Closed</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-zinc-500">Rate support:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => void handleRate(star)}
                            className="text-amber-400 transition-transform hover:scale-110 active:scale-95"
                          >
                            <Star className={`size-3.5 ${rating && rating >= star ? 'fill-amber-400' : 'fill-none'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function selectedReasonLabel(reason: RefundReason): string {
  return `Reason selected: ${reason.replace(/_/g, ' ').toLowerCase()}`;
}

function MessageBubble({
  message,
  userRole,
  userName,
}: {
  message: RefundMessage;
  userRole: 'CUSTOMER' | 'ADMIN';
  userName: string;
}) {
  const isUser = userRole === 'ADMIN' ? message.author === 'ADMIN' : message.author === 'CUSTOMER';
  const isAi = message.author === 'AI';
  const isStaff = message.author === 'ADMIN';

  return (
    <div
      className={cn(
        'flex gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2',
        isUser && 'flex-row-reverse',
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isAi ? (
          <div className="flex size-8 items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950">
            <Bot className="size-4" />
          </div>
        ) : message.author === 'SYSTEM' ? (
          <Avatar name="System" size="sm" />
        ) : isStaff ? (
          <Avatar name={message.authorName || 'Support'} size="sm" />
        ) : (
          <Avatar name={userName} size="sm" />
        )}
      </div>
      <div className={cn('min-w-0 max-w-[85%]', isUser && 'text-right')}>
        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {isUser ? 'You' : message.authorName ? message.authorName : AUTHOR_LABEL[message.author]}
          {isAi ? ' · automated' : ''}
        </p>
        <div
          className={cn(
            'mt-1 inline-block rounded-2xl border px-3.5 py-2.5 text-left text-sm leading-relaxed',
            isUser
              ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
              : isAi
                ? 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'
                : 'border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50',
          )}
        >
          {message.body}
        </div>
        <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
          {formatDateTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
