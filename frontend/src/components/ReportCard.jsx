import { useState } from 'react';
import { ChartColumn, CodeXml, Table2 } from 'lucide-react';
import { useApi } from '../lib/useApi';
import DataTable from './DataTable';
import SqlBlock from './SqlBlock';
import { Spinner } from './ui';

const VIEWS = [
  { key: 'visual', label: 'Chart', icon: ChartColumn },
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'sql', label: 'SQL', icon: CodeXml },
];

// Runs one server-side report and lets the viewer flip between the visual, the raw rows and the SQL.
export default function ReportCard({ reportKey, title, className = '', children }) {
  const report = useApi(`/admin/reports/${reportKey}`);
  const [view, setView] = useState('visual');

  return (
    <section className={`card flex min-w-0 flex-col ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{title ?? report.data?.title}</h2>
          {report.data && <p className="text-xs text-slate-500">{report.data.description}</p>}
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5" role="tablist">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 px-5 pb-5">
        {report.error && <p className="py-6 text-sm text-rose-600">{report.error.message}</p>}
        {!report.data && !report.error && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}
        {report.data && view === 'visual' && children(report.data.rows)}
        {report.data && view === 'table' && (
          <DataTable columns={report.data.columns} rows={report.data.rows} className="-mx-5 border-y border-slate-100" />
        )}
        {report.data && view === 'sql' && <SqlBlock sql={report.data.sql} />}
      </div>

      {report.data && (
        <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
          <span>{report.data.concepts.join(' · ')}</span>
          <span className="tabular-nums">
            {report.data.rows.length} rows · {report.data.ms} ms
          </span>
        </footer>
      )}
    </section>
  );
}
