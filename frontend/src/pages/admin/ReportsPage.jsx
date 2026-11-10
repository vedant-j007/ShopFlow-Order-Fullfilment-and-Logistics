import { useSearchParams } from 'react-router';
import { Database, Eye, Play } from 'lucide-react';
import { useApi } from '../../lib/useApi';
import DataTable from '../../components/DataTable';
import SqlBlock from '../../components/SqlBlock';
import { ErrorBlock, LoadingBlock, PageHeader, Spinner } from '../../components/ui';

function ReportResult({ reportKey }) {
  const { data, error, loading, reload } = useApi(`/admin/reports/${reportKey}`);

  if (error && !data) return <ErrorBlock error={error} onRetry={reload} />;
  if (!data) return <LoadingBlock label="Running query…" />;

  return (
    <div className="min-w-0 space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{data.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{data.description}</p>
          </div>
          <button className="btn btn-primary" onClick={reload} disabled={loading}>
            {loading ? <Spinner className="size-4 text-white" /> : <Play className="size-4" />} Run again
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.concepts.map((c) => (
            <span key={c} className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {c}
            </span>
          ))}
        </div>
        <SqlBlock sql={data.sql} className="mt-4" />
      </div>

      <div className={`card overflow-hidden ${loading ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm">
          <span className="font-medium text-slate-700">Result</span>
          <span className="text-xs text-slate-400 tabular-nums">
            {data.rows.length} rows · {data.ms} ms
          </span>
        </div>
        <DataTable columns={data.columns} rows={data.rows} />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const reports = useApi('/admin/reports');
  const [params, setParams] = useSearchParams();
  const selected = params.get('q') ?? reports.data?.[0]?.key;

  if (reports.error) return <ErrorBlock error={reports.error} onRetry={reports.reload} />;
  if (!reports.data) return <LoadingBlock />;

  const groups = [
    { kind: 'query', label: 'Analytical queries', icon: Database },
    { kind: 'view', label: 'Views', icon: Eye },
  ];

  return (
    <div>
      <PageHeader title="SQL reports" subtitle="Each analytical query and view, with its exact SQL and live result." />
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <nav className="card h-fit p-2 lg:sticky lg:top-8">
          {groups.map(({ kind, label, icon: Icon }) => (
            <div key={kind} className="mb-2 last:mb-0">
              <p className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-slate-400 uppercase">
                <Icon className="size-3.5" /> {label}
              </p>
              {reports.data
                .filter((r) => r.kind === kind)
                .map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setParams({ q: r.key })}
                    className={`block w-full rounded-lg px-3 py-2 text-left transition ${
                      r.key === selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-slate-400">{r.concepts.join(' · ')}</span>
                  </button>
                ))}
            </div>
          ))}
        </nav>
        {selected && <ReportResult key={selected} reportKey={selected} />}
      </div>
    </div>
  );
}
