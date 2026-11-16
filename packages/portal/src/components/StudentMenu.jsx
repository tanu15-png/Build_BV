import { MenuLoading } from './Brand';
import MenuItemCard, { menuGrid } from './MenuItemCard';
import { useSearchParams } from 'react-router-dom';
import { useOrders } from '../context/OrderContext';

export default function StudentMenu({ query = '' }) {
  const { foods, categories, catalogLoading } = useOrders();
  const [params,setParams]=useSearchParams();
  const category=params.get('category'),target=params.get('item'),offersOnly=params.get('offers')==='1';
  const setCategory=id=>setParams(current=>{const next=new URLSearchParams(current);next.delete('item');if(id)next.set('category',id);else next.delete('category');return next;});
  const items = foods.filter(f => f.cafeId === 'canteen' && (!offersOnly || f.offer) && (!target || f.id === target) && (!category || f.categoryId === category) && `${f.name} ${f.description || ''}`.toLowerCase().includes(target?'':query));
  const canteenCategories = categories.filter(c => foods.some(f => f.cafeId === 'canteen' && f.categoryId === c.id));
  return <section id="cafes" className="scroll-mt-5 pb-20" aria-label="Full menu"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-black">Our menu</h2><a href="/menu-image-credits.html" target="_blank" rel="noreferrer" className="text-[11px] text-gray-500 underline">Illustrative images · Sources</a></div><div className="mb-3 flex gap-2 overflow-x-auto pb-2"><button aria-pressed={offersOnly} onClick={()=>setParams(current=>{const next=new URLSearchParams(current);next.delete('item');if(offersOnly)next.delete('offers');else next.set('offers','1');return next;})} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${offersOnly?'border-amber-500 bg-amber-100 text-amber-900':'border-amber-200 bg-amber-50 text-amber-900'}`}>✦ Offers</button>{[{ id: null, name: 'All' }, ...canteenCategories].map(c => <button key={c.id || 'all'} onClick={() => setCategory(c.id)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${category === c.id ? 'bg-[#185c3a] text-white' : 'bg-[#fffdf7]'}`}>{c.name}</button>)}</div>
    {(catalogLoading && !foods.length) && <MenuLoading />}
    {!(catalogLoading && !foods.length) && <div className={menuGrid}>{items.map(food => <MenuItemCard key={food.id} food={food} />)}</div>}
    {!(catalogLoading && !foods.length) && !items.length && <p className="rounded-2xl bg-[#fffdf7] p-6 text-gray-500">No menu items match your search.</p>}
  </section>;
}
