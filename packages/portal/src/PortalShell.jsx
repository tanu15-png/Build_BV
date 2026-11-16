import { useLoadingAnimation } from './hooks/useLoadingAnimation';
import { BrandSplash } from './components/Brand';
import { Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OrderProvider } from './context/OrderContext';
import { portal, roleLabel } from './portal';
export function PortalProviders({ children }) {
  return <AuthProvider><OrderProvider><SessionEntrance>{children}</SessionEntrance></OrderProvider></AuthProvider>;
}
function SessionEntrance({ children }) {
  const { loading } = useAuth();
  const animation = useLoadingAnimation(loading);
  return animation.pending ? <BrandSplash onComplete={animation.complete} /> : children;
}
export function ProtectedRoute({ children }) {
  const { user, loading, authError, refreshSession } = useAuth();
  if (loading) return <BrandSplash />;
  if (authError) return <div role="alert" className="p-8"><p>{authError}</p><button onClick={refreshSession} className="mt-4 rounded-xl border p-3">Retry connection</button></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== portal) return <p role="alert" className="p-8">Sign in with your {roleLabel(portal).toLowerCase()} account.</p>;
  return children;
}
