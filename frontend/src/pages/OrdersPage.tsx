import { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Package, ReceiptText, Search, SlidersHorizontal, Truck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ConversationalRefundDrawer } from '../components/ConversationalRefundDrawer';
import { LatestMessageLine } from '../components/LatestMessageLine';
import { useAsyncData } from '../hooks/useAsyncData';
import * as refundsApi from '../api/refunds';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/format';
import type { Order, RefundRequest } from '../api/types';

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = { PAID: 'neutral', SHIPPED: 'info', DELIVERED: 'success', RETURNED: 'warning', CANCELLED: 'danger' };
type SortValue = 'NEWEST' | 'OLDEST' | 'TOTAL_HIGH' | 'TOTAL_LOW';

function OrderRow({ order, request, onRequest }: { order: Order; request?: RefundRequest; onRequest: (order: Order) => void }) {
  const itemSummary = order.items.slice(0, 2).map((item) => `${item.name} ×${item.quantity}`).join(', ');
  const additionalItems = order.items.length - 2;
  return <div className={cn('grid gap-3 px-5 py-5 transition-colors hover:bg-[#f8f6f1] dark:hover:bg-white/5 md:grid-cols-[minmax(170px,.9fr)_minmax(220px,1.35fr)_auto_auto] md:items-center', request && 'bg-[#fff8f3] dark:bg-[#e86438]/5')}>
    <div className="min-w-0"><p className="font-mono text-sm font-bold text-[#1d241f] dark:text-white">{order.orderNumber}</p><p className="mt-1 text-xs text-[#657068] dark:text-[#c4c9c3]">Placed {formatDate(order.placedAt)}{order.deliveredAt ? ` · delivered ${formatDate(order.deliveredAt)}` : ''}</p></div>
    <div className="min-w-0"><p className="line-clamp-1 text-sm font-medium text-[#1d241f] dark:text-white">{itemSummary}{additionalItems > 0 ? ` +${additionalItems} more` : ''}</p><div className="mt-1 flex flex-wrap gap-1.5">{order.items.some((item) => item.finalSale) ? <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Includes final sale item</span> : <span className="text-xs text-[#657068] dark:text-[#c4c9c3]">{order.items.length} item{order.items.length === 1 ? '' : 's'}</span>}{request ? <LatestMessageLine request={request} viewerRole="CUSTOMER" /> : null}</div></div>
    <div className="flex items-center gap-2 md:justify-end"><Badge variant={STATUS_VARIANT[order.status] ?? 'neutral'}>{order.status}</Badge><span className="font-brand text-lg font-bold tracking-tight text-[#1d241f] dark:text-white">{order.total}</span></div>
    <div className="flex md:justify-end"><Button size="sm" variant="secondary" onClick={() => onRequest(order)} className="whitespace-nowrap">{request ? 'Open conversation' : 'Request a refund'} <ArrowUpRight className="size-3.5" aria-hidden="true" /></Button></div>
  </div>;
}

