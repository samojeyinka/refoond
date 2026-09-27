import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Headset, Inbox, MessageCircle, Scale, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Drawer } from '../components/ui/Drawer';
import { Tabs } from '../components/ui/Tabs';
import { Textarea } from '../components/ui/Textarea';
import { FormErrorBanner } from '../components/ui/FormErrorBanner';
import { SectionHeading } from '../components/ui/SectionHeading';
import { DecisionBadge, FlagBadge, StatusBadge } from '../components/DecisionBadge';
import { RuleTrace } from '../components/RuleTrace';
import { RefundChat } from '../components/RefundChat';
import { LatestMessageLine, UnreadBadge } from '../components/LatestMessageLine';
import { SoundToggle } from '../components/SoundToggle';
import { useAsyncData } from '../hooks/useAsyncData';
import { useRefundSocket } from '../hooks/useRefundSocket';
import * as refundsApi from '../api/refunds';
import { formatDateTime } from '../lib/format';
import { chatSound } from '../lib/sound';
import { cn } from '../lib/cn';
import type { RefundDecision, RefundMessage, RefundRequest } from '../api/types';

const FILTERS = [
  { value: '' as const, label: 'All' },
  { value: 'ESCALATED' as const, label: 'Needs review' },
  { value: 'APPROVED' as const, label: 'Approved' },
  { value: 'DENIED' as const, label: 'Denied' },
];

function QueueRow({ request, onOpen }: { request: RefundRequest; onOpen: (id: string) => void }) {
  const unread = request.unreadCount ?? 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(request.id)}
      className={cn(
        'grid w-full grid-cols-1 gap-2 rounded-xl border bg-white p-4 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_auto] dark:bg-zinc-950',
        unread > 0
          ? 'border-brand-300 hover:border-brand-400 dark:border-brand-800 dark:hover:border-brand-700'
          : 'border-zinc-200 hover:border-brand-300 dark:border-zinc-800 dark:hover:border-brand-800',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-zinc-950 dark:text-zinc-50">{request.reference}</span>
          <DecisionBadge decision={request.decision} />
          <StatusBadge status={request.status} />
          {request.flags.map((flag) => (
            <FlagBadge key={flag} flag={flag} />
          ))}
          <UnreadBadge count={unread} />
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {request.orderNumber} · {request.reason.replace(/_/g, ' ').toLowerCase()} ·{' '}
          {formatDateTime(request.createdAt)}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">{request.decisionReason}</p>
        <LatestMessageLine request={request} viewerRole="ADMIN" className="mt-2.5" showBadge={false} />
      </div>
      <div className="text-left sm:text-right">
        <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Requested</p>
        <p className="text-lg font-bold text-zinc-950 dark:text-zinc-50">{request.requestedAmount}</p>
        {request.decision === 'APPROVED' ? (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">approved {request.approvedAmount}</p>
        ) : null}
      </div>
    </button>
  );
}

