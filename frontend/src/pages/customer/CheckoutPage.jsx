import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Check, Database, MapPin, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { money } from '../../lib/format';
import { PAYMENT_METHODS } from '../../lib/payments';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { LoadingBlock, PageHeader, Spinner } from '../../components/ui';

function Section({ step, title, children }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-3 font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function OptionCard({ selected, onSelect, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
        selected ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {children}
      {selected && (
        <span className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-indigo-600 text-white">
          <Check className="size-3" />
        </span>
      )}
    </button>
  );
}

function AddressForm({ onSaved, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ line1: '', city: '', state: '', pincode: '' });
  const [saving, setSaving] = useState(false);
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const address = await api('/addresses', { method: 'POST', body: form });
      toast.success('Address saved');
      onSaved(address);
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="line1">Address line</label>
        <input id="line1" className="input" required value={form.line1} onChange={update('line1')} placeholder="Flat, building, street" />
      </div>
      <div>
        <label className="label" htmlFor="city">City</label>
        <input id="city" className="input" required value={form.city} onChange={update('city')} />
      </div>
      <div>
        <label className="label" htmlFor="state">State</label>
        <input id="state" className="input" required value={form.state} onChange={update('state')} />
      </div>
      <div>
        <label className="label" htmlFor="pincode">Pincode</label>
        <input id="pincode" className="input" required inputMode="numeric" maxLength={6} value={form.pincode} onChange={update('pincode')} placeholder="411001" />
      </div>
      <div className="flex items-end gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <Spinner className="size-4 text-white" />} Save address
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, subtotal, clear } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const addresses = useApi('/addresses');
  const [chosenAddress, setChosenAddress] = useState(null);
  const [method, setMethod] = useState('upi');
  const [addingAddress, setAddingAddress] = useState(false);
  const [placing, setPlacing] = useState(false);

  if (items.length === 0 && !placing) return <Navigate to="/cart" replace />;

  const addressId = chosenAddress ?? addresses.data?.[0]?.address_id ?? null;
  const cart = items.map(({ product_id, quantity }) => ({ product_id, quantity }));

  async function placeOrder() {
    setPlacing(true);
    try {
      const { order_id } = await api('/orders', {
        method: 'POST',
        body: { address_id: addressId, payment_method: method, items: cart },
      });
      toast.success(`Order #${order_id} placed successfully`);
      navigate(`/orders/${order_id}`);
      clear();
    } catch (err) {
      toast.error(err.message);
      setPlacing(false);
    }
  }

  return (
    <div>
      <PageHeader title="Checkout" subtitle="Choose where to deliver and how to pay." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section step="1" title="Delivery address">
            {!addresses.data ? (
              <LoadingBlock label="Loading addresses…" />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {addresses.data.map((a) => (
                    <OptionCard key={a.address_id} selected={a.address_id === addressId} onSelect={() => setChosenAddress(a.address_id)}>
                      <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                      <span className="pr-6 text-sm">
                        <span className="block font-medium text-slate-900">{a.city}</span>
                        <span className="text-slate-500">
                          {a.line1}, {a.state} {a.pincode}
                        </span>
                      </span>
                    </OptionCard>
                  ))}
                </div>
                {addingAddress ? (
                  <AddressForm
                    onCancel={() => setAddingAddress(false)}
                    onSaved={(address) => {
                      addresses.setData([...addresses.data, address]);
                      setChosenAddress(address.address_id);
                      setAddingAddress(false);
                    }}
                  />
                ) : (
                  <button className="btn btn-secondary mt-3" onClick={() => setAddingAddress(true)}>
                    <Plus className="size-4" /> Add a new address
                  </button>
                )}
              </>
            )}
          </Section>

          <Section step="2" title="Payment method">
            <div className="grid gap-3 sm:grid-cols-2">
              {PAYMENT_METHODS.map(({ value, label, hint, icon: Icon }) => (
                <OptionCard key={value} selected={method === value} onSelect={() => setMethod(value)}>
                  <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  <span className="pr-6 text-sm">
                    <span className="block font-medium text-slate-900">{label}</span>
                    <span className="text-slate-500">{hint}</span>
                  </span>
                </OptionCard>
              ))}
            </div>
          </Section>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="card p-5">
            <h2 className="font-semibold">Order summary</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {items.map((item) => (
                <li key={item.product_id} className="flex justify-between gap-3">
                  <span className="text-slate-600">
                    {item.name} <span className="text-slate-400">× {item.quantity}</span>
                  </span>
                  <span className="tabular-nums">{money(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-slate-100 pt-4 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(subtotal)}</span>
            </div>
            <button className="btn btn-primary mt-5 w-full py-2.5" onClick={placeOrder} disabled={placing || !addressId}>
              {placing && <Spinner className="size-4 text-white" />}
              {placing ? 'Placing order…' : `Place order · ${money(subtotal)}`}
            </button>
          </div>

          <details className="rounded-2xl bg-slate-900 text-slate-300">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-medium select-none">
              <Database className="size-3.5" /> What runs in PostgreSQL
            </summary>
            <pre className="overflow-x-auto px-4 pb-4 text-[11px] leading-relaxed text-slate-200">
              {`CALL place_order(\n  ${user.id},             -- customer_id\n  ${addressId ?? 'NULL'},             -- address_id\n  '${JSON.stringify(cart)}'::jsonb,\n  '${method}',\n  NULL           -- OUT order_id\n);`}
            </pre>
            <p className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">
              One atomic transaction: ORDERS + ORDER_ITEMS (stock trigger per line) + PAYMENTS. Any failure rolls everything back.
            </p>
          </details>
        </aside>
      </div>
    </div>
  );
}
