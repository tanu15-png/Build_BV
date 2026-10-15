import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { api } from '../../services/api';
import { rupeesToPaise } from '../../services/catalog';
const input = 'mt-2 w-full rounded-xl border border-gray-200 px-4 py-3';
const button = 'rounded-xl bg-[#075d50] px-4 py-2 font-bold text-white disabled:opacity-50';
export default function MenuManagement() {
  const { user } = useAuth();
  const { refreshCatalog } = useOrders();
  const canteenId = user.canteenId;
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [addingTo, setAddingTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    const result = await api(`/canteens/${canteenId}/menu/manage`);
    setMenu(result);
  }, [canteenId]);
  useEffect(() => { let active = true; const timer = setTimeout(() => { load().catch(issue => { if (active) setError(issue.message); }); }, 0); return () => { active = false; clearTimeout(timer); }; }, [load]);
  const perform = async (path, method, body, message) => {
    if (busy) return false;
    setBusy(true); setError(''); setSuccess('');
    try {
      await api(path, { method, body }); await load(); await refreshCatalog();
      setSuccess(message); return true;
    } catch (issue) { setError(issue.message); if (issue.status === 409) await load().catch(() => {}); return false; }
    finally { setBusy(false); }
  };
  const patchCategory = (category, data) => perform(`/menu-categories/${category.id}`, 'PATCH', { expectedVersion: category.version, ...data }, 'Category saved.');
  const patchItem = (item, data) => perform(`/menu-items/${item.id}`, 'PATCH', { expectedVersion: item.version, ...data }, 'Item saved.');
  const activeCategories = menu?.categories.filter(c => !c.archived) || [];
  return <div className="min-h-screen bg-[#f6f8f7] p-5 lg:p-10"><main className="mx-auto max-w-5xl">
    <Link to="/canteen" className="font-bold text-[#075d50]">← Canteen dashboard</Link>
    <header className="my-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black">{menu?.canteen.name || 'Your canteen'} menu</h1><p className="mt-2 text-gray-600">Create categories, then add dishes inside them.</p></div><button disabled={busy} onClick={() => { setError(''); load().catch(issue => setError(issue.message)); }} className="rounded-xl border px-4 py-2 font-bold">Refresh menu</button></header>
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {success && <p role="status" className="mb-5 rounded-xl bg-green-50 p-4 text-green-800">{success}</p>}
    {!menu ? <p role="status">Loading your menu…</p> : <>
      <section className="mb-6 rounded-2xl bg-white p-6"><h2 className="text-xl font-black">Canteen details</h2><SettingsEditor key={menu.canteen.version} canteen={menu.canteen} busy={busy} save={data => perform(`/canteens/${canteenId}/settings`, 'PATCH', { expectedVersion: menu.canteen.version, ...data }, 'Canteen details saved.')} />
        <p className="mt-4 text-sm text-gray-600">{menu.canteen.acceptingOrders ? 'Accepting new orders' : 'New orders paused'}. Existing orders can still be fulfilled.</p>
        <button disabled={busy} onClick={() => perform(`/canteens/${canteenId}/availability`, 'PATCH', { expectedVersion: menu.canteen.version, acceptingOrders: !menu.canteen.acceptingOrders }, 'Availability saved.')} className={`${button} mt-3`}>{menu.canteen.acceptingOrders ? 'Pause incoming orders' : 'Resume incoming orders'}</button>
      </section>
      <form onSubmit={async event => { event.preventDefault(); if (await perform(`/canteens/${canteenId}/categories`, 'POST', { name: categoryName }, 'Category created. Add its first item below.')) setCategoryName(''); }} className="mb-8 rounded-2xl bg-white p-6"><fieldset disabled={busy} className="flex flex-wrap items-end gap-4"><label className="min-w-0 flex-1 font-bold">New category<input required maxLength={80} placeholder="e.g. Chinese or Snacks" value={categoryName} onChange={event => setCategoryName(event.target.value)} className={input} /></label><button className={button}>Add category</button></fieldset></form>
      {!activeCategories.length && <p className="mb-6 text-gray-600">Your menu has no categories yet. Add one above to get started.</p>}
      <div className="space-y-6">{activeCategories.map(category => <section key={category.id} className="rounded-2xl bg-white p-6">
        <CategoryEditor key={`${category.id}:${category.version}`} category={category} busy={busy} save={data => patchCategory(category, data)} />
        <div className="mt-4 divide-y">{menu.items.filter(item => item.categoryId === category.id && !item.archived).map(item => <article key={item.id} className="py-4">
          {editing === item.id ? <ItemEditor key={`${item.id}:${item.version}`} item={item} categories={activeCategories} busy={busy} cancel={() => setEditing(null)} save={async data => { if (await patchItem(item, data)) setEditing(null); }} /> : <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-black">{item.name}</h3><p className="mt-1 text-sm text-gray-600">{item.description}</p><p className="mt-2 font-bold text-[#075d50]">₹{(item.pricePaise / 100).toFixed(2)} · {item.available ? 'Available' : 'Unavailable'}</p></div><div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => { setEditing(item.id); setAddingTo(null); }} className="rounded-xl border px-3 py-2">Edit</button><button disabled={busy} onClick={() => patchItem(item, { available: !item.available })} className="rounded-xl border px-3 py-2">{item.available ? 'Mark unavailable' : 'Make available'}</button><button disabled={busy} onClick={() => patchItem(item, { archived: true })} className="rounded-xl border px-3 py-2 text-red-700">Archive item</button></div></div>}
        </article>)}</div>
        {addingTo === category.id ? <div className="mt-4 border-t pt-4"><h3 className="mb-4 font-black">Add an item to {category.name}</h3><ItemEditor categoryId={category.id} categories={activeCategories} busy={busy} cancel={() => setAddingTo(null)} save={async data => { if (await perform(`/canteens/${canteenId}/menu`, 'POST', data, 'Item added.')) setAddingTo(null); }} /></div> : <button disabled={busy} onClick={() => { setAddingTo(category.id); setEditing(null); }} className={`${button} mt-4`}>Add item to {category.name}</button>}
      </section>)}</div>
      <details className="mt-8 rounded-2xl bg-white p-6"><summary className="cursor-pointer font-black">Archived categories and items</summary><p className="mt-3 text-sm text-gray-600">Archive all items or move them before archiving a category. Restore a category before restoring its items.</p>
        {menu.categories.filter(c => c.archived).map(category => <div key={category.id} className="mt-4 flex justify-between gap-3"><span>{category.name}</span><button disabled={busy} onClick={() => patchCategory(category, { archived: false })} className="font-bold text-[#075d50]">Restore category</button></div>)}
        {menu.items.filter(item => item.archived).map(item => <div key={item.id} className="mt-4 flex justify-between gap-3"><span>{item.name} · {item.category}</span><button disabled={busy || !activeCategories.some(c => c.id === item.categoryId)} onClick={() => patchItem(item, { archived: false })} className="font-bold text-[#075d50] disabled:opacity-40">Restore item</button></div>)}
      </details>
    </>}
  </main></div>;
}
function CategoryEditor({ category, busy, save }) {
  const [name, setName] = useState(category.name);
  return <form onSubmit={event => { event.preventDefault(); void save({ name }); }}><fieldset disabled={busy} className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 font-black">Category name<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} className={input} /></label><button className="rounded-xl border px-4 py-2 font-bold">Rename</button><button type="button" onClick={() => save({ archived: true })} className="rounded-xl border px-4 py-2 text-red-700">Archive category</button></fieldset></form>;
}
function SettingsEditor({ canteen, busy, save }) {
  const [location, setLocation] = useState(canteen.location || '');
  const [hours, setHours] = useState(canteen.hours || '');
  return <form onSubmit={event => { event.preventDefault(); void save({ location: location.trim() || null, hours: hours.trim() || null }); }}><fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="font-bold">Pickup location<input maxLength={240} value={location} onChange={event => setLocation(event.target.value)} className={input} /></label><label className="font-bold">Opening hours<input maxLength={240} placeholder="e.g. Mon–Sat, 9 AM–8 PM" value={hours} onChange={event => setHours(event.target.value)} className={input} /></label><button className={`${button} sm:col-span-2`}>Save canteen details</button></fieldset></form>;
}
function ItemEditor({ item, categoryId, categories, busy, save, cancel }) {
  const [draft, setDraft] = useState({ name: item?.name || '', description: item?.description || '', categoryId: item?.categoryId || categoryId, price: item ? (item.pricePaise / 100).toFixed(2) : '', imageRef: item?.imageRef || '' });
  const [error, setError] = useState('');
  const change = event => setDraft(current => ({ ...current, [event.target.name]: event.target.value }));
  return <form onSubmit={async event => { event.preventDefault(); setError(''); try { await save({ name: draft.name, description: draft.description.trim() || null, categoryId: draft.categoryId, pricePaise: rupeesToPaise(draft.price), imageRef: draft.imageRef.trim() || null }); } catch (issue) { setError(issue.message); } }}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
    <label className="font-bold">Item name<input name="name" required maxLength={120} value={draft.name} onChange={change} className={input} /></label>
    <label className="font-bold">Category<select name="categoryId" required value={draft.categoryId} onChange={change} className={input}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <label className="font-bold">Price (₹)<input name="price" required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={draft.price} onChange={change} className={input} /></label>
    <label className="font-bold">Image URL (optional)<input name="imageRef" type="url" maxLength={2000} placeholder="https://…" value={draft.imageRef} onChange={change} className={input} /></label>
    <label className="font-bold sm:col-span-2">Description<textarea name="description" maxLength={2000} value={draft.description} onChange={change} className={input} /></label>
    <div className="flex gap-3 sm:col-span-2"><button className={button}>{item ? 'Save changes' : 'Add item'}</button><button type="button" onClick={cancel} className="rounded-xl border px-4 py-2">Cancel</button></div>
  </fieldset>{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}</form>;
}
