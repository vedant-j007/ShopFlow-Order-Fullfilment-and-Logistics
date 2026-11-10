import { useState } from 'react';
import { ArrowRight, MapPin, Send, Truck } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { formatDateTime, humanize, timeAgo } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { ErrorBlock, LiveIndicator, LoadingBlock, Modal, PageHeader, Spinner, StatusBadge } from '../../components/ui';

const COLUMNS = ['label_created', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];
const COLLAPSED_LIMIT = 6;

// Values allowed by the CHECK constraint chk_event_status on TRACKING_EVENTS.
const EVENT_STATUSES = ['picked_up', 'in_transit', 'arrived_at_hub', 'out_for_delivery', 'delivered', 'delivery_failed'];
const NEXT_EVENT = {
  none: 'picked_up',
  picked_up: 'arrived_at_hub',
  in_transit: 'arrived_at_hub',
  arrived_at_hub: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivery_failed: 'out_for_delivery',
};

function suggestedLocation(status, shipment) {
  if (status === 'picked_up') return shipment.warehouse;
  if (status === 'in_transit' || status === 'arrived_at_hub') return `Sorting hub, ${shipment.destination}`;
  return shipment.destination;
}

function ShipmentModal({ shipment, onClose, onUpdated }) {
  const toast = useToast();
  const events = useApi(`/admin/shipments/${shipment.shipment_id}/events`);
  const [status, setStatus] = useState(NEXT_EVENT[shipment.last_event ?? 'none']);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  async function addEvent(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api(`/admin/shipments/${shipment.shipment_id}/events`, {
        method: 'POST',
        body: { status, location: location.trim() || suggestedLocation(status, shipment) },
      });
      toast.success(`Shipment is now ${humanize(result.shipment_status).toLowerCase()} · order #${result.order_id} is ${result.order_status}`);
      onUpdated();
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal title={shipment.tracking_number} onClose={onClose} className="max-w-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-slate-600">
          Order #{shipment.order_id} · {shipment.customer} · {shipment.carrier}
        </p>
        <StatusBadge status={shipment.status} />
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
        {shipment.warehouse} <ArrowRight className="size-3.5" /> {shipment.destination}
      </p>

      <h3 className="mt-6 mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase">Tracking events</h3>
      {!events.data ? (
        <Spinner />
      ) : events.data.length === 0 ? (
        <p className="text-sm text-slate-500">No events yet. Label created {formatDateTime(shipment.created_at)}.</p>
      ) : (
        <ol className="space-y-2">
          {[...events.data].reverse().map((ev) => (
            <li key={ev.event_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <StatusBadge status={ev.status} />
              <span className="text-slate-700">{ev.location}</span>
              <time className="ml-auto text-xs text-slate-500">{formatDateTime(ev.event_time)}</time>
            </li>
          ))}
        </ol>
      )}

      {shipment.status === 'delivered' ? (
        <p className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Delivered. No further events can be added.</p>
      ) : (
        <form onSubmit={addEvent} className="mt-6 rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-900">Add tracking event</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Trigger <code>trg_tracking_events_sync_status</code> updates the shipment, and marks the order delivered when every shipment is.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="event-status">Status</label>
              <select id="event-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {EVENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="event-location">Location</label>
              <input
                id="event-location"
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={suggestedLocation(status, shipment)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Spinner className="size-4 text-white" /> : <Send className="size-4" />} Record event
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ShipmentCard({ shipment, onOpen }) {
  return (
    <button onClick={onOpen} className="card block w-full p-3.5 text-left transition hover:border-indigo-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-slate-500">{shipment.tracking_number}</span>
        <span className="text-xs text-slate-400">#{shipment.order_id}</span>
      </div>
      <p className="mt-2 truncate text-sm font-medium text-slate-900">{shipment.customer}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
        <MapPin className="size-3.5 shrink-0" />
        <span className="truncate">
          {shipment.warehouse.split(' - ')[0]} → {shipment.destination}
        </span>
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
        <Truck className="size-3.5 shrink-0" />
        <span className="truncate">{shipment.carrier}</span>
      </p>
      <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
        {shipment.last_event ? (
          <>
            <span className="font-medium text-slate-700">{humanize(shipment.last_event)}</span> · {timeAgo(shipment.last_event_time)}
          </>
        ) : (
          <>Label created · {timeAgo(shipment.created_at)}</>
        )}
      </div>
    </button>
  );
}

export default function ShipmentsPage() {
  const shipments = useApi('/admin/shipments', { interval: 15000 });
  const [openId, setOpenId] = useState(null);
  const [expanded, setExpanded] = useState({});

  if (shipments.error && !shipments.data) return <ErrorBlock error={shipments.error} onRetry={shipments.reload} />;
  if (!shipments.data) return <LoadingBlock label="Loading shipments…" />;

  const open = shipments.data.find((s) => s.shipment_id === openId);

  return (
    <div>
      <PageHeader
        title="Shipment board"
        subtitle="Click a shipment to see its timeline and record the next tracking event."
        actions={<LiveIndicator updatedAt={shipments.updatedAt} />}
      />

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {COLUMNS.map((status) => {
          const cards = shipments.data.filter((s) => s.status === status);
          const visible = expanded[status] ? cards : cards.slice(0, COLLAPSED_LIMIT);
          return (
            <section key={status} className="flex w-64 shrink-0 flex-col rounded-2xl bg-slate-100/80 p-3 xl:w-auto xl:min-w-0 xl:flex-1 xl:shrink">
              <header className="mb-3 flex items-center justify-between px-1">
                <StatusBadge status={status} />
                <span className="text-xs font-medium text-slate-500 tabular-nums">{cards.length}</span>
              </header>
              <div className="space-y-2.5">
                {visible.map((s) => (
                  <ShipmentCard key={s.shipment_id} shipment={s} onOpen={() => setOpenId(s.shipment_id)} />
                ))}
                {cards.length === 0 && <p className="px-1 py-6 text-center text-xs text-slate-400">Nothing here</p>}
                {cards.length > COLLAPSED_LIMIT && (
                  <button
                    className="btn btn-ghost w-full text-xs"
                    onClick={() => setExpanded((e) => ({ ...e, [status]: !e[status] }))}
                  >
                    {expanded[status] ? 'Show less' : `Show ${cards.length - COLLAPSED_LIMIT} more`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {open && (
        <ShipmentModal
          key={`${open.shipment_id}-${open.last_event_time}`}
          shipment={open}
          onClose={() => setOpenId(null)}
          onUpdated={() => {
            setOpenId(null);
            shipments.reload();
          }}
        />
      )}
    </div>
  );
}
