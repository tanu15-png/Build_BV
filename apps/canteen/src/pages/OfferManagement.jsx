import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@spoonate/portal/services/api';
import { useOrders } from '@spoonate/portal/context/OrderContext';
import OfferFields from '@spoonate/portal/components/OfferFields';
import { offerBody, offerDraft, offerStatus } from '@spoonate/portal/services/offers';

const button='rounded-xl bg-[#185c3a] px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
export default function OfferManagement(){
  const {foods,refreshCatalog}=useOrders();
  const [offers,setOffers]=useState([]),[draft,setDraft]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState({}),[saving,setSaving]=useState(false);
  const load=useCallback(async()=>{try{setOffers((await api('/offers/manage',{fresh:true})).items);}catch(issue){setError(issue.message);}},[]);
  useEffect(()=>{const timer=setTimeout(()=>{void load();},0);return()=>clearTimeout(timer);},[load]);
  useEffect(()=>{const boundaries=offers.filter(o=>o.active).flatMap(o=>[Date.parse(o.startsAt),Date.parse(o.endsAt)]).filter(time=>time>Date.now());if(!boundaries.length)return;const timer=setTimeout(()=>{void load();},Math.min(2147483647,Math.max(50,Math.min(...boundaries)-Date.now()+25)));return()=>clearTimeout(timer);},[offers,load]);
  async function save(event){event.preventDefault();setSaving(true);setError('');try{await api(draft.id?`/offers/${draft.id}`:'/offers',{method:draft.id?'PATCH':'POST',body:offerBody(draft)});setDraft(null);await Promise.all([load(),refreshCatalog()]);}catch(issue){setError(issue.message);}finally{setSaving(false);}}
  async function action(offer,remove=false){
    if(busy[offer.id])return;setBusy(old=>({...old,[offer.id]:true}));setError('');
    if(!remove)setOffers(old=>old.map(row=>row.id===offer.id?{...row,active:!row.active}:row));
    try{await api(`/offers/${offer.id}`,{method:remove?'DELETE':'PATCH',body:remove?{expectedVersion:offer.version}:{...offer,active:!offer.active,expectedVersion:offer.version}});await Promise.all([load(),refreshCatalog()]);}
    catch(issue){if(!remove)setOffers(old=>old.map(row=>row.id===offer.id?offer:row));setError(issue.message);}finally{setBusy(old=>({...old,[offer.id]:false}));}
  }
  return <main className="min-h-screen bg-[#fff8e9] p-5 lg:p-10"><div className="mx-auto max-w-5xl"><Link to="/canteen" className="font-bold text-[#185c3a]">← Dashboard</Link><div className="my-6 flex items-center justify-between gap-3"><div><h1 className="text-3xl font-black">Manage offers</h1><p className="mt-2 text-sm text-gray-500">Timed discounts for menu items and combos. One offer per item at a time.</p></div><button className={button} onClick={()=>setDraft(offerDraft())}>+ Add offer</button></div>
    {error&&<p role="alert" className="mb-4 text-red-700">{error} <button className="underline" onClick={load}>Reload</button></p>}
    {draft&&<form onSubmit={save} className="mb-6 rounded-2xl border bg-[#fffdf7] p-5"><h2 className="mb-4 text-xl font-black">{draft.id?'Edit offer':'New offer'}</h2><OfferFields draft={draft} onChange={setDraft} foods={foods} lockItem={Boolean(draft.id)}/><div className="mt-4 flex gap-3"><button disabled={saving} className={button}>{saving?'Saving…':'Save offer'}</button><button type="button" className="rounded-xl border px-4 py-2" onClick={()=>setDraft(null)}>Cancel</button></div></form>}
    <div className="space-y-3">{offers.map(offer=>{const food=foods.find(f=>f.id===offer.menuItemId);return <article key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-[#fffdf7] p-4"><div><div className="flex items-center gap-2"><span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-black text-amber-900">{offer.kind==='PERCENT'?`${offer.value/100}% OFF`:offer.kind==='AMOUNT'?`₹${offer.value/100} OFF`:`₹${offer.value/100}`}</span><h2 className="font-black">{offer.name}</h2><span className="text-xs text-gray-500">{offerStatus(offer)}</span></div><p className="mt-2 text-sm">{food?.name||'Unavailable menu item'}</p><p className="mt-1 text-xs text-gray-500">{new Date(offer.startsAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} – {new Date(offer.endsAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p></div><div className="flex gap-2"><button className={button} onClick={()=>setDraft(offerDraft(offer))}>Edit</button><button disabled={busy[offer.id]} className="rounded-xl border px-3 py-2 text-sm" onClick={()=>action(offer)}>{offer.active?'Pause':'Enable'}</button><button disabled={busy[offer.id]} className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700" onClick={()=>action(offer,true)}>Delete</button></div></article>;})}</div>
    {!offers.length&&<p className="rounded-2xl bg-[#fffdf7] p-6 text-gray-500">Create your first offer, or add one while editing a promotional banner.</p>}
  </div></main>;
}
