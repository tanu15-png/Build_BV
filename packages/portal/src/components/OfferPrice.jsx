export default function OfferPrice({item,compact=false,showBadge=true}) {
  const base=(item.originalUnitPricePaise ?? item.pricePaise ?? 0)/100;
  const price=item.price ?? (item.unitPricePaise ?? item.effectivePricePaise ?? item.pricePaise)/100;
  const offer=item.offer && price<base;
  return <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
    {offer&&showBadge&&<span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-900">Offer</span>}
    {offer&&<del className="text-xs font-normal text-gray-400">₹{base.toFixed(2)}</del>}
    <b className={compact?'text-sm text-[#075d50]':'text-lg text-[#075d50]'}>₹{price.toFixed(2)}</b>
    {offer&&!compact&&<span className="basis-full break-words text-xs text-amber-800">{item.offer.name} · Until {new Date(item.offer.endsAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>}
  </span>;
}
