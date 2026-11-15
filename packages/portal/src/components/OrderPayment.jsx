import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { loadRazorpay } from '../services/razorpay';
import { useOrders } from '../context/OrderContext';

const labels = { AWAITING_ACCEPTANCE: 'Pay after the canteen accepts', AWAITING_PAYMENT: 'Accepted · Awaiting payment', PROCESSING: 'Confirming payment', FAILED: 'Payment unsuccessful · Retry available', PAID: 'Paid online · Test payment', PAYMENT_EXPIRED: 'Unpaid order expired', CANCELLED: 'Closed without payment', REVIEW_REQUIRED: 'Payment needs staff review' };
export default function OrderPayment({ order, staff = false, compact = false }) {
  const { refreshOrders } = useOrders();
  const [phase, setPhase] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [now, setNow] = useState(Date.now);
  const active = useRef(true), guard = useRef(false), dialog = useRef(null);
  useEffect(() => { active.current = true; return () => { active.current = false; dialog.current?.close(); }; }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (order.executionMode !== 'RAZORPAY_TEST') return null;
  const paid = order.paymentStatus === 'PAID';
  const deadlinePassed = !paid && order.paymentDeadline && new Date(order.paymentDeadline).getTime() <= now;
  // The server checks Razorpay before reopening the same checkout. Keep that
  // recovery action available even if an earlier setup request was interrupted.
  const canPay = !staff && order.status === 'ACCEPTED' && !paid && !deadlinePassed;
  const canCancel = !staff && !order.paymentStarted && !paid && ['RECEIVED', 'ACCEPTED'].includes(order.status);
  const safe = callback => { if (active.current) callback(); };
  async function pay() {
    if (guard.current) return;
    guard.current = true; setAction('pay'); setPhase('Opening checkout…'); setError(''); setMessage('');
    try {
      const Razorpay = await loadRazorpay();
      if (!active.current) { guard.current = false; return; }
      const checkout = await api(`/orders/${order.id}/payment/checkout`, { method: 'POST', body: {} });
      if (checkout.paid) { await refreshOrders(); guard.current = false; safe(() => setPhase('')); return; }
      if (!active.current) { guard.current = false; return; }
      let verifying = false;
      const instance = new Razorpay({
        key: checkout.keyId, order_id: checkout.razorpayOrderId, amount: checkout.amountPaise, currency: checkout.currency,
        name: 'SpoonAte', description: 'Accepted canteen order · Test payment', theme: { color: '#075d50' },
        handler: async response => {
          verifying = true; safe(() => setPhase('Confirming payment…'));
          try {
            if (!active.current) return;
            const fresh = await api(`/orders/${order.id}/payment/verify`, { method: 'POST', body: {
              razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature,
            } });
            safe(() => setMessage(fresh.paymentStatus === 'PAID' ? 'Payment confirmed. The canteen can now prepare your order.' : 'Payment is being confirmed automatically. Do not pay again.'));
          } catch (issue) { safe(() => setError(issue.message)); }
          finally { guard.current = false; safe(() => setPhase('')); await refreshOrders(); }
        },
        modal: { ondismiss: () => { if (!verifying) { guard.current = false; safe(() => { setPhase(''); setMessage('Checkout closed. Retrying checks your existing payment before reopening checkout. If you were debited, wait for confirmation.'); }); void refreshOrders(); } } },
      });
      dialog.current = instance;
      instance.on('payment.failed', () => safe(() => setMessage('Payment attempt failed. You can retry in checkout before the payment deadline.')));
      instance.open(); safe(() => setPhase('Checkout open…'));
    } catch (issue) { guard.current = false; safe(() => { setError(issue.message); setPhase(''); }); void refreshOrders(); }
  }
  async function cancel() {
    if (guard.current || !window.confirm('Cancel this unpaid order?')) return;
    guard.current = true; setAction('cancel'); setPhase('Cancelling…'); setError('');
    try { await api(`/orders/${order.id}/payment/cancel`, { method: 'POST', body: {} }); await refreshOrders(); }
    catch (issue) { safe(() => setError(issue.message)); }
    finally { guard.current = false; safe(() => setPhase('')); }
  }
  return <section aria-label="Order payment" className={`${compact ? 'mt-3 p-4' : 'my-5 p-5'} rounded-xl border border-[#dce9df] bg-[#f2f7f3] text-[#173d32]`}>
    <p className="font-bold">{deadlinePassed ? 'Payment window ended' : labels[order.paymentStatus] || 'Payment status unavailable'}</p>
    {deadlinePassed && <p className="mt-2 text-sm">This unpaid order closes automatically. If a payment was already started, its status will still be checked. A verified late payment restores the order for preparation.</p>}
    {order.paymentDeadline && !paid && order.status === 'ACCEPTED' && <p className="mt-2 text-sm">Pay by {new Date(order.paymentDeadline).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })} IST.</p>}
    {!compact && !paid && <p className="mt-2 text-sm">{staff ? 'Preparation starts only after verified payment.' : 'Payment is requested only after acceptance. Once paid, orders cannot be cancelled or refunded.'}</p>}
    {order.closedReason === 'PAYMENT_EXPIRED' && <p className="mt-2 text-sm">Payment was not confirmed before the deadline. Any payment already started is checked automatically. A verified late payment reactivates the accepted order.</p>}
    {order.closedReason === 'STUDENT_CANCELLED' && <p className="mt-2 text-sm">You cancelled before starting payment.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {canPay && <button disabled={Boolean(phase)} onClick={pay} className="rounded-lg bg-[#075d50] px-4 py-2 font-bold text-white disabled:opacity-50">{action === 'pay' && phase ? phase : order.paymentStatus === 'PROCESSING' ? 'Resume payment' : `${order.paymentStatus === 'FAILED' ? 'Retry payment' : 'Pay'} ₹${(order.totalPaise / 100).toFixed(2)}`}</button>}
      {canCancel && <button disabled={Boolean(phase)} onClick={cancel} className="rounded-lg px-2 py-2 text-sm underline disabled:opacity-50">{action === 'cancel' && phase ? phase : 'Cancel unpaid order'}</button>}
    </div>
    {message && !paid && <p role="status" className="mt-3 text-sm">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {!staff && !compact && <p className="mt-3 text-xs text-slate-500">Razorpay Test Mode · No real money moves.</p>}
  </section>;
}
