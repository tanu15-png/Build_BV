import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PortalProviders, ProtectedRoute } from '@spoonate/portal/PortalShell.jsx';
import Login from '@spoonate/portal/pages/Login.jsx';
import AuthCallback from '@spoonate/portal/pages/AuthCallback.jsx';
import Dashboard from "./pages/Dashboard";
import CafePage from "./pages/CafePage";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import MyOrders from "./pages/MyOrders";
import OrderTracking from "./pages/OrderTracking";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
function LegacyDashboardRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: location.pathname.replace(/^\/student(?=\/|$)/, '/dashboard'), search: location.search, hash: location.hash }} replace />;
}
export default function App() {
  return <PortalProviders><BrowserRouter><Routes>
    <Route path="/student/*" element={<LegacyDashboardRedirect />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/dashboard/cafe/:cafeId" element={<ProtectedRoute><CafePage /></ProtectedRoute>} />
    <Route path="/dashboard/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
    <Route path="/dashboard/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
    <Route path="/dashboard/order-success" element={<ProtectedRoute><OrderSuccess /></ProtectedRoute>} />
    <Route path="/dashboard/orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
    <Route path="/dashboard/orders/:orderId" element={<ProtectedRoute><OrderTracking /></ProtectedRoute>} />
    <Route path="/dashboard/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
    <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></BrowserRouter></PortalProviders>;
}
