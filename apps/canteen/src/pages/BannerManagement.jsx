import BannerOffers from '@spoonate/portal/components/BannerOffers';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@spoonate/portal/services/api';
import { useBanners } from '@spoonate/portal/hooks/useBanners';
import { useOrders } from '@spoonate/portal/context/OrderContext';
import { bannerBody, bannerImageSrc } from '@spoonate/portal/services/promotions';
import { PromotionMenuItems } from '@spoonate/portal/components/Promotions';

const button='rounded-xl bg-[#185c3a] px-4 py-2.5 font-bold text-white disabled:opacity-50';
const input='mt-2 w-full rounded-xl border border-gray-200 bg-[#fffdf7] p-3';
const blank={title:'',description:'',imageRef:'/banners/exam-season-v1.png',active:false,targetType:'menu',targetId:null,items:[],startsAt:null,endsAt:null};

export default function BannerManagement() {
  const {banners,error,load,loading}=useBanners(true),[params,setParams]=useSearchParams();
  const [editing,setEditing]=useState(null),[creating,setCreating]=useState(false),[failure,setFailure]=useState('');
  const [pending,setPending]=useState({});
  const linked=banners.find(item=>item.id===params.get('edit'));
  const selected=editing||linked;
  async function action(banner,remove=false) {
    if(pending[banner.id])return;setFailure('');setPending(old=>({...old,[banner.id]:true}));
    try {await api(`/banners/${banner.id}`,{method:remove?'DELETE':'PATCH',...(remove?{}:{body:{...bannerBody(banner),active:!banner.active}})});await load(true);}
    catch(issue){setFailure(issue.message);}
    finally{setPending(old=>{const next={...old};delete next[banner.id];return next;});}
  }
  function close(){setEditing(null);setCreating(false);setParams({});}
  return <main className="min-h-screen bg-[#fff8e9] p-5 lg:p-10"><div className="mx-auto max-w-6xl"><Link to="/canteen" className="font-bold text-[#185c3a]">← Dashboard</Link><div className="my-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-black">Manage banners & special menus</h1><p className="mt-2 text-gray-500">One poster for every screen. Newest published banners appear first.</p></div><button className={button} onClick={()=>{close();setCreating(true);}}>+ Add banner</button></div>
    {(error||failure)&&<p role="alert" className="mb-4 text-red-700">{failure||error} <button onClick={()=>load(true)} className="underline">Reload</button></p>}
    {(creating||selected)&&<BannerEditor key={creating?'new':selected.id} banner={creating?blank:selected} close={close} saved={async()=>{close();await load(true);}} />}
    {loading&&<p role="status">Loading banners…</p>}
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{banners.map(banner=><article key={banner.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-[#fffdf7]"><img src={bannerImageSrc(banner.imageRef)} alt={banner.title} className="h-auto w-full object-contain" loading="lazy" /><div className="p-5"><div className="flex justify-between gap-2"><h2 className="text-xl font-black">{banner.title}</h2><span className="text-xs text-gray-500">{!banner.active?'Paused':banner.startsAt&&new Date(banner.startsAt)>new Date()?'Scheduled':banner.endsAt&&new Date(banner.endsAt)<=new Date()?'Ended':'Published'}</span></div><p className="mt-2 text-sm text-gray-500">{banner.description}</p><p className="mt-2 text-xs text-gray-500">{banner.items.length} selected menu items</p><div className="mt-4 flex flex-wrap gap-2"><button className={button} onClick={()=>{setCreating(false);setParams({});setEditing(banner);window.scrollTo({top:0,behavior:'smooth'});}}>Edit & menu</button><button disabled={pending[banner.id]} onClick={()=>action(banner)} className="rounded-xl border px-3 py-2">{banner.active?'Pause':'Publish'}</button><button disabled={pending[banner.id]} onClick={()=>action(banner,true)} className="rounded-xl border border-red-200 px-3 py-2 text-red-700">Delete</button></div></div></article>)}</div>
  </div></main>;
}

function dateInput(value){if(!value)return '';const date=new Date(value);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());return date.toISOString().slice(0,16);}
async function preparePoster(file) {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image.');
  if(file.size>12*1024*1024)throw Error('Choose an image smaller than 12 MB.');
  const bitmap=await createImageBitmap(file);
  try {
    const canvas=document.createElement('canvas'),ratio=Math.min(1,2000/bitmap.width);
    canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);
    if(canvas.height>8000)throw Error('Choose a landscape poster with a shorter height.');
    const context=canvas.getContext('2d');if(!context)throw Error('Could not prepare the image.');
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.88));
    if(!image||image.size>4*1024*1024)throw Error('The poster is too large. Choose a smaller image.');
    return image;
  } finally {bitmap.close();}
}

