import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, CircleX, MapPin, PackageSearch, Truck, Warehouse } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { formatDateTime, humanize, money } from '../../lib/format';
import { paymentLabel } from '../../lib/payments';
import { useToast } from '../../context/ToastContext';
import CategoryArt from '../../components/CategoryArt';
import OrderProgress from '../../components/OrderProgress';
import { EmptyState, ErrorBlock, LiveIndicator, LoadingBlock, Modal, Spinner, StatusBadge } from '../../components/ui';

const DOT = {
  emerald: 'bg-emerald-500 ring-emerald-100',
  rose: 'bg-rose-500 ring-rose-100',
  indigo: 'bg-indigo-500 ring-indigo-100',
  slate: 'bg-slate-300 ring-slate-100',
};

function TimelineItem({ title, subtitle, time, tone, emphasis, last }) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute top-3 left-[4.5px] h-full w-px bg-slate-200" />}
      <span className={`relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ${DOT[tone]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap justify-between gap-x-3">
          <p className={`text-sm ${emphasis ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{title}</p>
          <time className="text-xs text-slate-500">{formatDateTime(time)}</time>
        </div>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </li>
  );
}

function ShipmentCard({ shipment, destination }) {
  const events = [...shipment.events].reverse();
  const toneFor = (status, i) =>
    status === 'delivered' ? 'emerald' : status === 'delivery_failed' ? 'rose' : i === 0 ? 'indigo' : 'slate';

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-medium text-slate-900">
            <Truck className="size-4 text-slate-400" /> {shipment.carrier}
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{shipment.tracking_number}</p>
        </div>
        <StatusBadge status={shipment.status} />
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
        <span className="flex items-center gap-1.5">
          <Warehouse className="size-4 text-slate-400" /> {shipment.warehouse}
        </span>
        <ArrowRight className="size-3.5 text-slate-300" />
        <span className="flex items-center gap-1.5">
          <MapPin className="size-4 text-slate-400" /> {destination}
        </span>
      </p>
      <ol className="mt-5">
        {events.map((ev, i) => (
          <TimelineItem
            key={ev.event_id}
            title={humanize(ev.status)}
            subtitle={ev.location}
            time={ev.event_time}
            tone={toneFor(ev.status, i)}
            emphasis={i === 0}
          />
        ))}
        <TimelineItem
          title="Shipment created"
          subtitle={`Label generated at ${shipment.warehouse}`}
          time={shipment.created_at}
          tone={events.length ? 'slate' : 'indigo'}
          emphasis={!events.length}
          last
        />
      </ol>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const { data: order, error, reload, updatedAt } = useApi(`/orders/${id}`, { interval: 10000 });
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (error && !order) return <ErrorBlock error={error} onRetry={reload} />;
  if (!order) return <LoadingBlock label="Loading order…" />;

  const cancellable = order.status === 'pending' || order.status === 'confirmed';
  const deliveredAt = order.shipments
    .flatMap((s) => s.events)
    .filter((e) => e.status === 'delivered')
    .map((e) => e.event_time)
    .sort()
    .at(-1);
  const stepDates = [order.order_date, order.paid_at, order.shipments[0]?.created_at, deliveredAt];

  async function cancelOrder() {
    setCancelling(true);
    try {
      await api(`/orders/${id}/cancel`, { method: 'POST' });
      toast.success(`Order #${id} cancelled. Items were returned to stock.`);
      setConfirming(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> All orders
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Order #{order.order_id}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">Placed {formatDateTime(order.order_date)}</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator updatedAt={updatedAt} />
          {cancellable && (
            <button className="btn btn-danger" onClick={() => setConfirming(true)}>
              <CircleX className="size-4" /> Cancel order
            </button>
          )}
        </div>
      </div>

      {order.status === 'cancelled' ? (
        <div className="card mb-6 border-rose-200 bg-rose-50/60 p-5 text-sm text-rose-800">
          This order was cancelled. Reserved stock went back to its warehouse and the payment is marked{' '}
          <strong>{order.payment_status}</strong>.
        </div>
      ) : (
        <div className="card mb-6 px-4 py-6 sm:px-8">
          <OrderProgress status={order.status} dates={stepDates} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Tracking</h2>
            {order.shipments.length === 0 ? (
              <EmptyState icon={PackageSearch} title="Not shipped yet">
                Tracking appears here once the warehouse hands your parcel to a carrier.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {order.shipments.map((s) => (
                  <ShipmentCard key={s.shipment_id} shipment={s} destination={order.city} />
                ))}
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="px-5 pt-5 pb-3 font-semibold">Items</h2>
            <ul className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <li key={item.order_item_id} className="flex items-center gap-4 px-5 py-3">
                  <CategoryArt category={item.category} className="size-12 rounded-lg" iconClassName="size-5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.quantity} × {money(item.unit_price)} · ships from {item.warehouse}
                    </p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{money(item.line_total)}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="card h-fit divide-y divide-slate-100">
          <div className="p-5">
            <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Deliver to</h3>
            <p className="mt-2 text-sm font-medium text-slate-900">{order.city}</p>
            <p className="text-sm text-slate-600">
              {order.line1}, {order.state} {order.pincode}
            </p>
          </div>
          <div className="p-5">
            <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Payment</h3>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-sm text-slate-900">{paymentLabel(order.payment_method)}</p>
              <StatusBadge status={order.payment_status} />
            </div>
            {order.paid_at && <p className="mt-1 text-xs text-slate-500">Paid {formatDateTime(order.paid_at)}</p>}
          </div>
          <div className="space-y-2 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Items</span>
              <span className="tabular-nums">{order.item_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Shipping</span>
              <span className="text-emerald-600">Free</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(order.order_total)}</span>
            </div>
          </div>
        </aside>
      </div>

      {confirming && (
        <Modal title={`Cancel order #${order.order_id}?`} onClose={() => setConfirming(false)}>
          <p className="text-sm text-slate-600">
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">cancel_order()</code> returns every item to the warehouse it was
            reserved from and {order.payment_status === 'completed' ? 'refunds your payment' : 'voids the pending payment'}. This can't be undone.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setConfirming(false)}>
              Keep order
            </button>
            <button className="btn bg-rose-600 text-white hover:bg-rose-500" onClick={cancelOrder} disabled={cancelling}>
              {cancelling && <Spinner className="size-4 text-white" />} Cancel order
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
