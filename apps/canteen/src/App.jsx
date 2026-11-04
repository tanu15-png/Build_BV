import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PortalProviders, ProtectedRoute } from '@spoonate/portal/PortalShell.jsx';
import Login from './pages/CanteenLogin.jsx';
import MenuManagement from '@spoonate/portal/pages/MenuManagement.jsx';
import CanteenMembers from "./pages/CanteenMembers.jsx";
import CanteenDashboard from "./pages/CanteenDashboard.jsx";
import CanteenOrders from "./pages/CanteenOrders.jsx";
import CanteenOrderDetails from "./pages/CanteenOrderDetails.jsx";
export default function App() {
  return <PortalProviders><BrowserRouter><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/canteen" element={<ProtectedRoute><CanteenDashboard /></ProtectedRoute>} />
    <Route path="/canteen/menu" element={<ProtectedRoute><MenuManagement /></ProtectedRoute>} />
    <Route path="/canteen/members" element={<ProtectedRoute><CanteenMembers /></ProtectedRoute>} />
    <Route path="/canteen/orders" element={<ProtectedRoute><CanteenOrders /></ProtectedRoute>} />
    <Route path="/canteen/orders/:orderId" element={<ProtectedRoute><CanteenOrderDetails /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/canteen" replace />} />
  </Routes></BrowserRouter></PortalProviders>;
}
