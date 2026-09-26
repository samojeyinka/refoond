import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bot, Send, WifiOff } from 'lucide-react';
import { Textarea } from './ui/Textarea';
import { Avatar } from './ui/Avatar';
import { cn } from '../lib/cn';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../contexts/AuthContext';
import type { RefundMessage, RefundMessageAuthor } from '../api/types';

interface ChatMessage extends RefundMessage {
  pending?: boolean;
}

const AUTHOR_LABEL: Record<RefundMessageAuthor, string> = {
  CUSTOMER: 'Customer',
  AI: 'Refund Assistant',
  ADMIN: 'Support Agent',
  SYSTEM: 'System Notice',
};

/** Prefer the stored sender name; fall back to a role label for older rows. */
function senderName(message: ChatMessage, own: boolean): string {
  if (own) return 'You';
  if (message.authorName) return message.authorName;
  return AUTHOR_LABEL[message.author];
}

function Bubble({ message, own, userName }: { message: ChatMessage; own: boolean; userName: string }) {
  const isAi = message.author === 'AI';
  const isStaff = message.author === 'ADMIN';

  return (
    <div
      className={cn(
        'flex gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2',
        own && 'flex-row-reverse',
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
        ) : own ? (
          <Avatar name={userName} size="sm" />
        ) : (
          <Avatar name={message.authorName || 'Customer'} size="sm" />
        )}
      </div>
      <div className={cn('min-w-0 max-w-[85%]', own && 'text-right')}>
        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {senderName(message, own)}
          {isAi ? ' · automated' : ''}
        </p>
        <div
          className={cn(
            'mt-1 inline-block rounded-2xl border px-3.5 py-2.5 text-left text-sm leading-relaxed',
            own
              ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
              : isAi
                ? 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200'
                : 'border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50',
            message.pending && 'opacity-60',
          )}
        >
          {message.body}
        </div>
        <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
          {message.pending ? 'Sending…' : formatDateTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

interface RefundChatProps {
  messages: RefundMessage[];
  connected: boolean;
  canPost: boolean;
  myAuthor: Extract<RefundMessageAuthor, 'CUSTOMER' | 'ADMIN'>;
  placeholder?: string;
  onSend: (body: string) => Promise<void>;
  emptyHint?: string;
  /** Rendered inside the scroll area, above the messages. */
  context?: ReactNode;
}

export function RefundChat({
  messages,
  connected,
  canPost,
  myAuthor,
  placeholder,
  onSend,
  emptyHint,
  context,
}: RefundChatProps) {
  const { me } = useAuth();
  const userName = me?.fullName || 'Support';
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const history: ChatMessage[] = pending ? [...messages, pending] : messages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [history.length]);

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    setPending({ author: myAuthor, body, createdAt: new Date().toISOString(), pending: true });
    try {
      await onSend(body);
      setDraft('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Message failed to send.');
    } finally {
      setPending(null);
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {context ? <div className="mb-4">{context}</div> : null}
        {history.length === 0 ? (
          <p className="px-1 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            {emptyHint ?? 'No messages yet. Ask a question and the assistant will reply using the policy decision.'}
          </p>
        ) : (
          <ul className="space-y-4">
            {history.map((message, index) => (
              <Bubble
                key={`${message.author}-${index}-${message.createdAt}`}
                message={message}
                own={message.author === myAuthor}
                userName={userName}
              />
            ))}
            <div ref={endRef} />
          </ul>
        )}
      </div>

      {canPost ? (
        <div className="shrink-0 border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          {!connected ? (
            <p className="mb-2 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400">
              <WifiOff className="size-3.5" aria-hidden="true" />
              Reconnecting…
            </p>
          ) : null}
          {error ? <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{error}</p> : null}
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={placeholder ?? 'Reply to the customer…'}
              rows={2}
              maxLength={2000}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              className="resize-none text-sm"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!connected || sending || !draft.trim()}
              aria-label="Send reply"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white transition-opacity disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-950"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <p className="shrink-0 border-t border-zinc-200 p-4 text-[11px] text-zinc-500 dark:text-zinc-400 dark:border-zinc-800">
          This thread is closed for replies.
        </p>
      )}
    </div>
  );
}
