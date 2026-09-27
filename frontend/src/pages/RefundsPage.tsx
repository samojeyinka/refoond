import { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Inbox, ReceiptText, Search, SlidersHorizontal, XCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
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
import type { RefundDecision, RefundRequest, RefundStatus } from '../api/types';

type FilterValue = 'ALL' | RefundDecision | RefundStatus;
type SortValue = 'NEWEST' | 'OLDEST' | 'AMOUNT_HIGH' | 'AMOUNT_LOW';

function RequestRow({ request, onOpen }: { request: RefundRequest; onOpen: (id: string) => void }) {
  const unread = request.unreadCount ?? 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(request.id)}
      className={cn(
        'grid w-full gap-3 px-5 py-5 text-left transition-colors hover:bg-[#f8f6f1] dark:hover:bg-white/5 md:grid-cols-[minmax(170px,1fr)_minmax(200px,1.25fr)_auto_auto_28px] md:items-center',
        unread > 0 && 'bg-[#fff8f3] dark:bg-[#e86438]/5',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-[#1d241f] dark:text-white">{request.reference}</span>
          <UnreadBadge count={unread} />
        </div>
        <p className="mt-1 text-xs text-[#657068] dark:text-[#c4c9c3]">{request.orderNumber} · {formatDateTime(request.createdAt)}</p>
      </div>
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-medium text-[#1d241f] dark:text-white">{request.decisionReason}</p>
        <p className="mt-1 text-xs capitalize text-[#657068] dark:text-[#c4c9c3]">{request.reason.replace(/_/g, ' ').toLowerCase()}</p>
        <LatestMessageLine request={request} viewerRole="CUSTOMER" showBadge={false} />
      </div>
      <div className="flex flex-wrap gap-1.5 md:justify-end"><DecisionBadge decision={request.decision} /> <StatusBadge status={request.status} /></div>
      <div className="flex flex-wrap gap-1.5 md:justify-end">{request.flags.map((flag) => <FlagBadge key={flag} flag={flag} />)}</div>
      <ArrowUpRight className="hidden size-4 text-[#657068] md:block dark:text-[#c4c9c3]" aria-hidden="true" />
    </button>
  );
}

export default function RefundsPage() {
  const list = useAsyncData(() => refundsApi.listMyRequests(), []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [sort, setSort] = useState<SortValue>('NEWEST');

  const filteredRequests = useMemo(() => {
    const requests = list.data?.requests ?? [];
    const search = query.trim().toLowerCase();
    const result = requests.filter((request) => {
      const matchesSearch = !search || [request.reference, request.orderNumber, request.reason, request.decisionReason].some((value) => value.toLowerCase().includes(search));
      const matchesFilter = filter === 'ALL' || request.decision === filter || request.status === filter;
      return matchesSearch && matchesFilter;
    });
    return [...result].sort((a, b) => {
      if (sort === 'OLDEST') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === 'AMOUNT_HIGH') return Number(b.requestedAmount.replace(/[^0-9.]/g, '')) - Number(a.requestedAmount.replace(/[^0-9.]/g, ''));
      if (sort === 'AMOUNT_LOW') return Number(a.requestedAmount.replace(/[^0-9.]/g, '')) - Number(b.requestedAmount.replace(/[^0-9.]/g, ''));
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filter, list.data?.requests, query, sort]);

  function handleOpen(id: string) {
    setOpenId(id);
    void refundsApi.markRequestSeen(id).then(() => list.reload()).catch(() => undefined);
  }

  return <>
    <div className="mb-7 rounded-3xl border border-[#1d241f]/10 bg-white/70 px-5 py-6 shadow-sm sm:px-7 dark:border-white/10 dark:bg-white/5">
      <PageHeader title="My refunds" description="Track refund decisions, conversations, and any actions that need your attention." />
    </div>

    {list.loading ? <div className="space-y-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-24 rounded-2xl" />)}</div> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data?.requests.length ? <EmptyState icon={<Inbox className="size-5" />} title="No refund requests yet" description="Open an order from My orders to chat with the AI assistant and start a request." /> : <>
      <div className="mb-5 grid divide-y divide-[#1d241f]/10 rounded-2xl border border-[#1d241f]/10 bg-white/55 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
        {[
          { label: 'Total requests', value: list.data.summary.total, icon: ReceiptText },
          { label: 'Approved', value: list.data.summary.approved, icon: CheckCircle2 },
          { label: 'Denied', value: list.data.summary.denied, icon: XCircle },
          { label: 'In review', value: list.data.summary.escalated, icon: Inbox },
        ].map(({ label, value, icon: Icon }) => <div key={label} className="px-4 py-4 sm:px-5"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-[#657068] dark:text-[#c4c9c3]"><Icon className="size-3.5 text-[#e86438]" />{label}</p><p className="font-brand mt-2 text-3xl font-black tracking-[-.05em] text-[#1d241f] dark:text-white">{value}</p></div>)}
      </div>

      <section className="overflow-hidden rounded-3xl border border-[#1d241f]/10 bg-white/75 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-4 border-b border-[#1d241f]/10 p-4 sm:p-5 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-[#e86438]" /><div><h2 className="text-sm font-bold text-[#1d241f] dark:text-white">Refund register</h2><p className="text-xs text-[#657068] dark:text-[#c4c9c3]">{filteredRequests.length} of {list.data.requests.length} requests</p></div></div>
          <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_150px_150px] lg:w-[590px]">
            <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#657068] dark:text-[#c4c9c3]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference or order" className="h-10 w-full rounded-xl border border-[#1d241f]/10 bg-[#f8f6f1] pl-9 pr-3 text-sm outline-none transition focus:border-[#e86438] focus:ring-2 focus:ring-[#e86438]/15 dark:border-white/10 dark:bg-white/5" /></label>
            <select value={filter} onChange={(event) => setFilter(event.target.value as FilterValue)} aria-label="Filter refund requests" className="h-10 rounded-xl border border-[#1d241f]/10 bg-[#f8f6f1] px-3 text-sm outline-none transition focus:border-[#e86438] dark:border-white/10 dark:bg-white/5"><option value="ALL">All requests</option><option value="APPROVED">Approved</option><option value="DENIED">Denied</option><option value="ESCALATED">Needs review</option><option value="COMPLETED">Completed</option><option value="AWAITING_REVIEW">Awaiting review</option><option value="RESOLVED">Resolved</option></select>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortValue)} aria-label="Sort refund requests" className="h-10 rounded-xl border border-[#1d241f]/10 bg-[#f8f6f1] px-3 text-sm outline-none transition focus:border-[#e86438] dark:border-white/10 dark:bg-white/5"><option value="NEWEST">Newest first</option><option value="OLDEST">Oldest first</option><option value="AMOUNT_HIGH">Amount: high to low</option><option value="AMOUNT_LOW">Amount: low to high</option></select>
          </div>
        </div>
        <div className="hidden grid-cols-[minmax(170px,1fr)_minmax(200px,1.25fr)_auto_auto_28px] gap-3 border-b border-[#1d241f]/10 bg-[#f8f6f1] px-5 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-[#657068] md:grid dark:border-white/10 dark:bg-white/5 dark:text-[#c4c9c3]"><span>Reference</span><span>Decision notes</span><span className="text-right">Decision</span><span className="text-right">Flags</span><span /></div>
        {filteredRequests.length ? <div className="divide-y divide-[#1d241f]/10 dark:divide-white/10">{filteredRequests.map((request) => <RequestRow key={request.id} request={request} onOpen={handleOpen} />)}</div> : <div className="px-6 py-14 text-center"><p className="font-semibold text-[#1d241f] dark:text-white">No requests match those filters.</p><button type="button" onClick={() => { setQuery(''); setFilter('ALL'); }} className="mt-2 text-sm font-semibold text-[#e86438] hover:underline">Clear filters</button></div>}
      </section>
    </>}

    <ConversationalRefundDrawer order={null} requestId={openId} open={Boolean(openId)} onClose={() => { setOpenId(null); list.reload(); }} onSuccess={() => list.reload()} />
  </>;
}
