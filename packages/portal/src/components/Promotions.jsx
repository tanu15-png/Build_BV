import { showMenuImage } from '../utils/menuRules';
import MenuItemCard, { menuGrid } from './MenuItemCard';
import OfferPrice from './OfferPrice';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '../context/OrderContext';
import { useBanners } from '../hooks/useBanners';
import { bannerHref, bannerImageSrc } from '../services/promotions';

export default function Promotions({staff=false}) {
  const {banners,error,load}=useBanners(staff);
  const {foods}=useOrders();
  const [slide,setSlide]=useState(0),track=useRef(null);
  const current=Math.min(slide,Math.max(0,banners.length-1));
  const container = useRef(null);
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false), [dragging, setDragging] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden), [onScreen, setOnScreen] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [rotationKey, setRotationKey] = useState(0);
  const go = useCallback(index => {
    const el=track.current;
    if(el)el.scrollTo({left:index*el.clientWidth,behavior:reducedMotion?'auto':'smooth'});
    setRotationKey(value => value + 1);
  }, [reducedMotion]);
  useEffect(() => {
    const visibility = () => setVisible(!document.hidden), stopDrag = () => setDragging(false);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)'), changeMotion = event => setReducedMotion(event.matches);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pointerup', stopDrag); window.addEventListener('pointercancel', stopDrag);
    motion.addEventListener('change', changeMotion);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pointerup', stopDrag); window.removeEventListener('pointercancel', stopDrag); motion.removeEventListener('change', changeMotion); };
  }, []);
  useEffect(() => {
    if (!container.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => setOnScreen(entries[0].isIntersecting), { threshold: .15 });
    observer.observe(container.current); return () => observer.disconnect();
  }, [banners.length]);
  useEffect(() => {
    if (staff || banners.length < 2 || hovered || focused || dragging || !visible || !onScreen || reducedMotion) return;
    const timer = setTimeout(() => go((current + 1) % banners.length), 2000);
    return () => clearTimeout(timer);
  }, [staff, banners.length, current, hovered, focused, dragging, visible, onScreen, reducedMotion, rotationKey, go]);
  if(!banners.length&&!staff&&!error)return null;
  return <section ref={container} onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }} onPointerLeave={event => { if (event.pointerType === 'mouse') setHovered(false); }} className="mb-8 min-w-0" aria-label="Promotions and special menus">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">{staff?'Promotions & special menus':'A little something special'}</h2>{staff?<Link className="font-bold text-[#185c3a]" to="/canteen/banners">Manage banners →</Link>:banners.length>1&&<div className="flex gap-2"><button aria-label="Previous banner" className="rounded-full border px-3 py-1" onClick={()=>go((current+banners.length-1)%banners.length)}>←</button><button aria-label="Next banner" className="rounded-full border px-3 py-1" onClick={()=>go((current+1)%banners.length)}>→</button></div>}</div>
    {error&&<p role="alert" className="mb-3 text-red-700">{error} <button className="underline" onClick={()=>load(true)}>Retry</button></p>}
    {!staff&&banners.length>0&&<><div ref={track} onPointerDown={() => setDragging(true)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} aria-roledescription="carousel" aria-label="Promotional banners" onScroll={event=>{const el=event.currentTarget;if(el.clientWidth)setSlide(Math.round(el.scrollLeft/el.clientWidth));}} className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-2xl" style={{scrollbarWidth:'none'}}>{banners.map((banner,index)=><Link key={banner.id} to={bannerHref(banner)} aria-label={`${banner.title} — open menu`} className="block w-full min-w-full shrink-0 snap-start bg-[#f2f2eb]"><img src={bannerImageSrc(banner.imageRef)} alt={banner.title} loading={index===0?'eager':'lazy'} decoding="async" className="block h-auto w-full object-contain" /></Link>)}</div>{banners.length>1&&<div className="my-3 flex justify-center gap-2">{banners.map((banner,index)=><button key={banner.id} aria-label={`Show ${banner.title}`} aria-current={current===index?'true':undefined} onClick={()=>go(index)} className={`h-2 rounded-full ${current===index?'w-6 bg-[#185c3a]':'w-2 bg-gray-300'}`} />)}</div>}</>}
    {banners.length>0&&(()=>{
      const banner=banners[current], selected=banner.items.map(line=>foods.find(food=>food.id===line.menuItemId)).filter(Boolean);
      return <article key={banner.id} className="mt-3 flex flex-col gap-3 overflow-hidden rounded-2xl border border-[#dce7df] bg-gradient-to-r from-[#e8f2eb] via-white to-[#fff7df] p-3 sm:flex-row sm:items-center sm:p-4">
        {staff&&<img src={bannerImageSrc(banner.imageRef)} alt={banner.title} className="w-40 rounded-lg object-contain"/>}
        <div className="min-w-0 sm:w-44 sm:shrink-0"><p className="text-[10px] font-bold uppercase tracking-widest text-[#65836d]">Featured menu · {current+1}/{banners.length}</p><h3 className="font-black text-[#174b3b]">{banner.title}</h3><p className="mt-1 line-clamp-1 text-xs text-gray-500">{banner.description}</p></div>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">{selected.slice(0,3).map(food=><div key={food.id} className="flex min-w-36 shrink-0 items-center gap-2 rounded-xl bg-white/80 p-2 sm:min-w-0 sm:flex-1">{showMenuImage(food) && <img src={food.image} alt="" className="h-10 w-10 rounded-lg object-cover"/>}<div className="min-w-0"><p className="truncate text-xs font-bold">{food.name}</p><OfferPrice item={food} compact/></div></div>)}</div>
        <Link to={staff?`/canteen/banners?edit=${banner.id}`:bannerHref(banner)} className="shrink-0 rounded-full bg-[#185c3a] px-4 py-2 text-center text-xs font-bold text-white">{staff?'Edit banner':`View menu · ${selected.length} items`} →</Link>
      </article>;
    })()}
    {staff&&banners.length>1&&<div className="mt-3 flex justify-center gap-2">{banners.map((banner,index)=><button key={banner.id} aria-label={`Preview ${banner.title}`} aria-current={current===index?'true':undefined} onClick={()=>setSlide(index)} className={`h-2 rounded-full ${current===index?'w-6 bg-[#185c3a]':'w-2 bg-gray-300'}`} />)}</div>}
    {staff&&!banners.length&&<p className="rounded-xl bg-[#fffdf7] p-5 text-gray-500">Create a banner to feature a special menu.</p>}
  </section>;
}

export function PromotionMenuItems({itemIds,staff=false}) {
  const {foods}=useOrders();
  const items=itemIds.map(id=>foods.find(food=>food.id===id)).filter(Boolean);
  return <div className={menuGrid}>{items.map(food => <MenuItemCard key={food.id} food={food} staff={staff} />)}</div>;
}
