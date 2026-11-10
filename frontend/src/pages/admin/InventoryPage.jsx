import { useEffect, useState } from 'react';
import { Boxes, Save, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { useToast } from '../../context/ToastContext';
import CategoryArt from '../../components/CategoryArt';
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Spinner, StatusBadge } from '../../components/ui';

// Mirrors the CASE expression in the low_stock_alert view (reorder_level / 2 is integer division there).
function severity(stock, reorder) {
  if (stock === 0) return 'out_of_stock';
  if (stock <= Math.floor(reorder / 2)) return 'critical';
  if (stock <= reorder) return 'low';
  return 'healthy';
}

function InventoryRow({ row, onSaved }) {
  const toast = useToast();
  const [stock, setStock] = useState(String(row.stock_qty));
  const [reorder, setReorder] = useState(String(row.reorder_level));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStock(String(row.stock_qty));
    setReorder(String(row.reorder_level));
  }, [row.stock_qty, row.reorder_level]);

  const dirty = Number(stock) !== row.stock_qty || Number(reorder) !== row.reorder_level;

  async function patch(body, describe) {
    setSaving(true);
    try {
      const updated = await api(`/admin/inventory/${row.inventory_id}`, { method: 'PATCH', body });
      onSaved({ ...row, ...updated });
      toast.success(describe(updated));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const save = () =>
    patch({ stock_qty: Number(stock), reorder_level: Number(reorder) }, (u) => `${row.product_name} @ ${row.warehouse}: ${u.stock_qty} units, reorder at ${u.reorder_level}`);
  const restock = (amount) => patch({ adjust_by: amount }, (u) => `Restocked ${row.product_name} +${amount} → ${u.stock_qty} units`);

  return (
    <tr className={`hover:bg-slate-50/60 ${saving ? 'opacity-60' : ''}`}>
      <td className="td">
        <div className="flex items-center gap-3">
          <CategoryArt category={row.category} className="size-9 rounded-lg" iconClassName="size-4" />
          <div className="min-w-0">
            <p className="font-medium whitespace-nowrap text-slate-900">{row.product_name}</p>
            <p className="text-xs text-slate-500">{row.category}</p>
          </div>
        </div>
      </td>
      <td className="td whitespace-nowrap">{row.warehouse}</td>
      <td className="td">
        <input
          type="number"
          className="input w-24 py-1.5 text-right tabular-nums"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          aria-label={`Stock of ${row.product_name} at ${row.warehouse}`}
        />
      </td>
      <td className="td">
        <input
          type="number"
          className="input w-20 py-1.5 text-right tabular-nums"
          value={reorder}
          onChange={(e) => setReorder(e.target.value)}
          aria-label={`Reorder level of ${row.product_name} at ${row.warehouse}`}
        />
      </td>
      <td className="td">
        <StatusBadge status={severity(row.stock_qty, row.reorder_level)} />
      </td>
      <td className="td">
        <div className="flex justify-end gap-2">
          {dirty ? (
            <button className="btn btn-primary py-1.5" onClick={save} disabled={saving}>
              {saving ? <Spinner className="size-4 text-white" /> : <Save className="size-4" />} Save
            </button>
          ) : (
            [10, 50].map((amount) => (
              <button key={amount} className="btn btn-secondary px-2.5 py-1.5 tabular-nums" onClick={() => restock(amount)} disabled={saving}>
                +{amount}
              </button>
            ))
          )}
        </div>
      </td>
    </tr>
  );
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const lookups = useApi('/admin/lookups');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams({ ...(query && { search: query }), ...(warehouseId && { warehouse_id: warehouseId }), ...(lowOnly && { low_only: 'true' }) });
  const inventory = useApi(`/admin/inventory?${params}`);
  const lowCount = inventory.data?.filter((r) => r.is_low).length ?? 0;

  const replaceRow = (updated) =>
    inventory.setData((rows) => rows.map((r) => (r.inventory_id === updated.inventory_id ? updated : r)));

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock per product per warehouse. Edits hit the CHECK (stock_qty >= 0) constraint directly."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input type="search" className="input pl-9" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} aria-label="Warehouse">
          <option value="">All warehouses</option>
          {lookups.data?.warehouses.map((w) => (
            <option key={w.warehouse_id} value={w.warehouse_id}>
              {w.location}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="size-4 accent-indigo-600" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

      {inventory.error && !inventory.data && <ErrorBlock error={inventory.error} onRetry={inventory.reload} />}
      {!inventory.data && !inventory.error && <LoadingBlock label="Loading inventory…" />}
      {inventory.data && (
        <div className={`card overflow-hidden ${inventory.loading ? 'opacity-70' : ''}`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
            <span>{inventory.data.length} stock rows</span>
            <span>{lowCount} at or below reorder level</span>
          </div>
          {inventory.data.length === 0 ? (
            <EmptyState icon={Boxes} title="No inventory rows match" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Product</th>
                    <th className="th">Warehouse</th>
                    <th className="th">Stock</th>
                    <th className="th">Reorder at</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.data.map((row) => (
                    <InventoryRow key={row.inventory_id} row={row} onSaved={replaceRow} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
