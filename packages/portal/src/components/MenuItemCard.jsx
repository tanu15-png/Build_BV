import OfferPrice from './OfferPrice';
import { useOrders } from '../context/OrderContext';

export const menuGrid = 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';
export default function MenuItemCard({ food, staff = false }) {
  const { cart, addToCart, isFoodAvailable } = useOrders();
  const available = isFoodAvailable(food), quantity = cart.find(item => item.id === food.id)?.quantity;
  return <article className="flex min-w-0 flex-col rounded-xl border border-gray-100 bg-white p-2.5">
    <img src={food.image} alt={food.illustrative ? `Illustrative image of ${food.name}` : food.name} loading="lazy" decoding="async" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/food-placeholder.svg'; }} className="h-12 w-full rounded-lg object-contain sm:h-14" />
    <h3 title={food.description || food.name} className="mt-1.5 line-clamp-2 min-h-8 text-xs font-bold leading-4 text-[#173d32]">{food.name}</h3>
    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5"><OfferPrice item={food} compact />{staff ? <span className="text-xs">{food.available ? 'Available' : 'Paused'}</span> : <button aria-label={`Add ${food.name} to cart`} disabled={!available} onClick={() => addToCart(food)} className="min-h-9 shrink-0 rounded-lg bg-[#0f8f73] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">{available ? quantity ? `Add (${quantity}) +` : 'Add +' : 'Unavailable'}</button>}</div>
    {(food.description || food.offer) && <details className="mt-1 text-[10px] text-gray-500"><summary className="cursor-pointer">{food.category === 'Combos' ? 'Contents' : 'Details'}</summary>{food.description && <p className="mt-1">{food.description}</p>}{food.offer && <p className="mt-1 text-amber-800">{food.offer.name} · Until {new Date(food.offer.endsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}</details>}
  </article>;
}
