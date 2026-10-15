import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrders } from '../../context/OrderContext';
const pickupOptions = [10, 20, 30, 45, 60];
export default function Checkout() {
  const { cart, cartState, cafes, reviewCart, cartBusy, catalogError, createOrder, orderBusy, pendingCheckout } = useOrders();
  const navigate = useNavigate();
  const [minutes, setMinutes] = useState(20);
  const [error, setError] = useState('');
  const [reviewedQuote, setReviewedQuote] = useState('');
  const cafe = cafes.find(item => item.databaseId === cartState?.canteenId);
  const review = async () => {
    setError(''); setReviewedQuote('');
    try { const fresh = await reviewCart(); setReviewedQuote(fresh.quote); }
    catch (issue) { setError(issue.message); }
  };
  const placeOrder = async () => {
    setError('');
    try {
      const order = await createOrder({ expectedVersion: cartState?.version,
        quote: reviewedQuote, pickupAt: new Date(Date.now() + minutes * 60000).toISOString() });
      navigate('/student/order-success?id=' + order.id, { replace: true });
    } catch (issue) { setError(issue.message); setReviewedQuote(''); }
  };
  return <div className="min-h-screen bg-[#f8faf9] p-5 lg:p-10"><main className="mx-auto max-w-2xl">
    <Link to="/student/cart" className="font-bold text-[#075d50]">← Back to cart</Link>
    <h1 className="mt-6 text-3xl font-black">Review and place your order</h1>
    <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{cafe?.name || 'Your items'}</h2>
      <div className="mt-5 space-y-3">{cart.map(item => <div key={item.lineId} className="flex justify-between gap-3"><span>{item.name} × {item.quantity}{!item.available && <span className="block text-sm text-red-700">Currently unavailable</span>}</span><strong>₹{(item.unitPricePaise * item.quantity / 100).toFixed(2)}</strong></div>)}</div>
      <p className="mt-5 border-t pt-5 text-xl font-black">Total: ₹{((cartState?.totalPaise || 0) / 100).toFixed(2)}</p>
      <fieldset disabled={orderBusy || Boolean(pendingCheckout)} className="mt-6"><legend className="font-bold">Estimated arrival at the canteen</legend><div className="mt-3 flex flex-wrap gap-3">{pickupOptions.map(value => <button key={value} type="button" aria-pressed={minutes === value} onClick={() => setMinutes(value)} className={'rounded-xl border px-4 py-3 font-bold ' + (minutes === value ? 'border-[#075d50] bg-green-50' : '')}>In {value} minutes</button>)}</div></fieldset>
      {pendingCheckout ? <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-900">The previous submission has not been confirmed. Retry it to retrieve the same order. Its original items and pickup time will be used.</p> : <>
        <p className="mt-4 text-sm text-gray-600">Check the latest prices and availability before submitting.</p>
        <button onClick={review} disabled={!cart.length || cartBusy || orderBusy || Boolean(catalogError)} className="mt-5 w-full rounded-xl border border-[#075d50] p-3 font-bold text-[#075d50] disabled:opacity-50">{cartBusy ? 'Checking…' : 'Review current prices and availability'}</button>
        {reviewedQuote && reviewedQuote === cartState?.quote && <p role="status" className="mt-4 text-green-700">Your cart is up to date.</p>}
      </>}
      <button onClick={placeOrder} disabled={orderBusy || cartBusy || (!pendingCheckout && (!cart.length || !reviewedQuote || reviewedQuote !== cartState?.quote || Boolean(catalogError)))} className="mt-5 w-full rounded-xl bg-[#075d50] p-3 font-bold text-white disabled:opacity-50">{orderBusy ? 'Submitting…' : pendingCheckout ? 'Retry previous submission' : 'Place test order'}</button>
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      <p className="mt-5 text-sm text-gray-600">No payment is collected. The canteen will accept your order before preparing it.</p>
    </section>
  </main></div>;
}
