import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PortalProviders, ProtectedRoute } from '@spoonate/portal/PortalShell.jsx';
import Login from './pages/AdminLogin.jsx';
import MenuManagement from '@spoonate/portal/pages/MenuManagement.jsx';
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminLayout from "./pages/AdminLayout.jsx";
import AdminOrders from "./pages/AdminOrders.jsx";
import AdminCanteens from "./pages/AdminCanteens.jsx";
import AdminMaintenance from "./pages/AdminMaintenance.jsx";
export default function App() {
  return <PortalProviders><BrowserRouter><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/admin/canteens/:canteenId/menu" element={<ProtectedRoute><MenuManagement /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
    <Route index element={<AdminDashboard />} />
    <Route path="canteens" element={<AdminCanteens />} />
    <Route path="orders" element={<AdminOrders />} />
    <Route path="accounts" element={<AdminMaintenance />} />
    <Route path="*" element={<Navigate to="/admin" replace />} />
    </Route>
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Routes></BrowserRouter></PortalProviders>;
}
