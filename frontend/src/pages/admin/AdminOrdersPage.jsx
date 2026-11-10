import { useState } from 'react';
import { Link } from 'react-router';
import { CircleX, ClipboardList, Truck } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { formatDateTime, money } from '../../lib/format';
import { paymentLabel } from '../../lib/payments';
import { useToast } from '../../context/ToastContext';
import SqlBlock from '../../components/SqlBlock';
import { EmptyState, ErrorBlock, LiveIndicator, LoadingBlock, Modal, PageHeader, Spinner, StatusBadge } from '../../components/ui';

const STATUSES = ['', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

function ShipModal({ order, carriers, onClose, onDone }) {
  const toast = useToast();
  const [carrierId, setCarrierId] = useState(carriers[0]?.carrier_id ?? '');
  const [saving, setSaving] = useState(false);

  async function ship() {
    setSaving(true);
    try {
      const shipments = await api(`/admin/orders/${order.order_id}/ship`, { method: 'POST', body: { carrier_id: Number(carrierId) } });
      toast.success(`Order #${order.order_id} shipped · ${shipments.map((s) => s.tracking_number).join(', ')}`);
      onDone();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Ship order #${order.order_id}`} onClose={onClose}>
      <p className="text-sm text-slate-600">
        Creates one shipment for each warehouse that fulfils this order. The trigger{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">trg_shipments_mark_order_shipped</code> then moves the order to <strong>shipped</strong>.
      </p>
      <label className="label mt-5" htmlFor="carrier">Carrier</label>
      <select id="carrier" className="input" value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
        {carriers.map((c) => (
          <option key={c.carrier_id} value={c.carrier_id}>
            {c.name}
          </option>
        ))}
      </select>
      <SqlBlock
        className="mt-5"
        sql={`INSERT INTO shipments (order_id, warehouse_id, carrier_id)\nSELECT DISTINCT oi.order_id, oi.warehouse_id, ${carrierId || '?'}\n  FROM order_items oi\n WHERE oi.order_id = ${order.order_id}\nON CONFLICT (order_id, warehouse_id) DO NOTHING;`}
      />
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={ship} disabled={saving || !carrierId}>
          {saving ? <Spinner className="size-4 text-white" /> : <Truck className="size-4" />} Create shipment
        </button>
      </div>
    </Modal>
  );
}

function CancelModal({ order, onClose, onDone }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function cancel() {
    setSaving(true);
    try {
      await api(`/admin/orders/${order.order_id}/cancel`, { method: 'POST' });
      toast.success(`Order #${order.order_id} cancelled · stock returned`);
      onDone();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Cancel order #${order.order_id}?`} onClose={onClose}>
      <p className="text-sm text-slate-600">
        <code className="rounded bg-slate-100 px-1 text-xs">CALL cancel_order({order.order_id})</code> restocks each line in the warehouse it
        came from and {order.payment_status === 'completed' ? 'refunds' : 'voids'} the payment, atomically.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-secondary" onClick={onClose}>Keep order</button>
        <button className="btn bg-rose-600 text-white hover:bg-rose-500" onClick={cancel} disabled={saving}>
          {saving && <Spinner className="size-4 text-white" />} Cancel order
        </button>
      </div>
    </Modal>
  );
}

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('');
  const orders = useApi(`/admin/orders${status ? `?status=${status}` : ''}`, { interval: 20000 });
  const lookups = useApi('/admin/lookups');
  const [shipping, setShipping] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const done = () => {
    setShipping(null);
    setCancelling(null);
    orders.reload();
  };

  return (
    <div>
      <PageHeader title="Orders" subtitle="Rows come from the order_summary view." actions={<LiveIndicator updatedAt={orders.updatedAt} />} />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap capitalize transition ${
              status === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {orders.error && !orders.data && <ErrorBlock error={orders.error} onRetry={orders.reload} />}
      {!orders.data && !orders.error && <LoadingBlock label="Loading orders…" />}
      {orders.data && (
        <div className={`card overflow-hidden ${orders.loading ? 'opacity-70' : ''}`}>
          {orders.data.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No orders with this status" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Order</th>
                    <th className="th">Customer</th>
                    <th className="th text-right">Items</th>
                    <th className="th text-right">Total</th>
                    <th className="th">Payment</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.data.map((o) => (
                    <tr key={o.order_id} className="hover:bg-slate-50/60">
                      <td className="td whitespace-nowrap">
                        <p className="font-medium text-slate-900">#{o.order_id}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(o.order_date)}</p>
                      </td>
                      <td className="td">
                        <p className="font-medium whitespace-nowrap text-slate-900">{o.customer_name}</p>
                        <p className="text-xs whitespace-nowrap text-slate-500">
                          {o.city} · {o.pincode}
                        </p>
                      </td>
                      <td className="td text-right">{o.item_count}</td>
                      <td className="td text-right font-medium whitespace-nowrap">{money(o.order_total)}</td>
                      <td className="td whitespace-nowrap">
                        <p className="text-xs text-slate-600">{paymentLabel(o.payment_method)}</p>
                        <StatusBadge status={o.payment_status} className="mt-1" />
                      </td>
                      <td className="td">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="td text-right whitespace-nowrap">
                        {(o.status === 'pending' || o.status === 'confirmed') && (
                          <div className="flex justify-end gap-2">
                            <button className="btn btn-ghost px-2 text-slate-400 hover:text-rose-600" onClick={() => setCancelling(o)} aria-label={`Cancel order ${o.order_id}`} title="Cancel order">
                              <CircleX className="size-4" />
                            </button>
                            <button className="btn btn-primary py-1.5" onClick={() => setShipping(o)} disabled={!lookups.data}>
                              <Truck className="size-4" /> Ship
                            </button>
                          </div>
                        )}
                        {o.shipment_count > 0 && (
                          <Link to="/admin/shipments" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                            {o.shipment_count} shipment{o.shipment_count === 1 ? '' : 's'}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {shipping && <ShipModal order={shipping} carriers={lookups.data.carriers} onClose={() => setShipping(null)} onDone={done} />}
      {cancelling && <CancelModal order={cancelling} onClose={() => setCancelling(null)} onDone={done} />}
    </div>
  );
}
