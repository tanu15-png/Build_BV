
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { OrderProvider } from "./context/OrderContext";
import MenuManagement from "./pages/canteen/MenuManagement.jsx";
import CanteenMembers from "./pages/canteen/CanteenMembers.jsx";
import CanteenDashboard from "./pages/canteen/CanteenDashboard.jsx";
import CanteenOrders from "./pages/canteen/CanteenOrders.jsx";
import CanteenOrderDetails from "./pages/canteen/CanteenOrderDetails.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import Login from "./pages/Login";
import StudentDashboard from "./pages/student/StudentDashboard";
import CafePage from "./pages/student/CafePage";
import Cart from "./pages/student/Cart";
import Checkout from "./pages/student/Checkout";
import OrderSuccess from "./pages/student/OrderSuccess";
import MyOrders from "./pages/student/MyOrders";
import OrderTracking from "./pages/student/OrderTracking";
import Notifications from "./pages/student/Notifications";
import Profile from "./pages/student/Profile";
import AuthCallback from "./pages/AuthCallback";

function ProtectedRoute({ role, children }) {
  const { user, loading, authError, refreshSession } = useAuth();

  if (loading) return <p role="status" className="p-8">Checking your session…</p>;
  if (authError) return <div role="alert" className="p-8"><p>{authError}</p><button onClick={refreshSession} className="mt-4 rounded-xl border p-3">Retry connection</button></div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return (
      <Navigate
        to={`/${user.role}`}
        replace
      />
    );
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <OrderProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route
              path="/"
              element={
                <Navigate
                  to="/login"
                  replace
                />
              }
            />

            <Route
              path="/login"
              element={<Login />}
            />

            {/* STUDENT */}

            <Route
              path="/student"
              element={
                <ProtectedRoute role="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/cafe/:cafeId"
              element={
                <ProtectedRoute role="student">
                  <CafePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/cart"
              element={
                <ProtectedRoute role="student">
                  <Cart />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/checkout"
              element={
                <ProtectedRoute role="student">
                  <Checkout />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/order-success"
              element={
                <ProtectedRoute role="student">
                  <OrderSuccess />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/orders"
              element={
                <ProtectedRoute role="student">
                  <MyOrders />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/orders/:orderId"
              element={
                <ProtectedRoute role="student">
                  <OrderTracking />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/notifications"
              element={
                <ProtectedRoute role="student">
                  <Notifications />
                </ProtectedRoute>
              }
            />

            <Route
              path="/student/profile"
              element={
                <ProtectedRoute role="student">
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/canteen"
              element={
                <ProtectedRoute role="canteen">
                  <CanteenDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="/canteen/menu" element={<ProtectedRoute role="canteen"><MenuManagement /></ProtectedRoute>} />

            <Route path="/canteen/members" element={<ProtectedRoute role="canteen"><CanteenMembers /></ProtectedRoute>} />

            {/* ADMIN */}
            <Route path="/admin/canteens/:canteenId/menu" element={<ProtectedRoute role="admin"><MenuManagement /></ProtectedRoute>} />

            <Route path="/canteen/orders" element={<ProtectedRoute role="canteen"><CanteenOrders /></ProtectedRoute>} />
            <Route path="/canteen/orders/:orderId" element={<ProtectedRoute role="canteen"><CanteenOrderDetails /></ProtectedRoute>} />

            <Route
              path="/admin/*"
              element={
                <ProtectedRoute role="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="*"
              element={
                <Navigate
                  to="/login"
                  replace
                />
              }
            />

          </Routes>
        </BrowserRouter>
      </OrderProvider>
    </AuthProvider>
  );
}


export default App;