export default function AdminQueuePage() {
  const [filter, setFilter] = useState<RefundDecision | ''>('');
  const list = useAsyncData(() => refundsApi.listAllRequests(filter || undefined), [filter]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerView, setDrawerView] = useState<'details' | 'conversation'>('details');
  const [manuallyClosed, setManuallyClosed] = useState(false);
  const [detail, setDetail] = useState<RefundRequest | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [messages, setMessages] = useState<RefundMessage[]>([]);
  const [note, setNote] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<'APPROVED' | 'DENIED' | null>(null);
  /** Which request the `messages` state currently belongs to. */
  const threadIdRef = useRef<string | null>(null);
  /** Bumped per load so a slow response cannot overwrite a newer request. */
  const loadTokenRef = useRef(0);

  /**
   * Server-sourced messages only, so this triple is a stable identity and the
   * same message arriving over both the thread room and the queue room collapses
   * to one bubble.
   */
  const messageKey = (message: RefundMessage) => `${message.author}::${message.body}::${message.createdAt}`;

  const appendMessages = useCallback((incoming: RefundMessage[]) => {
    if (!incoming.length) return;
    setMessages((current) => {
      const seen = new Set(current.map(messageKey));
      const additions = incoming.filter((message) => {
        const key = messageKey(message);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return additions.length ? [...current, ...additions] : current;
    });
  }, []);

  const load = useCallback(
    async (id: string) => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      setDetailError(null);
      try {
        const request = await refundsApi.getAdminRequest(id);
        // The reviewer already opened a different request; this body is stale.
        if (token !== loadTokenRef.current) return;
        setDetail(request);
        // Merged rather than replaced: if a live message arrived while this
        // request was in flight, the response can predate it and would
        // otherwise wipe it off the screen. Only valid within one thread, though
        // — merging across threads would paste the old conversation in here.
        setMessages((current) => {
          if (threadIdRef.current !== id) {
            threadIdRef.current = id;
            return request.messages ?? [];
          }
          const server = request.messages ?? [];
          if (!current.length) return server;
          const keys = new Set(server.map(messageKey));
          const unsynced = current.filter((message) => !keys.has(messageKey(message)));
          return unsynced.length ? [...server, ...unsynced] : server;
        });
      } catch (caught) {
        if (token !== loadTokenRef.current) return;
        setDetail(null);
        setDetailError(caught instanceof Error ? caught.message : 'Could not load this request.');
      }
    },
    [],
  );

  useEffect(() => {
    if (openId) {
      setDrawerView('details');
      setManuallyClosed(false);
      void load(openId);
      // Opening the case is what marks it read, otherwise the staff unread count
      // only ever grows and stops meaning anything.
      void refundsApi.markRequestSeen(openId).then(() => list.reload()).catch(() => undefined);
    } else {
      setDetail(null);
      setMessages([]);
      setNote('');
      setResolveError(null);
      threadIdRef.current = null;
      // Invalidate any load still in flight for the request being closed.
      loadTokenRef.current += 1;
    }
  }, [openId, load]);

  const { connected, send } = useRefundSocket({
    requestId: openId,
    onMessage: (event) => {
      if (event.requestId !== openId) return;
      appendMessages([event.message, ...(event.aiReply ? [event.aiReply] : [])]);
      if (event.message) chatSound.receive();
      if (event.aiReply) chatSound.assistant();
    },
    onQueueActivity: (requestId, message) => {
      list.reload();
      if (message && requestId === openId) {
        appendMessages([message]);
        // The queue broadcast goes to every admin including the author, so an
        // admin's own message comes back to them. Only ping for other people's.
        if (message.author !== 'ADMIN') chatSound.receive();
      } else if (message && message.author !== 'ADMIN') {
        chatSound.receive();
      }
    },
  });

  async function post(body: string) {
    if (!openId) return;
    const response = await send(body, crypto.randomUUID());
    chatSound.send();
    appendMessages([response.message, ...(response.aiReply ? [response.aiReply] : [])].filter(Boolean) as RefundMessage[]);
    if (response.aiReply) chatSound.assistant();
    void load(openId);
  }

  async function resolve(outcome: 'APPROVED' | 'DENIED') {
    if (!openId) return;
    if (note.trim().length < 1) {
      setResolveError('Add a short note so the customer knows what was decided.');
      return;
    }
    setResolving(outcome);
    setResolveError(null);
    try {
      const updated = await refundsApi.resolveRequest(openId, outcome, note.trim());
      setDetail(updated);
      setMessages((current) => [
        ...current,
        { author: 'ADMIN', body: `Reviewed by support: ${outcome}. ${note.trim()}`, createdAt: new Date().toISOString() },
      ]);
      setNote('');
      list.reload();
    } catch (caught) {
      setResolveError(caught instanceof Error ? caught.message : 'Could not record the decision.');
    } finally {
      setResolving(null);
    }
  }

  const summary = list.data?.summary;
  const counts = useMemo(
    () => [
      { label: 'All', value: summary?.total ?? 0, icon: Inbox },
      { label: 'Needs review', value: summary?.escalated ?? 0, icon: Scale },
      { label: 'Approved', value: summary?.approved ?? 0, icon: CheckCircle2 },
      { label: 'Denied', value: summary?.denied ?? 0, icon: XCircle },
    ],
    [summary],
  );

  const awaiting = detail?.status === 'AWAITING_REVIEW';
  const showingConversation = drawerView === 'conversation';
  const ticketClosed = detail?.status === 'RESOLVED' || manuallyClosed;

  function closeDrawer() {
    setDrawerView('details');
    setOpenId(null);
  }

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Every decision, the rules behind it, and the AI metadata for each refund request."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counts.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </div>
            <p className="mt-1 text-2xl font-bold text-zinc-950 dark:text-zinc-50">{value}</p>
          </Card>
        ))}
      </div>

      <Tabs
        ariaLabel="Filter requests by decision"
        value={filter}
        onChange={(value) => setFilter(value as RefundDecision | '')}
        items={FILTERS.map((item) => ({ value: item.value, label: item.label }))}
        className="mb-4"
      />

      {list.loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data?.requests.length ? (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="Nothing in this view"
          description="Try another filter to see the rest of the queue."
        />
      ) : (
        <div className="space-y-3">
          {list.data.requests.map((request) => (
            <QueueRow key={request.id} request={request} onOpen={setOpenId} />
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(openId)}
        onClose={closeDrawer}
        title={showingConversation ? 'Customer conversation' : detail ? detail.reference : 'Refund request'}
        description={
          showingConversation
            ? detail
              ? `${detail.reference} · ${detail.customerEmail}`
              : undefined
            : detail
              ? `${detail.orderNumber} · requested ${detail.requestedAmount}`
              : undefined
        }
        footer={
          detail ? (
            <div className="flex items-center justify-between gap-3">
              {showingConversation ? (
                <Button variant="secondary" onClick={() => setDrawerView('details')}>
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back to review
                </Button>
              ) : (
                <SoundToggle />
              )}
              {showingConversation ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setManuallyClosed(true);
                    toast.success('Ticket closed.');
                  }}
                  disabled={ticketClosed}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {ticketClosed ? 'Ticket closed' : 'Close ticket'}
                </Button>
              ) : (
                <Button variant="secondary" onClick={closeDrawer}>Close</Button>
              )}
            </div>
          ) : null
        }
        bodyClassName="flex flex-col overflow-hidden p-5"
      >
        {detailError ? (
          <ErrorState message={detailError} onRetry={() => openId && void load(openId)} />
        ) : !detail ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : showingConversation ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionHeading title="Customer thread" description="Reply live without leaving the case context." />
              <SoundToggle />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <RefundChat
                messages={messages}
                connected={connected}
                canPost={!ticketClosed}
                myAuthor="ADMIN"
                placeholder="Reply to the customer…"
                onSend={post}
                context={
                  detail.ruleTrace.length ? (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        How this was decided
                      </p>
                      <RuleTrace entries={detail.ruleTrace} />
                    </div>
                  ) : null
                }
              />
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div className="flex flex-wrap items-center gap-2">
              <DecisionBadge decision={detail.decision} />
              <StatusBadge status={detail.status} />
              {detail.flags.map((flag) => (
                <FlagBadge key={flag} flag={flag} />
              ))}
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setDrawerView('conversation')}>
                <MessageCircle className="size-4" aria-hidden="true" />
                Conversation
              </Button>
            </div>

            <Card className="p-4">
              <p className="text-sm text-zinc-800 dark:text-zinc-200">{detail.decisionReason}</p>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Requested</dt>
                  <dd className="font-semibold text-zinc-950 dark:text-zinc-50">{detail.requestedAmount}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Eligible</dt>
                  <dd className="font-semibold text-zinc-950 dark:text-zinc-50">{detail.approvedAmount}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Customer</dt>
                  <dd className="truncate font-semibold text-zinc-950 dark:text-zinc-50">{detail.customerEmail}</dd>
                </div>
              </dl>
            </Card>

            {awaiting ? (
              <Card className="border-amber-300 p-4 dark:border-amber-800">
                <SectionHeading
                  title="Human review required"
                  description="Record the final outcome. The customer is notified in their thread."
                />
                <FormErrorBanner message={resolveError} />
                <Textarea
                  className="mt-3"
                  label="Review note"
                  rows={3}
                  maxLength={1000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="What did you check, and why?"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => void resolve('APPROVED')} loading={resolving === 'APPROVED'} disabled={Boolean(resolving)}>
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    Approve refund
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => void resolve('DENIED')}
                    loading={resolving === 'DENIED'}
                    disabled={Boolean(resolving)}
                  >
                    <XCircle className="size-4" aria-hidden="true" />
                    Deny refund
                  </Button>
                </div>
              </Card>
            ) : detail.finalOutcome ? (
              <Card className="p-4">
                <p className="text-sm text-zinc-800 dark:text-zinc-200">
                  <strong>{detail.finalOutcome}</strong> by {detail.reviewedByName || 'support'} on{' '}
                  {formatDateTime(detail.reviewedAt)}.
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{detail.adminNote}</p>
              </Card>
            ) : null}

            {detail.aiMeta?.classification?.requestedHuman ? (
              <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950">
                <Headset className="mt-0.5 size-4 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
                    The customer asked for a person
                  </p>
                  <p className="mt-0.5 text-sm text-brand-800 dark:text-brand-200">
                    The assistant stepped back and told them someone would be with them in a few minutes. Reply below to
                    take the case.
                  </p>
                </div>
              </div>
            ) : null}
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
