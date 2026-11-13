import OfferPrice from './OfferPrice';
import { useSearchParams } from 'react-router-dom';
import { useOrders } from '../context/OrderContext';

export default function StudentMenu({ query = '' }) {
  const { foods, categories, cart, addToCart, isFoodAvailable, catalogLoading } = useOrders();
  const [params,setParams]=useSearchParams();
  const category=params.get('category'),target=params.get('item'),offersOnly=params.get('offers')==='1';
  const setCategory=id=>setParams(current=>{const next=new URLSearchParams(current);next.delete('item');if(id)next.set('category',id);else next.delete('category');return next;});
  const items = foods.filter(f => f.cafeId === 'canteen' && (!offersOnly || f.offer) && (!target || f.id === target) && (!category || f.categoryId === category) && `${f.name} ${f.description || ''}`.toLowerCase().includes(target?'':query));
  const canteenCategories = categories.filter(c => foods.some(f => f.cafeId === 'canteen' && f.categoryId === c.id));
  return <section id="cafes" className="scroll-mt-5 pb-20" aria-label="Full menu"><h2 className="mb-5 text-2xl font-black">Our menu</h2><div className="mb-6 flex gap-3 overflow-x-auto pb-2"><button aria-pressed={offersOnly} onClick={()=>setParams(current=>{const next=new URLSearchParams(current);next.delete('item');if(offersOnly)next.delete('offers');else next.set('offers','1');return next;})} className={`whitespace-nowrap rounded-full border px-5 py-2 font-bold ${offersOnly?'border-amber-500 bg-amber-100 text-amber-900':'border-amber-200 bg-amber-50 text-amber-900'}`}>✦ Offers</button>{[{ id: null, name: 'All' }, ...canteenCategories].map(c => <button key={c.id || 'all'} onClick={() => setCategory(c.id)} className={`whitespace-nowrap rounded-full border px-5 py-2 font-bold ${category === c.id ? 'bg-[#075d50] text-white' : 'bg-white'}`}>{c.name}</button>)}</div>
    {catalogLoading && !foods.length && <p role="status">Loading menu…</p>}
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map(food => <article key={food.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white"><img src={food.image} alt={food.name} loading="lazy" className="aspect-[4/3] w-full object-cover" /><div className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#0f8f73]">{food.category}</p><h3 className="mt-2 text-lg font-black">{food.name}</h3><p className="mt-2 text-sm text-gray-500">{food.description}</p><div className="mt-5 flex items-center justify-between gap-3"><OfferPrice item={food} /><button disabled={!isFoodAvailable(food)} onClick={() => addToCart(food)} className="shrink-0 whitespace-nowrap rounded-xl bg-[#0f8f73] px-4 py-2 font-bold text-white disabled:opacity-40">{isFoodAvailable(food) ? (cart.some(i => i.id === food.id) ? `Add more (${cart.find(i => i.id === food.id).quantity})` : 'Add to cart') : 'Unavailable'}</button></div></div></article>)}</div>
    {!catalogLoading && !items.length && <p className="rounded-2xl bg-white p-6 text-gray-500">No menu items match your search.</p>}
  </section>;
}
