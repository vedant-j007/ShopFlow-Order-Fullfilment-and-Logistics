import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Boxes, ClipboardList, IndianRupee, Receipt, RefreshCw, TriangleAlert, Truck } from 'lucide-react';
import { useApi } from '../../lib/useApi';
import { compactMoney, humanize, money, number } from '../../lib/format';
import ReportCard from '../../components/ReportCard';
import { ColumnChart, HBarList, Meter } from '../../components/charts';
import { PageHeader, StatusBadge } from '../../components/ui';

const monthLabel = (ym, withYear) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', ...(withYear && { year: 'numeric' }) });

function StatTile({ label, value, icon: Icon, to, hint }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <Icon className="size-4 text-slate-300" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value ?? '—'}</p>
      {hint && <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">{hint}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="card block p-4 transition hover:border-indigo-200 hover:shadow-md">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

function KpiRow() {
  const { data: k } = useApi('/admin/kpis');
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <StatTile label="Revenue" value={k && compactMoney(k.revenue)} icon={IndianRupee} hint="Excludes cancelled orders" />
      <StatTile label="Orders" value={k && number(k.total_orders)} icon={Receipt} hint={k && `${k.customers} customers`} />
      <StatTile label="Avg order value" value={k && money(k.avg_order_value)} icon={IndianRupee} />
      <StatTile label="Awaiting shipment" value={k?.awaiting_shipment} icon={ClipboardList} to="/admin/orders" hint={<>Ship now <ArrowRight className="size-3" /></>} />
      <StatTile label="Active shipments" value={k?.active_shipments} icon={Truck} to="/admin/shipments" hint={<>Open board <ArrowRight className="size-3" /></>} />
      <StatTile label="Low-stock items" value={k?.low_stock_items} icon={TriangleAlert} to="/admin/inventory" hint={<>Restock <ArrowRight className="size-3" /></>} />
    </div>
  );
}

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Every card is a live SQL query or view. Flip any card to Table or SQL."
        actions={
          <button className="btn btn-secondary" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="size-4" /> Refresh
          </button>
        }
      />

      <div key={refreshKey} className="space-y-6">
        <KpiRow />

        <div className="grid gap-6 xl:grid-cols-3">
          <ReportCard reportKey="monthly_revenue" className="xl:col-span-2">
            {(rows) => (
              <ColumnChart
                data={rows.map((r, i) => ({
                  label: monthLabel(r.month, i === 0),
                  tooltipLabel: monthLabel(r.month, true),
                  value: r.revenue,
                  detail: `${r.orders} orders${r.growth_pct == null ? '' : ` · ${r.growth_pct > 0 ? '+' : ''}${r.growth_pct}% vs previous month`}`,
                }))}
                formatValue={money}
                formatTick={compactMoney}
                height={260}
              />
            )}
          </ReportCard>

          <ReportCard reportKey="order_status_distribution">
            {(rows) => (
              <HBarList
                stacked
                items={rows.map((r) => ({
                  key: r.status,
                  label: humanize(r.status),
                  sublabel: `Avg ${money(r.avg_order_value)}`,
                  value: r.orders,
                  display: `${r.orders} · ${r.pct_of_orders}%`,
                }))}
              />
            )}
          </ReportCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ReportCard reportKey="top_products">
            {(rows) => (
              <HBarList
                items={rows.map((r) => ({
                  key: r.product_id,
                  label: r.product,
                  sublabel: r.category,
                  value: r.units_sold,
                  display: `${r.units_sold} units · ${compactMoney(r.revenue)}`,
                }))}
              />
            )}
          </ReportCard>

          <ReportCard reportKey="category_revenue">
            {(rows) => (
              <HBarList
                items={rows.map((r) => ({
                  key: r.category,
                  label: r.category,
                  sublabel: `${r.units} units`,
                  value: r.revenue,
                  display: `${compactMoney(r.revenue)} · ${r.revenue_share_pct}%`,
                }))}
              />
            )}
          </ReportCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ReportCard reportKey="warehouse_utilization">
            {(rows) => (
              <div className="space-y-5">
                {rows.map((r) => (
                  <Meter
                    key={r.warehouse_id}
                    label={r.location}
                    percent={r.utilization_pct}
                    sublabel={`${number(r.units_in_stock)} of ${number(r.capacity)} units · ${r.units_dispatched} dispatched · ${r.low_stock_products} low-stock`}
                  />
                ))}
              </div>
            )}
          </ReportCard>

          <ReportCard reportKey="delivery_performance" title="Delivery performance by carrier">
            {(rows) => (
              <HBarList
                items={rows.map((r) => ({
                  key: r.carrier_id,
                  label: r.carrier_name,
                  sublabel: `${r.delivered_shipments}/${r.total_shipments} delivered${r.failed_shipments ? ` · ${r.failed_shipments} failed` : ''}`,
                  value: r.avg_delivery_days ?? 0,
                  display: r.avg_delivery_days == null ? 'No deliveries' : `${r.avg_delivery_days} days avg`,
                }))}
              />
            )}
          </ReportCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ReportCard reportKey="low_stock_alert" title="Low stock alerts">
            {(rows) => (
              <ul className="-my-2 divide-y divide-slate-100">
                {rows.map((r) => (
                  <li key={r.inventory_id} className="flex items-center gap-3 py-2.5">
                    <Boxes className="size-4 shrink-0 text-slate-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{r.product_name}</p>
                      <p className="truncate text-xs text-slate-500">{r.warehouse}</p>
                    </div>
                    <p className="text-sm text-slate-600 tabular-nums">
                      {r.stock_qty}
                      <span className="text-slate-400"> / {r.reorder_level}</span>
                    </p>
                    <StatusBadge status={r.severity} />
                  </li>
                ))}
                {rows.length === 0 && <li className="py-6 text-center text-sm text-slate-500">All stock levels are healthy.</li>}
              </ul>
            )}
          </ReportCard>

          <ReportCard reportKey="above_average_customers">
            {(rows) => (
              <HBarList
                items={rows.map((r) => ({
                  key: r.customer_id,
                  label: r.name,
                  sublabel: `${r.orders} orders`,
                  value: r.lifetime_spend,
                  display: money(r.lifetime_spend),
                }))}
              />
            )}
          </ReportCard>
        </div>
      </div>
    </div>
  );
}
