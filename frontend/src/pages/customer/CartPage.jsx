import { Link } from 'react-router';
import { ArrowRight, Minus, Plus, ShieldCheck, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { money } from '../../lib/format';
import CategoryArt from '../../components/CategoryArt';
import { EmptyState, PageHeader } from '../../components/ui';

export default function CartPage() {
  const { items, setQuantity, remove, count, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-lg">
        <EmptyState icon={ShoppingCart} title="Your cart is empty">
          <p>Browse the catalog and add a few products.</p>
          <Link to="/" className="btn btn-primary mt-4">
            Browse products
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Your cart" subtitle={`${count} item${count === 1 ? '' : 's'}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <ul className="card divide-y divide-slate-100 lg:col-span-2">
          {items.map((item) => (
            <li key={item.product_id} className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
              <CategoryArt category={item.category} className="size-16 rounded-xl" iconClassName="size-7" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">
                  {item.category} · {money(item.price)} each
                </p>
                {item.quantity >= item.max_orderable && (
                  <p className="mt-0.5 text-xs text-amber-600">Max {item.max_orderable} per order line</p>
                )}
              </div>
              <div className="flex items-center rounded-lg ring-1 ring-slate-200">
                <button
                  className="grid size-9 place-items-center text-slate-500 hover:text-slate-900 disabled:opacity-40"
                  onClick={() => setQuantity(item.product_id, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center text-sm font-medium tabular-nums">{item.quantity}</span>
                <button
                  className="grid size-9 place-items-center text-slate-500 hover:text-slate-900 disabled:opacity-40"
                  onClick={() => setQuantity(item.product_id, item.quantity + 1)}
                  disabled={item.quantity >= item.max_orderable}
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <p className="w-24 text-right font-medium tabular-nums">{money(item.price * item.quantity)}</p>
              <button className="btn btn-ghost px-2 text-slate-400 hover:text-rose-600" onClick={() => remove(item.product_id)} aria-label={`Remove ${item.name}`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Shipping</dt>
              <dd className="text-emerald-600">Free</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
          </dl>
          <Link to="/checkout" className="btn btn-primary mt-5 w-full py-2.5">
            Proceed to checkout <ArrowRight className="size-4" />
          </Link>
          <p className="mt-4 flex gap-2 text-xs text-slate-500">
            <ShieldCheck className="size-4 shrink-0 text-slate-400" />
            Prices and stock are re-checked by the database when the order is placed.
          </p>
        </aside>
      </div>
    </div>
  );
}
