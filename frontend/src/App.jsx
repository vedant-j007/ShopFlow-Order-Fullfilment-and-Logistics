import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext';
import CustomerLayout from './layouts/CustomerLayout';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/customer/CatalogPage';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import OrdersPage from './pages/customer/OrdersPage';
import OrderDetailPage from './pages/customer/OrderDetailPage';
import DashboardPage from './pages/admin/DashboardPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import InventoryPage from './pages/admin/InventoryPage';
import ShipmentsPage from './pages/admin/ShipmentsPage';
import ReportsPage from './pages/admin/ReportsPage';

function RequireRole({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<CustomerLayout />}>
        <Route index element={<CatalogPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<RequireRole role="customer"><CheckoutPage /></RequireRole>} />
        <Route path="orders" element={<RequireRole role="customer"><OrdersPage /></RequireRole>} />
        <Route path="orders/:id" element={<RequireRole role="customer"><OrderDetailPage /></RequireRole>} />
      </Route>

      <Route path="admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="shipments" element={<ShipmentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
