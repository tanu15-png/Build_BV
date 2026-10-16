import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { api } from '../../services/api';
import { rupeesToPaise } from '../../services/catalog';
const input = 'mt-2 w-full rounded-xl border border-gray-200 px-4 py-3';
const button = 'rounded-xl bg-[#075d50] px-4 py-2 font-bold text-white disabled:opacity-50';
export default function MenuManagement() {
  const { user } = useAuth();
  const { canteenId: adminCanteenId } = useParams();
  const canteenId = user.role === 'admin' ? adminCanteenId : user.canteenId;
  const { managementMenu: loadedMenu, queueMenuChange, seedManagementMenu, pendingMenuSaves, catalogRevision } = useOrders();
  const menu = loadedMenu?.canteen.id === canteenId ? loadedMenu : null;
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detailsStatus, setDetailsStatus] = useState('');
  const loadSequence = useRef(0);
  const seenCatalogRevision = useRef('');
  const [failedDraft, setFailedDraft] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [addingTo, setAddingTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    const request = ++loadSequence.current;
    const result = await api(`/canteens/${canteenId}/menu/manage`);
    if (request === loadSequence.current) seedManagementMenu(result);
  }, [canteenId, seedManagementMenu]);
  useEffect(() => {
    if (pendingMenuSaves || seenCatalogRevision.current === `${canteenId}:${catalogRevision}`) return;
    let active = true;
    const timer = setTimeout(() => {
      seenCatalogRevision.current = `${canteenId}:${catalogRevision}`;
      void load().catch(issue => { if (active) setError(issue.message); });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [load, canteenId, catalogRevision, pendingMenuSaves]);
  const perform = (path, method, body, message) => {
    loadSequence.current++;
    setError(''); setSuccess(''); setFailedDraft(null);
    try {
      const queued = queueMenuChange(path, method, body, menu);
      setEditing(null); setAddingTo(null);
      if (method === 'POST' && path.endsWith('/categories')) {
        setCategoryName(''); setAddingTo(queued.id);
        requestAnimationFrame(() => document.getElementById(`category-${queued.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      }
      void queued.completion.then(() => setSuccess(message)).catch(issue => {
        setError(`Unable to save: ${issue.message}`);
        if (body.pricePaise !== undefined) {
          setFailedDraft({ ...body, price: (body.pricePaise / 100).toFixed(2) });
          if (method === 'POST') setAddingTo(body.categoryId);
          else setEditing(path.split('/').at(-1));
        }
        void load().catch(() => {});
      });
      return queued;
    } catch (issue) { setError(issue.message); return false; }
  };
  const saveDetails = data => {
    setDetailsStatus('Saving canteen details…');
    const queued = perform(`/canteens/${canteenId}/settings`, 'PATCH', { expectedVersion: menu.canteen.version, ...data }, 'Canteen details saved.');
    if (!queued) { setDetailsStatus('Canteen details could not be saved. Please retry.'); return; }
    void queued.completion.then(() => setDetailsStatus('Canteen details saved.')).catch(issue => setDetailsStatus(`Canteen details could not be saved: ${issue.message}`));
  };
  const patchCategory = (category, data) => perform(`/menu-categories/${category.id}`, 'PATCH', { expectedVersion: category.version, ...data }, data.archived === true ? 'Category archived.' : 'Category saved.');
  const patchItem = (item, data) => perform(`/menu-items/${item.id}`, 'PATCH', { expectedVersion: item.version, ...data }, data.archived === true ? 'Item archived.' : 'Item saved.');
  const deleteEntry = (kind, entry) => {
    const message = kind === 'category'
      ? `Permanently delete category “${entry.name}” and all its items, including archived items? This cannot be undone.`
      : `Permanently delete item “${entry.name}”? This cannot be undone.`;
    if (!window.confirm(message)) return;
    perform(`/menu-${kind === 'category' ? 'categories' : 'items'}/${entry.id}`, 'DELETE', { expectedVersion: entry.version }, kind === 'category' ? 'Category and its items deleted.' : 'Item deleted.');
  };
  const activeCategories = menu?.categories.filter(c => !c.archived) || [];
  return <div className="min-h-screen bg-[#f6f8f7] p-5 lg:p-10"><main className="mx-auto max-w-5xl">
    <Link to={user.role === 'admin' ? '/admin' : '/canteen'} className="font-bold text-[#075d50]">← {user.role === 'admin' ? 'Admin dashboard' : 'Canteen dashboard'}</Link>
    <header className="my-7 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black">{menu?.canteen.name || 'Your canteen'} menu</h1><p className="mt-2 text-gray-600">Create categories, then add dishes inside them.</p></div><button onClick={() => { setError(''); load().catch(issue => setError(issue.message)); }} className="rounded-xl border px-4 py-2 font-bold">Refresh menu</button></header>
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {pendingMenuSaves > 0 && <p role="status" className="mb-5 text-sm text-gray-500">Saving {pendingMenuSaves === 1 ? 'change' : `${pendingMenuSaves} changes`} in the background. You can keep editing.</p>}
    {success && <p role="status" className="mb-5 rounded-xl bg-green-50 p-4 text-green-800">{success}</p>}
    {!menu ? <p role="status">Loading your menu…</p> : <>
      <section className="mb-6 rounded-2xl bg-white p-6"><h2 className="text-xl font-black">Canteen details</h2><SettingsEditor key={menu.canteen.version} canteen={menu.canteen} save={saveDetails} status={detailsStatus} />
        <p className="mt-4 text-sm text-gray-600">{menu.canteen.acceptingOrders ? 'Accepting new orders' : 'New orders paused'}. Existing orders can still be fulfilled.</p>
        <button onClick={() => perform(`/canteens/${canteenId}/availability`, 'PATCH', { expectedVersion: menu.canteen.version, acceptingOrders: !menu.canteen.acceptingOrders }, 'Availability saved.')} className={`${button} mt-3`}>{menu.canteen.acceptingOrders ? 'Pause incoming orders' : 'Resume incoming orders'}</button>
      </section>
      <form onSubmit={async event => { event.preventDefault(); if (await perform(`/canteens/${canteenId}/categories`, 'POST', { name: categoryName }, 'Category created. Add its first item below.')) setCategoryName(''); }} className="mb-8 rounded-2xl bg-white p-6"><fieldset className="flex flex-wrap items-end gap-4"><label className="min-w-0 flex-1 font-bold">New category<input required maxLength={80} placeholder="e.g. Chinese or Snacks" value={categoryName} onChange={event => setCategoryName(event.target.value)} className={input} /></label><button className={button}>Add category</button></fieldset></form>
      {!activeCategories.length && <p className="mb-6 text-gray-600">Your menu has no categories yet. Add one above to get started.</p>}
      <div className="space-y-6">{activeCategories.map(category => <section id={`category-${category.clientId || category.id}`} key={category.clientId || category.id} className="rounded-2xl bg-white p-6">
        <CategoryEditor key={`${category.clientId || category.id}:${category.version}`} category={category} itemCount={menu.items.filter(item => item.categoryId === category.id && !item.archived).length} save={data => patchCategory(category, data)} remove={() => deleteEntry('category', category)} />
        <div className="mt-4 divide-y">{menu.items.filter(item => item.categoryId === category.id && !item.archived).map(item => <article key={item.clientId || item.id} className="py-4">
          {(editing === item.id || editing === item.clientId) ? <ItemEditor key={`${item.clientId || item.id}:${item.version}`} item={item} initialDraft={failedDraft} categories={activeCategories} cancel={() => { setEditing(null); setFailedDraft(null); }} save={async data => { if (await patchItem(item, data)) setEditing(null); }} /> : <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-black">{item.name}</h3><p className="mt-1 text-sm text-gray-600">{item.description}</p><p className="mt-2 font-bold text-[#075d50]">₹{(item.pricePaise / 100).toFixed(2)} · {item.available ? 'Available' : 'Unavailable'}</p></div><div className="flex flex-wrap gap-3"><button onClick={() => { setEditing(item.id); setAddingTo(null); setFailedDraft(null); }} className="rounded-xl border px-3 py-2">Edit</button><button onClick={() => patchItem(item, { available: !item.available })} className="rounded-xl border px-3 py-2">{item.available ? 'Mark unavailable' : 'Make available'}</button><button onClick={() => patchItem(item, { archived: true })} className="rounded-xl border px-3 py-2 text-red-700">Archive item</button><DeleteButton label={`Delete item ${item.name}`} onClick={() => deleteEntry('item', item)} /></div></div>}
        </article>)}</div>
        {(addingTo === category.id || addingTo === category.clientId) ? <div className="mt-4 border-t pt-4"><h3 className="mb-4 font-black">Add an item to {category.name}</h3><ItemEditor categoryId={category.id} initialDraft={failedDraft} categories={activeCategories} cancel={() => { setAddingTo(null); setFailedDraft(null); }} save={async data => { if (await perform(`/canteens/${canteenId}/menu`, 'POST', data, 'Item added.')) setAddingTo(null); }} /></div> : <button onClick={() => { setAddingTo(category.id); setEditing(null); setFailedDraft(null); }} className={`${button} mt-4`}>Add item to {category.name}</button>}
      </section>)}</div>
      <details className="mt-8 rounded-2xl bg-white p-6"><summary className="cursor-pointer font-black">Archived categories and items</summary><p className="mt-3 text-sm text-gray-600">Archived entries can be restored. The bin permanently deletes an entry. Restore a category before restoring its items.</p>
        {menu.categories.filter(c => c.archived).map(category => <div key={category.id} className="mt-4 flex justify-between gap-3"><span>{category.name}</span><div className="flex items-center gap-3"><button onClick={() => patchCategory(category, { archived: false })} className="font-bold text-[#075d50]">Restore category</button><DeleteButton label={`Delete category ${category.name}`} onClick={() => deleteEntry('category', category)} /></div></div>)}
        {menu.items.filter(item => item.archived).map(item => <div key={item.id} className="mt-4 flex justify-between gap-3"><span>{item.name} · {item.category}</span><div className="flex items-center gap-3"><button disabled={!activeCategories.some(c => c.id === item.categoryId)} onClick={() => patchItem(item, { archived: false })} className="font-bold text-[#075d50] disabled:opacity-40">Restore item</button><DeleteButton label={`Delete item ${item.name}`} onClick={() => deleteEntry('item', item)} /></div></div>)}
      </details>
    </>}
  </main></div>;
}
function DeleteButton({ label, onClick }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className="rounded-xl border border-red-200 p-2.5 text-red-700 hover:bg-red-50"><Trash2 size={18} /></button>;
}
function CategoryEditor({ category, itemCount, save, remove }) {
  const [name, setName] = useState(category.name);
  return <form onSubmit={event => { event.preventDefault(); void save({ name }); }}><fieldset className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 font-black">Category name<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} className={input} /></label><button className="rounded-xl border px-4 py-2 font-bold">Rename</button><button type="button" disabled={itemCount > 0} onClick={() => save({ archived: true })} className="rounded-xl border px-4 py-2 text-red-700 disabled:opacity-50">Archive category</button><DeleteButton label={`Delete category ${category.name}`} onClick={remove} /></fieldset>{itemCount > 0 && <p className="mt-3 text-sm text-gray-600">Archive or move this category’s {itemCount === 1 ? 'item' : 'items'} before archiving the category.</p>}</form>;
}
function SettingsEditor({ canteen, save, status }) {
  const [hours, setHours] = useState(canteen.hours || '');
  const saving = status === 'Saving canteen details…';
  return <form onSubmit={event => { event.preventDefault(); save({ hours: hours.trim() || null }); }}>
    <fieldset disabled={saving} className="mt-4 grid gap-4">
      <label className="font-bold">Opening hours<input maxLength={240} placeholder="e.g. Mon–Sat, 9 AM–8 PM" value={hours} onChange={event => setHours(event.target.value)} className={input} /></label>
      <button className={button}>{saving ? 'Saving…' : 'Save canteen details'}</button>
    </fieldset>
    {status && <p role="status" className={`mt-3 rounded-xl p-3 text-sm font-bold ${status.includes('could not') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{status}</p>}
  </form>;
}
function ItemEditor({ item, categoryId, initialDraft, categories, save, cancel }) {
  const [draft, setDraft] = useState({ name: initialDraft?.name || item?.name || '', description: initialDraft ? initialDraft.description || '' : item?.description || '', categoryId: initialDraft?.categoryId || item?.categoryId || categoryId, price: initialDraft?.price ?? (item ? (item.pricePaise / 100).toFixed(2) : ''), imageRef: initialDraft ? initialDraft.imageRef || '' : item?.imageRef || '' });
  const [error, setError] = useState('');
  const change = event => setDraft(current => ({ ...current, [event.target.name]: event.target.value }));
  return <form onSubmit={async event => { event.preventDefault(); setError(''); try { await save({ name: draft.name, description: draft.description.trim() || null, categoryId: draft.categoryId, pricePaise: rupeesToPaise(draft.price), imageRef: draft.imageRef.trim() || null }); } catch (issue) { setError(issue.message); } }}><fieldset className="grid gap-4 sm:grid-cols-2">
    <label className="font-bold">Item name<input name="name" required maxLength={120} value={draft.name} onChange={change} className={input} /></label>
    <label className="font-bold">Category<select name="categoryId" required value={categories.find(category => category.id === draft.categoryId || category.clientId === draft.categoryId)?.id || draft.categoryId} onChange={change} className={input}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <label className="font-bold">Price (₹)<input name="price" required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={draft.price} onChange={change} className={input} /></label>
    <label className="font-bold">Image URL (optional)<input name="imageRef" type="url" maxLength={2000} placeholder="https://…" value={draft.imageRef} onChange={change} className={input} /></label>
    <label className="font-bold sm:col-span-2">Description<textarea name="description" maxLength={2000} value={draft.description} onChange={change} className={input} /></label>
    <div className="flex gap-3 sm:col-span-2"><button className={button}>{item ? 'Save changes' : 'Add item'}</button><button type="button" onClick={cancel} className="rounded-xl border px-4 py-2">Cancel</button></div>
  </fieldset>{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}</form>;
}