export default function OrdersPage() {
  const data = useAsyncData(async () => { const [ordersRes, requestsRes] = await Promise.all([refundsApi.listMyOrders(), refundsApi.listMyRequests()]); return { orders: ordersRes.orders, requests: requestsRes.requests }; }, []);
  const [targetOrder, setTargetOrder] = useState<Order | null>(null);
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState<SortValue>('NEWEST');
  const visibleOrders = useMemo(() => {
    const search = query.trim().toLowerCase();
    return [...(data.data?.orders ?? [])].filter((order) => (status === 'ALL' || order.status === status) && (!search || [order.orderNumber, ...order.items.map((item) => item.name)].some((value) => value.toLowerCase().includes(search)))).sort((a, b) => {
      if (sort === 'OLDEST') return new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime();
      if (sort === 'TOTAL_HIGH') return b.totalCents - a.totalCents;
      if (sort === 'TOTAL_LOW') return a.totalCents - b.totalCents;
      return new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime();
    });
  }, [data.data?.orders, query, sort, status]);
  function handleRequest(order: Order) { const existing = data.data?.requests.find((request) => request.orderNumber === order.orderNumber); if (existing) { setTargetRequestId(existing.id); setTargetOrder(null); void refundsApi.markRequestSeen(existing.id).then(() => data.reload()).catch(() => undefined); } else { setTargetOrder(order); setTargetRequestId(null); } }
  const summary = { total: data.data?.orders.length ?? 0, delivered: data.data?.orders.filter((order) => order.status === 'DELIVERED').length ?? 0, transit: data.data?.orders.filter((order) => order.status === 'SHIPPED').length ?? 0, conversations: data.data?.requests.length ?? 0 };

  return <>
    <div className="mb-7 rounded-3xl border border-[#1d241f]/10 bg-white/70 px-5 py-6 shadow-sm sm:px-7 dark:border-white/10 dark:bg-white/5">
      <PageHeader title="My orders" description="Review purchases, follow delivery status, or open an order’s refund conversation." /></div>

      
    {data.loading ? <div className="space-y-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-24 rounded-2xl" />)}</div> : data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : !data.data?.orders.length ? <EmptyState icon={<Package className="size-5" />} title="No orders yet" description="Once an order is attached to your account it will appear here." /> : <>
      <div className="mb-5 grid divide-y divide-[#1d241f]/10 rounded-2xl border border-[#1d241f]/10 bg-white/55 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-white/10 dark:border-white/10 dark:bg-white/5">{[{ label: 'All orders', value: summary.total, icon: Package }, { label: 'Delivered', value: summary.delivered, icon: CheckCircle2 }, { label: 'In transit', value: summary.transit, icon: Truck }, { label: 'Refund threads', value: summary.conversations, icon: ReceiptText }].map(({ label, value, icon: Icon }) => <div key={label} className="px-4 py-4 sm:px-5"><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.13em] text-[#657068] dark:text-[#c4c9c3]"><Icon className="size-3.5 text-[#e86438]" />{label}</p><p className="font-brand mt-2 text-3xl font-black tracking-[-.05em] text-[#1d241f] dark:text-white">{value}</p></div>)}</div>
      <section className="overflow-hidden rounded-3xl border border-[#1d241f]/10 bg-white/75 dark:border-white/10 dark:bg-white/5"><div className="flex flex-col gap-4 border-b border-[#1d241f]/10 p-4 sm:p-5 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-[#e86438]" /><div><h2 className="text-sm font-bold text-[#1d241f] dark:text-white">Order register</h2><p className="text-xs text-[#657068] dark:text-[#c4c9c3]">{visibleOrders.length} of {data.data.orders.length} orders</p></div></div><div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_150px_150px] lg:w-[590px]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#657068] dark:text-[#c4c9c3]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order or item" className="h-10 w-full rounded-xl border border-[#1d241f]/10 bg-[#f8f6f1] pl-9 pr-3 text-sm outline-none transition focus:border-[#e86438] focus:ring-2 focus:ring-[#e86438]/15 dark:border-white/10 dark:bg-white/5" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter orders" className="h-10 rounded-xl border border-[#1d241f]/10 bg-[#f8f6f1] px-3 text-sm outline-none transition focus:border-[#e86438] dark:border-white/10 dark:bg-white/5"><option value="ALL">All statuses</option><option value="PAID">Paid</option><option value="SHIPPED">Shipped</option><option value="DELIVERED">Delivered</option><option value="RETURNED">Returned</option><option value="CANCELLED">Cancelled</option></select><select value={sort} onChange={(event) => setSort(event.target.value as SortValue)} aria-label="Sort orders" className="h-10 rounded-xl border border-[#1d241f]/10 bg-[#f8f6f1] px-3 text-sm outline-none transition focus:border-[#e86438] dark:border-white/10 dark:bg-white/5"><option value="NEWEST">Newest first</option><option value="OLDEST">Oldest first</option><option value="TOTAL_HIGH">Total: high to low</option><option value="TOTAL_LOW">Total: low to high</option></select></div></div><div className="hidden grid-cols-[minmax(170px,.9fr)_minmax(220px,1.35fr)_auto_auto] gap-3 border-b border-[#1d241f]/10 bg-[#f8f6f1] px-5 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-[#657068] md:grid dark:border-white/10 dark:bg-white/5 dark:text-[#c4c9c3]"><span>Order</span><span>Items</span><span className="text-right">Status & total</span><span className="text-right">Action</span></div>{visibleOrders.length ? <div className="divide-y divide-[#1d241f]/10 dark:divide-white/10">{visibleOrders.map((order) => <OrderRow key={order.id} order={order} request={data.data.requests.find((request) => request.orderNumber === order.orderNumber)} onRequest={handleRequest} />)}</div> : <div className="px-6 py-14 text-center"><p className="font-semibold text-[#1d241f] dark:text-white">No orders match those filters.</p><button type="button" onClick={() => { setQuery(''); setStatus('ALL'); }} className="mt-2 text-sm font-semibold text-[#e86438] hover:underline">Clear filters</button></div>}</section>
    </>}
    <ConversationalRefundDrawer order={targetOrder} requestId={targetRequestId} open={Boolean(targetOrder) || Boolean(targetRequestId)} onClose={() => { setTargetOrder(null); setTargetRequestId(null); data.reload(); }} onSuccess={() => data.reload()} />
  </>;
}
