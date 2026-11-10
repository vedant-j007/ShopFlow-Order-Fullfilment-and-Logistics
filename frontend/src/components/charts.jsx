import { useState } from 'react';

function niceScale(max, tickCount = 4) {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const raw = max / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  const steps = Math.ceil(max / step);
  return { top: steps * step, ticks: Array.from({ length: steps + 1 }, (_, i) => i * step) };
}

// Single-series column chart: hairline grid, <=24px columns with 4px rounded caps,
// value labelled on the latest column, per-column tooltip on hover/focus.
export function ColumnChart({ data, formatValue = String, formatTick = formatValue, height = 200 }) {
  const [active, setActive] = useState(null);
  const { top, ticks } = niceScale(Math.max(0, ...data.map((d) => d.value)));
  const lastIndex = data.length - 1;

  return (
    <div className="flex gap-3">
      <div className="relative w-12 shrink-0 text-right text-[11px] text-slate-400 tabular-nums" style={{ height }} aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0" style={{ bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)' }}>
            {formatTick(t)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className={`absolute inset-x-0 h-px ${t === 0 ? 'bg-chart-axis' : 'bg-chart-grid'}`} style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex">
            {data.map((d, i) => {
              const pct = (d.value / top) * 100;
              const tooltipAlign = i === 0 ? 'left-0' : i === lastIndex ? 'right-0' : 'left-1/2 -translate-x-1/2';
              return (
                <div
                  key={d.label}
                  tabIndex={0}
                  aria-label={`${d.tooltipLabel ?? d.label}: ${formatValue(d.value)}`}
                  className="relative flex flex-1 items-end justify-center rounded-sm outline-none focus-visible:bg-slate-100/60"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <div
                    className={`w-3/5 max-w-6 rounded-t-[4px] transition-colors ${active === i ? 'bg-chart-1-hover' : 'bg-chart-1'}`}
                    style={{ height: `${pct}%` }}
                  />
                  {i === lastIndex && active === null && (
                    <span className="absolute text-[11px] font-medium text-slate-600 tabular-nums" style={{ bottom: `calc(${pct}% + 4px)` }}>
                      {formatTick(d.value)}
                    </span>
                  )}
                  {active === i && (
                    <div
                      className={`pointer-events-none absolute z-10 w-max rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg ${tooltipAlign}`}
                      style={{ bottom: `calc(${pct}% + 8px)` }}
                    >
                      <p className="text-sm font-semibold text-slate-900 tabular-nums">{formatValue(d.value)}</p>
                      <p className="text-xs text-slate-500">{d.tooltipLabel ?? d.label}</p>
                      {d.detail && <p className="text-xs text-slate-500">{d.detail}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex" aria-hidden="true">
          {data.map((d) => (
            <span key={d.label} className="flex-1 text-center text-[11px] text-slate-500">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Ranked horizontal bars with the value at each bar's tip.
// `stacked` puts label + value on one line and the bar full-width below (for narrow cards).
export function HBarList({ items, stacked = false }) {
  const max = Math.max(0, ...items.map((i) => i.value)) || 1;

  if (stacked) {
    return (
      <ul className="space-y-3.5">
        {items.map((item) => (
          <li key={item.key} className="group">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-slate-700">
                {item.label}
                {item.sublabel && <span className="ml-2 text-xs text-slate-400">{item.sublabel}</span>}
              </p>
              <span className="shrink-0 text-xs font-medium text-slate-600 tabular-nums">{item.display}</span>
            </div>
            <div
              className="mt-1.5 h-3 min-w-0.5 rounded-r-[4px] bg-chart-1 transition-colors group-hover:bg-chart-1-hover"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="group grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-center">
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-700" title={item.label}>
              {item.label}
            </p>
            {item.sublabel && <p className="truncate text-xs text-slate-400">{item.sublabel}</p>}
          </div>
          <div className="flex items-center gap-2">
            <div
              className="h-3 min-w-0.5 rounded-r-[4px] bg-chart-1 transition-colors group-hover:bg-chart-1-hover"
              style={{ width: `calc((100% - 7rem) * ${item.value / max})` }}
            />
            <span className="shrink-0 text-xs font-medium text-slate-600 tabular-nums">{item.display}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Ratio against a limit: fill on a lighter track of the same hue.
export function Meter({ label, percent, sublabel }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{percent}%</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-chart-track" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      {sublabel && <p className="mt-1.5 text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}
