import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '@spoonate/portal/context/OrderContext';
import { submitCheckout } from '@spoonate/portal/services/checkout';

export default function PlaceOrderButton() {
  const { cart, cartState, reviewCart, createOrder, orderBusy, pendingCheckout } = useOrders();
  const navigate = useNavigate();
  const guard = useRef(false);
  const [stage, setStage] = useState(''), [error, setError] = useState('');
  async function submit() {
    if (guard.current) return;
    guard.current = true; setError(''); setStage('Checking items and prices…');
    try {
      const order = await submitCheckout({ cart: cartState, review: reviewCart, createOrder, pendingRequest: pendingCheckout, onStage: setStage });
      navigate('/dashboard/order-success?id=' + order.id, { replace: true });
    } catch (issue) { setError(issue.message); }
    finally { guard.current = false; setStage(''); }
  }
  return <div className="mt-6">
    <p className="mb-3 text-sm text-slate-600">Send your order for acceptance first. If payment is required, pay after the canteen accepts. Paid orders cannot be cancelled or refunded.</p>
    {pendingCheckout && <p role="status" className="mb-3 text-sm text-amber-800">Retry to confirm your previous submission without creating a duplicate order.</p>}
    <button onClick={submit} disabled={Boolean(stage) || orderBusy || (!pendingCheckout && (!cart.length || !cartState?.available))} className="w-full rounded-xl bg-[#185c3a] px-4 py-3 font-bold text-white disabled:opacity-50">{stage || (orderBusy ? 'Submitting…' : pendingCheckout ? 'Retry submission' : 'Place order')}</button>
    {stage && <p role="status" className="sr-only">{stage}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </div>;
}
