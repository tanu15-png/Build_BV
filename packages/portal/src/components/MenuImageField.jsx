import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { menuImageSrc, prepareMenuImage } from '../services/menuImages';

export default function MenuImageField({ value, onChange, onBusy }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lifetime = useRef(0), request = useRef(null);
  useEffect(() => () => { lifetime.current++; request.current?.abort(); }, []);
  async function upload(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy) return;
    const version = lifetime.current;
    setBusy(true); onBusy(true); setError('');
    try {
      const body = await prepareMenuImage(file);
      if (version !== lifetime.current) return;
      request.current = new AbortController();
      const result = await api('/banners/images', { method: 'POST', body, signal: request.current.signal });
      if (version === lifetime.current) onChange(result.imageRef);
    } catch (issue) { if (version === lifetime.current) setError(issue.message); }
    finally { if (version === lifetime.current) { setBusy(false); onBusy(false); } }
  }
  return <div className="sm:col-span-2">
    <label className="block font-bold">Item image (optional)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={upload} className="mt-2 block w-full rounded-xl border border-gray-200 bg-[#fffdf7] p-3 text-sm disabled:opacity-50" /></label>
    <p className="mt-2 text-xs text-gray-500">JPEG, PNG or WebP · Up to 8 MB. Large photos are resized before uploading.</p>
    {busy && <p role="status" className="mt-2 text-sm text-[#185c3a]">Uploading image…</p>}
    {value && <div className="mt-3 flex items-center gap-4"><img src={menuImageSrc(value)} alt="Item preview" className="h-24 w-32 rounded-xl border object-cover" /><button type="button" disabled={busy} onClick={() => { onChange(''); setError(''); }} className="text-sm font-bold text-red-700 disabled:opacity-50">Remove image</button></div>}
    <details className="mt-3 text-sm"><summary className="cursor-pointer text-[#185c3a]">Use an image URL instead</summary><input aria-label="Image URL (optional)" type="url" maxLength={2000} placeholder="https://…" disabled={busy} value={value.startsWith('/') ? '' : value} onChange={event => { onChange(event.target.value); setError(''); }} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3" /></details>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