function BannerEditor({banner,close,saved}) {
  const {foods,categories}=useOrders();
  const [draft,setDraft]=useState(()=>({...bannerBody({...blank,...banner}),startsAt:dateInput(banner.startsAt),endsAt:dateInput(banner.endsAt)}));
  const [offerEditing,setOfferEditing]=useState(false);
  const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState('');
  const available=new Set(foods.map(food=>food.id));
  const selected=draft.itemIds.filter(id=>available.has(id));
  function field(name,value){setDraft(old=>({...old,[name]:value}));}
  async function upload(file){if(!file)return;setUploading(true);setError('');try{const result=await api('/banners/images',{method:'POST',body:await preparePoster(file)});field('imageRef',result.imageRef);}catch(issue){setError(issue.message);}finally{setUploading(false);}}
  async function save(event,active=draft.active){event.preventDefault();if(busy||uploading)return;if(offerEditing){setError('Add the offer to banner changes, or cancel its editor, before saving.');return;}setBusy(true);setError('');try{await api(banner.id?`/banners/${banner.id}`:'/banners',{method:banner.id?'PATCH':'POST',body:{...draft,active,itemIds:selected,targetId:['item','category'].includes(draft.targetType)?draft.targetId:null,startsAt:draft.startsAt?new Date(draft.startsAt).toISOString():null,endsAt:draft.endsAt?new Date(draft.endsAt).toISOString():null}});await saved();}catch(issue){setError(issue.message);}finally{setBusy(false);}}
  return <form onSubmit={save} className="mb-8 rounded-2xl border border-gray-200 bg-[#fffdf7] p-5 lg:p-7"><div className="flex justify-between gap-3"><h2 className="text-2xl font-black">{banner.id?'Edit banner & menu':'Create banner'}</h2><button type="button" onClick={close} className="rounded-lg border px-3 py-1">Close</button></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><div><label className="block text-sm font-bold">Title<input required maxLength={120} value={draft.title} onChange={event=>field('title',event.target.value)} className={input} /></label><label className="mt-4 block text-sm font-bold">Short description<textarea maxLength={500} value={draft.description} onChange={event=>field('description',event.target.value)} className={input} /></label><label className="mt-4 block text-sm font-bold">Poster image · same image on mobile<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event=>upload(event.target.files[0])} className={input} /></label><p className="mt-2 text-xs text-gray-500">The complete poster scales down to screen width. No cropping or separate mobile image.</p>{uploading&&<p role="status" className="mt-2 text-sm">Uploading poster…</p>}<label className="mt-4 block text-sm font-bold">Tap opens<select value={draft.targetType} onChange={event=>{field('targetType',event.target.value);field('targetId',null);}} className={input}><option value="theme">This special menu</option><option value="menu">Whole menu</option><option value="item">An item or combo</option><option value="category">A menu category</option></select></label>{['item','category'].includes(draft.targetType)&&<label className="mt-3 block text-sm font-bold">Destination<select required value={draft.targetId||''} onChange={event=>field('targetId',event.target.value)} className={input}><option value="">Choose destination</option>{(draft.targetType==='item'?foods:categories).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Start (optional)<input type="datetime-local" value={draft.startsAt} onChange={event=>field('startsAt',event.target.value)} className={input} /></label><label className="text-sm font-bold">End (optional)<input type="datetime-local" value={draft.endsAt} onChange={event=>field('endsAt',event.target.value)} className={input} /></label></div></div><div><p className="mb-2 text-sm font-bold">Full poster preview</p><img src={bannerImageSrc(draft.imageRef)} alt={draft.title||'Poster preview'} className="h-auto w-full rounded-xl border object-contain" /><p className="mb-2 mt-5 text-sm font-bold">Mobile preview · same poster</p><div className="max-w-[360px] rounded-xl border p-2"><img src={bannerImageSrc(draft.imageRef)} alt="Mobile poster preview" className="h-auto w-full object-contain" /></div><h3 className="mt-5 font-bold">Menu items · {selected.length} selected</h3><input aria-label="Find items for special menu" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Find a dish or combo…" className={input} /><div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">{foods.filter(food=>food.name.toLowerCase().includes(search.toLowerCase())).map(food=><label key={food.id} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(food.id)} onChange={event=>field('itemIds',event.target.checked?[...selected,food.id]:selected.filter(id=>id!==food.id))} />{food.name}</span><b>₹{food.price.toFixed(2)}</b></label>)}</div></div></div>
    <BannerOffers onEditingChange={setOfferEditing} onLinkedItem={id=>setDraft(old=>({...old,itemIds:[...new Set([...old.itemIds,id])]}))} foods={foods} value={{offerIds:draft.offerIds,offers:draft.offers}} onChange={value=>setDraft(old=>({...old,...value}))} startsAt={draft.startsAt} endsAt={draft.endsAt}/>
    {selected.length>0&&<div className="mt-6"><h3 className="mb-3 font-black">Special menu preview</h3><PromotionMenuItems itemIds={selected} staff /></div>}{error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}<div className="mt-5 flex flex-wrap gap-3"><button disabled={busy||uploading} className={button}>{busy?'Saving…':banner.id?'Save changes':'Save draft'}</button>{!draft.active&&<button type="button" disabled={busy||uploading} onClick={event=>{const form=event.currentTarget.form;if(form.reportValidity())void save(event,true);}} className={button}>Publish banner</button>}<button type="button" onClick={close} className="rounded-xl border px-4 py-2">Cancel</button></div>
  </form>;
}
