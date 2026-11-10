import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { Database, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Logo, Spinner } from '../components/ui';

const DEMO_ACCOUNTS = [
  { role: 'customer', label: 'Customer', email: 'aarav.sharma@example.com', password: 'customer123' },
  { role: 'admin', label: 'Admin', email: 'admin@shopflow.local', password: 'admin123' },
];

const FEATURES = [
  { icon: Database, text: 'Orders are placed by a stored procedure in one atomic transaction' },
  { icon: PackageCheck, text: 'Triggers reserve stock per warehouse and block overselling' },
  { icon: Truck, text: 'Shipments and tracking events keep order status in sync' },
];

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('customer');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const home = user.role === 'admin' ? '/admin' : '/';
    const from = location.state?.from;
    const canReturn = from && from.startsWith('/admin') === (user.role === 'admin');
    return <Navigate to={canReturn ? from : home} replace />;
  }

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const account =
        mode === 'login'
          ? await login({ email: form.email, password: form.password, role })
          : await register(form);
      toast.success(mode === 'login' ? `Welcome back, ${account.name.split(' ')[0]}` : 'Account created. Happy shopping!');
    } catch (err) {
      toast.error(err.message);
      setSubmitting(false);
    }
  }

  const fillDemo = (account) => {
    setMode('login');
    setRole(account.role);
    setForm((f) => ({ ...f, email: account.email, password: account.password }));
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-40 -right-40 size-[28rem] rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 size-80 rounded-full bg-sky-500/20 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-3">
          <Logo className="size-10" />
          <span className="text-lg font-semibold">ShopFlow</span>
        </Link>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">From cart to doorstep, tracked in the database.</h1>
          <p className="mt-4 text-slate-300">
            An integrated e-commerce order fulfillment &amp; logistics system built on PostgreSQL.
          </p>
          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-slate-200">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo />
            <span className="font-semibold">ShopFlow</span>
          </Link>

          <h2 className="text-2xl font-semibold tracking-tight">{mode === 'login' ? 'Sign in' : 'Create an account'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login' ? 'New here? ' : 'Already have an account? '}
            <button
              type="button"
              className="font-medium text-indigo-600 hover:text-indigo-500"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Create a customer account' : 'Sign in'}
            </button>
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === 'login' && (
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="radiogroup" aria-label="Account type">
                {['customer', 'admin'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={role === r}
                    onClick={() => setRole(r)}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition ${
                      role === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {r === 'admin' && <ShieldCheck className="size-4" />}
                    {r === 'customer' ? 'Customer' : 'Admin'}
                  </button>
                ))}
              </div>
            )}

            {mode === 'register' && (
              <>
                <div>
                  <label className="label" htmlFor="name">Full name</label>
                  <input id="name" className="input" required value={form.name} onChange={update('name')} autoComplete="name" />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Phone</label>
                  <input id="phone" className="input" required value={form.phone} onChange={update('phone')} placeholder="9876543210" autoComplete="tel" />
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" className="input" required value={form.email} onChange={update('email')} autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                required
                minLength={mode === 'register' ? 6 : undefined}
                value={form.password}
                onChange={update('password')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            <button type="submit" className="btn btn-primary w-full py-2.5" disabled={submitting}>
              {submitting && <Spinner className="size-4 text-white" />}
              {mode === 'login' ? `Sign in as ${role}` : 'Create account'}
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-xs font-medium text-slate-500">Demo accounts (click to fill)</p>
            <div className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => fillDemo(account)}
                  className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100"
                >
                  <span>
                    <span className="block font-medium text-slate-700">{account.label}</span>
                    <span className="text-slate-500">{account.email}</span>
                  </span>
                  <code className="rounded bg-white px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200">{account.password}</code>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
