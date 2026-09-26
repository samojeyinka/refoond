import { Bot, Headset, MessageSquare } from 'lucide-react';
import type { RefundMessage, RefundRequest, Role } from '../api/types';
import { cn } from '../lib/cn';
import { formatDateTime } from '../lib/format';

const SOURCE_META: Record<RefundMessage['author'], { label: string; Icon: typeof Bot }> = {
  CUSTOMER: { label: 'You', Icon: MessageSquare },
  AI: { label: 'Assistant', Icon: Bot },
  ADMIN: { label: 'Support', Icon: Headset },
  SYSTEM: { label: 'System', Icon: MessageSquare },
};

/**
 * Who a preview line should be attributed to, from the reader's point of view.
 * "You" is only correct for the customer: an admin reading the same thread would
 * otherwise see the customer's own words labelled as their own.
 */
function describe(
  message: RefundMessage,
  viewerRole: Role,
): { who: string; Icon: typeof Bot } {
  const meta = SOURCE_META[message.author];
  if (message.author === 'ADMIN' && message.authorName) {
    return { who: message.authorName, Icon: meta.Icon };
  }
  if (message.author === 'CUSTOMER' && viewerRole !== 'CUSTOMER') {
    return { who: 'Customer', Icon: meta.Icon };
  }
  return { who: meta.label, Icon: meta.Icon };
}

export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5',
        'text-[11px] font-bold leading-none text-white tabular-nums',
      )}
      aria-label={`${count} unread ${count === 1 ? 'message' : 'messages'}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Newest-message preview with an unread count, so a list tells you what changed
 * and whether it still needs you.
 *
 * `showBadge` is off for rows that already render an <UnreadBadge> in their own
 * header; two badges side by side reads as a bug.
 */
export function LatestMessageLine({
  request,
  viewerRole,
  className,
  showBadge = true,
}: {
  request: Pick<RefundRequest, 'lastMessage' | 'unreadCount'>;
  viewerRole: Role;
  className?: string;
  showBadge?: boolean;
}) {
  const message = request.lastMessage;
  const unread = request.unreadCount ?? 0;
  if (!message) return null;

  const { who, Icon } = describe(message, viewerRole);
  const isUnread = unread > 0;

  return (
    <div
      className={cn(
        'mt-3 flex items-start gap-2 rounded-xl border px-3 py-2',
        isUnread
          ? 'border-brand-200 bg-brand-50/70 dark:border-brand-900 dark:bg-brand-950/50'
          : 'border-zinc-200/80 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/40',
        className,
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-3.5 shrink-0',
          isUnread ? 'text-brand-700 dark:text-brand-300' : 'text-zinc-400 dark:text-zinc-500',
        )}
        aria-hidden="true"
      />
      <p
        className={cn(
          'min-w-0 flex-1 truncate text-xs',
          isUnread
            ? 'font-medium text-brand-900 dark:text-brand-100'
            : 'text-zinc-500 dark:text-zinc-400',
        )}
      >
        <span className="font-semibold">{who}: </span>
        {message.body}
      </p>
      <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
        {formatDateTime(message.createdAt)}
      </span>
      {showBadge ? <UnreadBadge count={unread} /> : null}
    </div>
  );
}
