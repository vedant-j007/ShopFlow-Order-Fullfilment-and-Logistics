import { Check } from 'lucide-react';
import { formatDateTime } from '../lib/format';

const STEPS = ['Placed', 'Confirmed', 'Shipped', 'Delivered'];
const STEP_INDEX = { pending: 0, confirmed: 1, shipped: 2, delivered: 3 };

export default function OrderProgress({ status, dates = [], compact = false }) {
  if (status === 'cancelled') {
    return compact ? <p className="text-xs text-slate-500">Cancelled · stock returned to warehouse</p> : null;
  }
  const current = STEP_INDEX[status] ?? 0;

  if (compact) {
    return (
      <div className="flex gap-1" aria-label={`Progress: ${STEPS[current]}`}>
        {STEPS.map((step, i) => (
          <span key={step} className={`h-1.5 flex-1 rounded-full ${i <= current ? 'bg-indigo-500' : 'bg-slate-200'}`} />
        ))}
      </div>
    );
  }

  return (
    <ol className="grid grid-cols-4">
      {STEPS.map((label, i) => {
        const done = i <= current;
        return (
          <li key={label} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={`absolute top-3.5 right-1/2 h-0.5 w-full ${done ? 'bg-indigo-500' : 'bg-slate-200'}`} />}
            <span
              className={`relative grid size-7 place-items-center rounded-full text-xs font-semibold ${
                done ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 ring-2 ring-slate-200'
              }`}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span className={`mt-2 text-xs font-medium sm:text-sm ${done ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
            {done && dates[i] && <span className="hidden text-xs text-slate-500 sm:block">{formatDateTime(dates[i])}</span>}
          </li>
        );
      })}
    </ol>
  );
}
