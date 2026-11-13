export default function OfferFields({draft,onChange,foods,lockItem=false}) {
  const field=(name,value)=>onChange({...draft,[name]:value});
  const input='mt-1 w-full rounded-xl border border-gray-200 bg-white p-2.5';
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-bold">Item or combo<select required disabled={lockItem} value={draft.menuItemId} onChange={e=>field('menuItemId',e.target.value)} className={input}><option value="">Choose item or combo</option>{foods.map(food=><option key={food.id} value={food.id}>{food.name} · ₹{((food.pricePaise??0)/100).toFixed(2)}</option>)}</select></label>
    <label className="text-sm font-bold">Offer name<input required maxLength={120} value={draft.name} onChange={e=>field('name',e.target.value)} className={input} placeholder="Study break special" /></label>
    <label className="text-sm font-bold">Discount type<select value={draft.kind} onChange={e=>field('kind',e.target.value)} className={input}><option value="PERCENT">Percentage off (%)</option><option value="AMOUNT">Amount off (₹)</option><option value="FIXED">Offer price (₹)</option></select></label>
    <label className="text-sm font-bold">{draft.kind==='PERCENT'?'Percentage (%)':draft.kind==='FIXED'?'Final price (₹)':'Discount (₹)'}<input required type="number" min={draft.kind==='FIXED'?'0':'0.01'} max={draft.kind==='PERCENT'?'100':undefined} step="0.01" value={draft.amount} onChange={e=>field('amount',e.target.value)} className={input}/></label>
    <label className="text-sm font-bold">Starts · India time<input required type="datetime-local" value={draft.startsAt} onChange={e=>field('startsAt',e.target.value)} className={input}/></label>
    <label className="text-sm font-bold">Ends · India time<input required type="datetime-local" value={draft.endsAt} onChange={e=>field('endsAt',e.target.value)} className={input}/></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={e=>field('active',e.target.checked)}/>Enabled</label>
  </div>;
}
