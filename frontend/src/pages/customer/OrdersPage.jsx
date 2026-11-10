import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Package } from 'lucide-react';
import { useApi } from '../../lib/useApi';
import { formatDate, money } from '../../lib/format';
import { paymentLabel } from '../../lib/payments';
import OrderProgress from '../../components/OrderProgress';
import { EmptyState, ErrorBlock, LiveIndicator, LoadingBlock, PageHeader, StatusBadge } from '../../components/ui';

const FILTERS = [
  ['all', 'All'],
  ['active', 'In progress'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];
const IN_PROGRESS = new Set(['pending', 'confirmed', 'shipped']);

export default function OrdersPage() {
  const orders = useApi('/orders', { interval: 15000 });
  const [filter, setFilter] = useState('all');

  const visible = (orders.data ?? []).filter(
    (o) => filter === 'all' || (filter === 'active' ? IN_PROGRESS.has(o.status) : o.status === filter),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="My orders" subtitle="Statuses refresh automatically." actions={<LiveIndicator updatedAt={orders.updatedAt} />} />

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
              filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {orders.error && !orders.data && <ErrorBlock error={orders.error} onRetry={orders.reload} />}
      {!orders.data && !orders.error && <LoadingBlock label="Loading your orders…" />}
      {orders.data && visible.length === 0 && (
        <div className="card">
          <EmptyState icon={Package} title={filter === 'all' ? 'No orders yet' : 'No orders in this view'}>
            {filter === 'all' && (
              <Link to="/" className="btn btn-primary mt-3">
                Start shopping
              </Link>
            )}
          </EmptyState>
        </div>
      )}

      <ul className="space-y-3">
        {visible.map((o) => (
          <li key={o.order_id}>
            <Link to={`/orders/${o.order_id}`} className="card block p-5 transition hover:border-indigo-200 hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Order #{o.order_id}</p>
                  <p className="text-sm text-slate-500">
                    {formatDate(o.order_date)} · {o.item_count} item{o.item_count === 1 ? '' : 's'} · {paymentLabel(o.payment_method)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={o.status} />
                  <p className="font-semibold tabular-nums">{money(o.order_total)}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-1 text-sm text-slate-600">{o.preview}</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex-1">
                  <OrderProgress status={o.status} compact />
                </div>
                <span className="flex items-center text-sm font-medium text-indigo-600">
                  {IN_PROGRESS.has(o.status) ? 'Track' : 'Details'} <ChevronRight className="size-4" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
