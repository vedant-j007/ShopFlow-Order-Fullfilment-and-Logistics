import { useEffect } from 'react';
import { Boxes, Inbox, LoaderCircle, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { humanize } from '../lib/format';

const TONES = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

// Order, payment, shipment, tracking-event and stock-severity statuses.
const STATUS_TONE = {
  pending: 'amber',
  confirmed: 'sky',
  shipped: 'indigo',
  delivered: 'emerald',
  cancelled: 'slate',
  completed: 'emerald',
  failed: 'rose',
  refunded: 'slate',
  label_created: 'slate',
  in_transit: 'sky',
  picked_up: 'sky',
  arrived_at_hub: 'sky',
  out_for_delivery: 'violet',
  delivery_failed: 'rose',
  low: 'amber',
  critical: 'orange',
  out_of_stock: 'rose',
  healthy: 'emerald',
};

export function StatusBadge({ status, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONES[STATUS_TONE[status] ?? 'slate']} ${className}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {humanize(status)}
    </span>
  );
}

export function Logo({ className = 'size-8' }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg bg-indigo-600 text-white shadow-sm ${className}`}>
      <Boxes className="size-[58%]" />
    </span>
  );
}

export function Spinner({ className = 'size-5' }) {
  return <LoaderCircle className={`animate-spin text-slate-400 ${className}`} />;
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <TriangleAlert className="size-8 text-rose-500" />
      <p className="text-sm text-slate-600">{error?.message ?? 'Something went wrong'}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          <RefreshCw className="size-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-slate-100">
        <Icon className="size-6 text-slate-400" />
      </span>
      <p className="mt-1 font-medium text-slate-900">{title}</p>
      {children && <div className="max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, className = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${className}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost -mr-2 px-2" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function LiveIndicator({ updatedAt }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      Live{updatedAt && ` · updated ${updatedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`}
    </span>
  );
}
