import { useCallback, useEffect, useRef, useState } from 'react';
import { api, peekApiCache, subscribeApiReads } from '../services/api';

export function useBanners(staff = false) {
  const path=staff?'/banners/manage':'/banners';
  const [data,setData]=useState(()=>peekApiCache(path)||null),[error,setError]=useState('');
  const sequence=useRef(0);
  const load=useCallback(async(fresh=false)=>{
    const request=++sequence.current;
    try {const result=await api(path,{fresh});if(request===sequence.current){setData(result);setError('');}}
    catch(issue){if(request===sequence.current)setError(issue.message);}
  },[path]);
  const cancelPending=useCallback(()=>{sequence.current++;},[]);
  useEffect(()=>{
    const initial=setTimeout(()=>{void load();},0);const refresh=()=>{void load();};const wake=()=>{void load(true);};
    const timer=setInterval(refresh,15000),unsubscribe=subscribeApiReads(refresh);
    window.addEventListener('focus',wake);
    return()=>{cancelPending();clearTimeout(initial);clearInterval(timer);unsubscribe();window.removeEventListener('focus',wake);};
  },[load,cancelPending]);
  useEffect(()=>{
    if(!data?.cacheUntil)return;
    const timer=setTimeout(()=>{void load(true);},Math.min(2147483647,Math.max(50,Date.parse(data.cacheUntil)-Date.now()+25)));
    return()=>clearTimeout(timer);
  },[data,load]);
  return {banners:data?.items||[],loading:!data&&!error,error,load};
}
