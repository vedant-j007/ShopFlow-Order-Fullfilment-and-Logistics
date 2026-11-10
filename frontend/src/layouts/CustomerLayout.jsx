import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { LayoutDashboard, LogOut, Package, ShoppingCart, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Logo } from '../components/ui';

const navClass = ({ isActive }) => `btn btn-ghost px-3 ${isActive ? 'bg-slate-100 text-slate-900' : ''}`;

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-1 px-4 sm:gap-2 sm:px-6">
          <Link to="/" className="mr-2 flex items-center gap-2.5 sm:mr-4">
            <Logo />
            <span className="hidden font-semibold tracking-tight sm:inline">ShopFlow</span>
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              <Store className="size-4" />
              <span className="hidden sm:inline">Shop</span>
            </NavLink>
            {user?.role === 'customer' && (
              <NavLink to="/orders" className={navClass}>
                <Package className="size-4" />
                <span className="hidden sm:inline">My orders</span>
              </NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navClass}>
                <LayoutDashboard className="size-4" />
                <span className="hidden sm:inline">Admin panel</span>
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NavLink to="/cart" className={navClass} aria-label={`Cart, ${count} items`}>
              <span className="relative">
                <ShoppingCart className="size-5" />
                {count > 0 && (
                  <span className="absolute -top-2 -right-2.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
                    {count}
                  </span>
                )}
              </span>
            </NavLink>

            {user ? (
              <>
                <div className="ml-2 hidden text-right md:block">
                  <p className="text-sm leading-tight font-medium">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.role === 'admin' ? 'Administrator' : user.email}</p>
                </div>
                <button
                  className="btn btn-ghost px-2.5"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="size-4" />
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary ml-1">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200/80 py-6 text-center text-xs text-slate-400">
        ShopFlow · Order fulfillment &amp; logistics · PostgreSQL + Express + React
      </footer>
    </div>
  );
}
