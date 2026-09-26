import { useState } from 'react';
import { Package, ReceiptText, Tag } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ConversationalRefundDrawer } from '../components/ConversationalRefundDrawer';
import { LatestMessageLine } from '../components/LatestMessageLine';
import { useAsyncData } from '../hooks/useAsyncData';
import * as refundsApi from '../api/refunds';
import { formatDate } from '../lib/format';
import type { Order, RefundRequest } from '../api/types';

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  PAID: 'neutral',
  SHIPPED: 'info',
  DELIVERED: 'success',
  RETURNED: 'warning',
  CANCELLED: 'danger',
};

function OrderCard({
  order,
  request,
  onRequest,
}: {
  order: Order;
  request?: RefundRequest;
  onRequest: (order: Order) => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-zinc-950 dark:text-zinc-50">{order.orderNumber}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Placed {formatDate(order.placedAt)}
            {order.deliveredAt ? ` · delivered ${formatDate(order.deliveredAt)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[order.status] ?? 'neutral'}>{order.status}</Badge>
          <span className="text-sm font-bold text-zinc-950 dark:text-zinc-50">{order.total}</span>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {order.items.map((item) => (
          <li key={item.sku} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 text-zinc-700 dark:text-zinc-300">
              <span className="font-medium text-zinc-900 dark:text-zinc-50">{item.name}</span>
              <span className="text-zinc-500 dark:text-zinc-400"> · ×{item.quantity}</span>
              {item.finalSale ? (
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                  <Tag className="size-3" aria-hidden="true" />
                  Final sale
                </span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
              ${((item.unitAmountCents * item.quantity) / 100).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      {order.shippingCents > 0 ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Shipping ${(order.shippingCents / 100).toFixed(2)} · non-refundable
        </p>
      ) : null}
      {order.refundedCents > 0 ? (
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">Already refunded {order.refunded}</p>
      ) : null}

      {request ? <LatestMessageLine request={request} viewerRole="CUSTOMER" /> : null}

      <div className="mt-4 flex items-center justify-between gap-3">
       
        <Button size="sm" variant="secondary" onClick={() => onRequest(order)}>
          <ReceiptText className="size-3.5" aria-hidden="true" />
          {request ? 'Open conversation' : 'Request a refund'}
        </Button>
      </div>
    </Card>
  );
}

export default function OrdersPage() {
  const data = useAsyncData(async () => {
    const [ordersRes, requestsRes] = await Promise.all([
      refundsApi.listMyOrders(),
      refundsApi.listMyRequests(),
    ]);
    return {
      orders: ordersRes.orders,
      requests: requestsRes.requests,
    };
  }, []);

  const [targetOrder, setTargetOrder] = useState<Order | null>(null);
  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);

  function handleRequest(order: Order) {
    const existing = data.data?.requests.find((r) => r.orderNumber === order.orderNumber);
    if (existing) {
      setTargetRequestId(existing.id);
      setTargetOrder(null);
      void refundsApi.markRequestSeen(existing.id).then(() => data.reload()).catch(() => undefined);
    } else {
      setTargetOrder(order);
      setTargetRequestId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="My orders"
        description="Select an order to chat with our AI refund assistant. Final sale items and shipping fees are excluded."
      />

      {data.loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : !data.data?.orders.length ? (
        <EmptyState
          icon={<Package className="size-5" />}
          title="No orders yet"
          description="Once an order is attached to your account it will appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.data.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              request={data.data?.requests.find((r) => r.orderNumber === order.orderNumber)}
              onRequest={handleRequest}
            />
          ))}
        </div>
      )}

      {/* Interactive Chat-Driven Refund Drawer */}
      <ConversationalRefundDrawer
        order={targetOrder}
        requestId={targetRequestId}
        open={Boolean(targetOrder) || Boolean(targetRequestId)}
        onClose={() => {
          setTargetOrder(null);
          setTargetRequestId(null);
          // Customers are not in the staff queue room, so the list cannot learn
          // about new activity over the socket. Refetching on close keeps the
          // preview line and unread count on the card honest.
          data.reload();
        }}
        onSuccess={() => data.reload()}
      />
    </>
  );
}

