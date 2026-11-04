import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrders } from '@spoonate/portal/context/OrderContext';
import { submitCheckout } from '@spoonate/portal/services/checkout';
export default function Checkout() {
  const { cart, cartState, cafes, reviewCart, createOrder, orderBusy, pendingCheckout } = useOrders();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const cafe = cafes.find(item => item.databaseId === cartState?.canteenId);
  const placeOrder = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true; setSubmitting(true); setError('');
    try {
      const order = await submitCheckout({ cart: cartState, review: reviewCart, createOrder,
        pendingRequest: pendingCheckout });
      navigate('/dashboard/order-success?id=' + order.id, { replace: true });
    } catch (issue) { setError(issue.message); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };
  return <div className="min-h-screen bg-[#f8faf9] p-5 lg:p-10"><main className="mx-auto max-w-2xl">
    <Link to="/dashboard/cart" className="font-bold text-[#075d50]">← Back to cart</Link>
    <h1 className="mt-6 text-3xl font-black">Review and place your order</h1>
    <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{cafe?.name || 'Your items'}</h2>
      <div className="mt-5 space-y-3">{cart.map(item => <div key={item.lineId} className="flex justify-between gap-3"><span>{item.name} × {item.quantity}{!item.available && <span className="block text-sm text-red-700">Currently unavailable</span>}</span><strong>₹{(item.unitPricePaise * item.quantity / 100).toFixed(2)}</strong></div>)}</div>
      <p className="mt-5 border-t pt-5 text-xl font-black">Total: ₹{((cartState?.totalPaise || 0) / 100).toFixed(2)}</p>
      {pendingCheckout && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-900">The previous submission has not been confirmed. Retry it to retrieve the same order. Its original items will be used.</p>}
      <button onClick={placeOrder} disabled={submitting || orderBusy || (!pendingCheckout && (!cart.length || !cartState?.available))} className="mt-5 w-full rounded-xl bg-[#075d50] p-3 font-bold text-white disabled:opacity-50">{submitting || orderBusy ? 'Submitting…' : pendingCheckout ? 'Retry previous submission' : 'Place order'}</button>
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      <p className="mt-5 text-sm text-gray-600">No payment is collected. The canteen will accept your order before preparing it.</p>
    </section>
  </main></div>;
}
