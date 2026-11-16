import { ShoppingCart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@spoonate/portal/context/AuthContext';
import { useOrders } from '@spoonate/portal/context/OrderContext';

export default function FloatingCart() {
  const { user } = useAuth();
  const { cart } = useOrders();
  const { pathname } = useLocation();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (user?.role !== 'student' || !count || !pathname.startsWith('/dashboard') || ['/dashboard/cart', '/dashboard/checkout'].includes(pathname)) return null;
  return <Link to="/dashboard/cart" aria-label={`Open cart, ${count} ${count === 1 ? 'item' : 'items'}`} className="fixed bottom-20 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#185c3a] text-white shadow-lg ring-2 ring-white lg:bottom-6 lg:right-8"><ShoppingCart size={24} aria-hidden="true" /><span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#ffc565] px-1 text-xs font-black text-[#185c3a]">{count}</span></Link>;
}
