import { formatDateTime } from '../lib/format';

function renderCell(value) {
  if (value === null || value === undefined) return <span className="text-slate-300">NULL</span>;
  if (typeof value === 'number') return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
}

// Generic result grid for query output (column names come straight from PostgreSQL).
export default function DataTable({ columns, rows, className = '' }) {
  const numeric = new Set(columns.filter((c) => rows.some((r) => typeof r[c] === 'number')));

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c} className={`th whitespace-nowrap normal-case ${numeric.has(c) ? 'text-right' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/70">
              {columns.map((c) => (
                <td key={c} className={`td py-2.5 whitespace-nowrap ${numeric.has(c) ? 'text-right' : ''}`}>
                  {renderCell(row[c])}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="td py-8 text-center text-slate-400">
                (0 rows)
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
