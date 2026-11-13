import OfferPrice from './OfferPrice';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrders } from '../context/OrderContext';
import { useBanners } from '../hooks/useBanners';
import { bannerHref, bannerImageSrc } from '../services/promotions';

export default function Promotions({staff=false}) {
  const {banners,error,load}=useBanners(staff);
  const {foods}=useOrders();
  const [slide,setSlide]=useState(0),track=useRef(null);
  const current=Math.min(slide,Math.max(0,banners.length-1));
  function go(index){const el=track.current;if(el)el.scrollTo({left:index*el.clientWidth,behavior:'smooth'});}
  if(!banners.length&&!staff&&!error)return null;
  return <section className="mb-8 min-w-0" aria-label="Promotions and special menus">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">{staff?'Promotions & special menus':'A little something special'}</h2>{staff?<Link className="font-bold text-[#075d50]" to="/canteen/banners">Manage banners →</Link>:banners.length>1&&<div className="flex gap-2"><button aria-label="Previous banner" className="rounded-full border px-3 py-1" onClick={()=>go((current+banners.length-1)%banners.length)}>←</button><button aria-label="Next banner" className="rounded-full border px-3 py-1" onClick={()=>go((current+1)%banners.length)}>→</button></div>}</div>
    {error&&<p role="alert" className="mb-3 text-red-700">{error} <button className="underline" onClick={()=>load(true)}>Retry</button></p>}
    {!staff&&banners.length>0&&<><div ref={track} aria-roledescription="carousel" aria-label="Promotional banners" onScroll={event=>{const el=event.currentTarget;if(el.clientWidth)setSlide(Math.round(el.scrollLeft/el.clientWidth));}} className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-2xl" style={{scrollbarWidth:'none'}}>{banners.map((banner,index)=><Link key={banner.id} to={bannerHref(banner)} aria-label={`${banner.title} — open menu`} className="block w-full min-w-full shrink-0 snap-start bg-[#f2f2eb]"><img src={bannerImageSrc(banner.imageRef)} alt={banner.title} loading={index===0?'eager':'lazy'} decoding="async" className="block h-auto w-full object-contain" /></Link>)}</div>{banners.length>1&&<div className="my-3 flex justify-center gap-2">{banners.map((banner,index)=><button key={banner.id} aria-label={`Show ${banner.title}`} aria-current={current===index?'true':undefined} onClick={()=>go(index)} className={`h-2 rounded-full ${current===index?'w-6 bg-[#075d50]':'w-2 bg-gray-300'}`} />)}</div>}</>}
    {banners.length>0&&(()=>{
      const banner=banners[current], selected=banner.items.map(line=>foods.find(food=>food.id===line.menuItemId)).filter(Boolean);
      return <article key={banner.id} className="mt-3 flex flex-col gap-3 overflow-hidden rounded-2xl border border-[#dce7df] bg-gradient-to-r from-[#e8f2eb] via-white to-[#fff7df] p-3 sm:flex-row sm:items-center sm:p-4">
        {staff&&<img src={bannerImageSrc(banner.imageRef)} alt={banner.title} className="w-40 rounded-lg object-contain"/>}
        <div className="min-w-0 sm:w-44 sm:shrink-0"><p className="text-[10px] font-bold uppercase tracking-widest text-[#65836d]">Featured menu · {current+1}/{banners.length}</p><h3 className="font-black text-[#174b3b]">{banner.title}</h3><p className="mt-1 line-clamp-1 text-xs text-gray-500">{banner.description}</p></div>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">{selected.slice(0,3).map(food=><div key={food.id} className="flex min-w-36 shrink-0 items-center gap-2 rounded-xl bg-white/80 p-2 sm:min-w-0 sm:flex-1"><img src={food.image} alt="" className="h-10 w-10 rounded-lg object-cover"/><div className="min-w-0"><p className="truncate text-xs font-bold">{food.name}</p><OfferPrice item={food} compact/></div></div>)}</div>
        <Link to={staff?`/canteen/banners?edit=${banner.id}`:bannerHref(banner)} className="shrink-0 rounded-full bg-[#075d50] px-4 py-2 text-center text-xs font-bold text-white">{staff?'Edit banner':`View menu · ${selected.length} items`} →</Link>
      </article>;
    })()}
    {staff&&banners.length>1&&<div className="mt-3 flex justify-center gap-2">{banners.map((banner,index)=><button key={banner.id} aria-label={`Preview ${banner.title}`} aria-current={current===index?'true':undefined} onClick={()=>setSlide(index)} className={`h-2 rounded-full ${current===index?'w-6 bg-[#075d50]':'w-2 bg-gray-300'}`} />)}</div>}
    {staff&&!banners.length&&<p className="rounded-xl bg-white p-5 text-gray-500">Create a banner to feature a special menu.</p>}
  </section>;
}

export function PromotionMenuItems({itemIds,staff=false}) {
  const {foods,cart,addToCart,isFoodAvailable}=useOrders();
  const items=itemIds.map(id=>foods.find(food=>food.id===id)).filter(Boolean);
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(food=><article key={food.id} className="rounded-2xl border bg-white p-5"><p className="text-xs text-gray-500">{food.category}</p><h2 className="mt-1 text-lg font-black">{food.name}</h2><p className="my-3 text-sm text-gray-500">{food.description}</p><div className="flex items-center justify-between gap-3"><OfferPrice item={food} />{staff?<span className="text-xs">{food.available?'Available':'Unavailable'}</span>:<button disabled={!isFoodAvailable(food)} onClick={()=>addToCart(food)} className="shrink-0 whitespace-nowrap rounded-xl bg-[#075d50] px-4 py-2 font-bold text-white disabled:opacity-40">{isFoodAvailable(food)?cart.some(item=>item.id===food.id)?`Add more (${cart.find(item=>item.id===food.id).quantity})`:'Add to cart':'Unavailable'}</button>}</div></article>)}</div>;
}
