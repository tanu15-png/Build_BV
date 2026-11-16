import { useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '@spoonate/portal/services/api';

export default function OrderRating({ order }) {
  const [selected, setSelected] = useState(0), [submitted, setSubmitted] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const rating = order.rating ?? submitted;
  async function submit(event) {
    event.preventDefault();
    if (!selected || pending.current) return;
    pending.current = true; setSubmitted(selected); setBusy(true); setError('');
    try { const saved = await api(`/orders/${order.id}/rating`, { method: 'POST', body: { rating: selected } }); setSubmitted(saved.rating); }
    catch (issue) { setSubmitted(null); setError(issue.message || 'Could not submit your rating. Please retry.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="mt-6 rounded-2xl border border-[#e9e4d5] bg-[#fff8e9] p-5" aria-label="Order rating">
    <h2 className="text-lg font-black">How was your food?</h2>
    {rating ? <p role="status" className="mt-3 font-bold text-[#185c3a]">Your rating: {'★'.repeat(rating)}{'☆'.repeat(5-rating)} · {rating}/5. <span className="text-sm font-medium">{busy && !order.rating ? 'Saving…' : 'Thank you!'}</span></p> : <form onSubmit={submit}>
      <fieldset disabled={busy} className="mt-3"><legend className="text-sm text-gray-600">Choose a rating from 1 to 5 stars</legend><div className="mt-2 flex gap-1">{[1,2,3,4,5].map(value=><label key={value} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#185c3a]"><input type="radio" name={`rating-${order.id}`} value={value} checked={selected===value} onChange={()=>setSelected(value)} className="sr-only" aria-label={`${value} ${value===1?'star':'stars'}`} /><Star aria-hidden="true" size={30} className={value<=selected?'fill-[#efad48] text-[#a66614]':'text-gray-400'} /></label>)}</div></fieldset>
      <button disabled={!selected || busy} className="mt-3 rounded-xl bg-[#185c3a] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Submitting…':'Submit rating'}</button>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </form>}
  </section>;
}
