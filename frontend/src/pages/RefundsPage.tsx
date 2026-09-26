import { useState } from 'react';
import { CheckCircle2, Inbox, ReceiptText, XCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { DecisionBadge, FlagBadge, StatusBadge } from '../components/DecisionBadge';
import { ConversationalRefundDrawer } from '../components/ConversationalRefundDrawer';
import { LatestMessageLine, UnreadBadge } from '../components/LatestMessageLine';
import { useAsyncData } from '../hooks/useAsyncData';
import * as refundsApi from '../api/refunds';
import { cn } from '../lib/cn';
import { formatDateTime } from '../lib/format';
import type { RefundRequest } from '../api/types';

function RequestRow({ request, onOpen }: { request: RefundRequest; onOpen: (id: string) => void }) {
  const unread = request.unreadCount ?? 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(request.id)}
      className={cn(
        'w-full rounded-2xl border bg-white p-5 text-left transition-all hover:border-zinc-950 dark:bg-zinc-900/60 dark:hover:border-zinc-100',
        unread > 0 ? 'border-brand-300 dark:border-brand-800' : 'border-zinc-200/80 dark:border-zinc-800',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold text-zinc-950 dark:text-zinc-50">{request.reference}</span>
        <div className="flex items-center gap-2">
          <DecisionBadge decision={request.decision} />
          <StatusBadge status={request.status} />
          {request.flags.map((flag) => (
            <FlagBadge key={flag} flag={flag} />
          ))}
          <UnreadBadge count={request.unreadCount ?? 0} />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {request.orderNumber} · {request.reason.replace(/_/g, ' ').toLowerCase()} ·{' '}
        {formatDateTime(request.createdAt)}
      </p>
      <p className="mt-2.5 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">{request.decisionReason}</p>

      <LatestMessageLine request={request} viewerRole="CUSTOMER" showBadge={false} />
    </button>
  );
}

export default function RefundsPage() {
  const list = useAsyncData(() => refundsApi.listMyRequests(), []);
  const [openId, setOpenId] = useState<string | null>(null);

  function handleOpen(id: string) {
    setOpenId(id);
    // Opening the thread is what marks it read, so refresh the badge counts.
    void refundsApi.markRequestSeen(id).then(() => list.reload()).catch(() => undefined);
  }

  return (
    <>
      <PageHeader
        title="My refunds"
        description="View your active refund requests, AI explanations, and rule evaluations."
      />

      {list.loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : !list.data?.requests.length ? (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="No refund requests yet"
          description="Open an order from My orders to chat with the AI assistant and start a request."
        />
      ) : (
        <>
          {list.data.summary.total > 0 ? (
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total', value: list.data.summary.total, icon: ReceiptText },
                { label: 'Approved', value: list.data.summary.approved, icon: CheckCircle2 },
                { label: 'Denied', value: list.data.summary.denied, icon: XCircle },
                { label: 'In review', value: list.data.summary.escalated, icon: Inbox },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label} className="p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </div>
                  <p className="font-brand mt-1.5 text-2xl font-extrabold text-zinc-950 dark:text-zinc-50">{value}</p>
                </Card>
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            {list.data.requests.map((request) => (
              <RequestRow key={request.id} request={request} onOpen={handleOpen} />
            ))}
          </div>
        </>
      )}

      {/* Unified Conversational Refund Drawer */}
      <ConversationalRefundDrawer
        order={null}
        requestId={openId}
        open={Boolean(openId)}
        onClose={() => {
          setOpenId(null);
          // Customers are not in the staff queue room, so the list cannot learn
          // about new activity over the socket. Refetching on close is what
          // keeps the preview and unread count honest.
          list.reload();
        }}
        onSuccess={() => list.reload()}
      />
    </>
  );
}

