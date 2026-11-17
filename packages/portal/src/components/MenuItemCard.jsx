import { showMenuImage } from '../utils/menuRules';
import OfferPrice from './OfferPrice';
import { useId, useRef } from 'react';
import { useOrders } from '../context/OrderContext';

export const menuGrid = 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3';
export default function MenuItemCard({ food, staff = false }) {
  const { cart, addToCart, isFoodAvailable } = useOrders();
  const details = useRef(null);
  const titleId = useId();
  const available = isFoodAvailable(food), quantity = cart.find(item => item.id === food.id)?.quantity;
  const discounted = food.offer && (food.price ?? food.effectivePricePaise / 100) < food.pricePaise / 100;
  const showImage = showMenuImage(food);
  const imageAlt = food.illustrative ? `Illustrative image of ${food.name}` : food.name;
  const imageError = event => { if (!event.currentTarget.src.endsWith('/food-placeholder.svg')) event.currentTarget.src = '/food-placeholder.svg'; };
  const add = () => { addToCart(food); details.current?.close(); };
  return <article className={`grid min-w-0 gap-3 rounded-xl border border-[#e9e4d5] bg-[#fffdf7] transition-colors hover:border-[#9fb598] ${showImage ? "min-h-[132px] grid-cols-[104px_minmax(0,1fr)] p-2 sm:grid-cols-[96px_minmax(0,1fr)] xl:grid-cols-[104px_minmax(0,1fr)]" : "min-h-[112px] grid-cols-1 p-4"}`}>
    {showImage && <button type="button" onClick={() => details.current?.showModal()} aria-label={`View ${food.name} details`} className="aspect-square w-full self-center overflow-hidden rounded-lg bg-[#f5f0df]">
      <img src={food.image} alt={imageAlt} loading="lazy" decoding="async" onError={imageError} className={`h-full w-full object-cover ${available || staff ? '' : 'opacity-60'}`} />
    </button>}
    <div className="flex min-w-0 flex-col py-1">
      <h3 className="text-sm font-bold leading-[1.3] text-[#203d2b]"><button type="button" onClick={() => details.current?.showModal()} className="line-clamp-2 text-left" title={food.name}>{food.name}</button></h3>
      {discounted && <span className="mt-1.5 self-start rounded-full bg-[#f5d875] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#4b3e12]">Offer</span>}
      <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 pt-3"><span className="min-w-0 [&>span]:max-w-full [&_b]:order-1 [&_b]:text-base [&_del]:order-2 [&_del]:text-[11px]"><OfferPrice item={food} compact showBadge={false} /></span>{staff ? <span className="text-xs text-gray-500">{food.available ? 'Available' : 'Paused'}</span> : <button aria-label={`Add ${food.name} to cart`} disabled={!available} onClick={add} className="min-h-9 shrink-0 rounded-lg bg-[#185c3a] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#12492e] disabled:cursor-not-allowed disabled:opacity-40">{available ? quantity ? `Add (${quantity}) +` : 'Add +' : 'Unavailable'}</button>}</div>
    </div>
    <dialog ref={details} aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) details.current.close(); }} className="fixed inset-0 m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-gray-100 bg-[#fffdf7] p-0 text-[#203d2b] backdrop:bg-black/40">
      <div className="p-5"><div className="flex items-start justify-between gap-3"><h2 id={titleId} className="text-xl font-black">{food.name}</h2><button type="button" aria-label="Close item details" onClick={() => details.current.close()} className="rounded-lg border px-3 py-1 text-lg">×</button></div>{showImage && <img src={food.image} alt={imageAlt} loading="lazy" onError={imageError} className="my-4 max-h-64 w-full rounded-xl object-contain" />}<p className="text-sm text-gray-500">{food.category}</p>{food.description && <p className="mt-2 text-sm leading-relaxed">{food.description}</p>}<div className="mt-4"><OfferPrice item={food} /></div>{showImage && food.illustrative && <p className="mt-3 text-xs text-gray-500">Illustrative image. Actual presentation may vary.</p>}{!staff && <button disabled={!available} onClick={add} className="mt-5 w-full rounded-xl bg-[#185c3a] px-4 py-3 font-bold text-white disabled:opacity-40">{available ? quantity ? `Add another (${quantity} in cart)` : 'Add to cart' : 'Unavailable'}</button>}</div>
    </dialog>
  </article>;
}
