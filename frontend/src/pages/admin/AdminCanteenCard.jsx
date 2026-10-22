import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
const input = 'rounded-xl border border-gray-200 bg-white px-4 py-3';
const button = 'rounded-xl border px-3 py-2 font-bold text-[#075d50] disabled:opacity-50';
export default function AdminCanteenCard({ canteen, saved }) {
  const [editing, setEditing] = useState(null);
  const [rotation, setRotation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const perform = async (path, method, body, success) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await api(path, { method, body }); setMessage(success); setEditing(null); setRotation(null); saved(); }
    catch (issue) { setError(issue.message); saved(); }
    finally { setBusy(false); }
  };
  const patch = data => perform(`/admin/canteens/${canteen.id}`, 'PATCH', { expectedVersion: canteen.version, ...data }, 'Canteen saved.');
  return <article className="rounded-2xl bg-white p-5 shadow-sm">
    <div className="flex flex-wrap justify-between gap-3"><h3 className="text-lg font-black">{canteen.name}</h3><span className="text-sm font-bold text-[#075d50]">{!canteen.operational ? 'Disabled' : canteen.acceptingOrders ? 'Open' : 'Paused'}</span></div>
    <p className="mt-3 text-sm text-gray-600">{canteen.menuItemCount} menu items · {canteen.totalOrders} orders · {canteen.activeOrders} active · {canteen.collectedOrders} collected</p>
    <p className="mt-2 text-sm text-gray-500">{canteen.hours || 'Opening hours not provided'}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <Link to={`/admin/canteens/${canteen.id}/menu`} className={button}>Manage menu</Link>
      <button disabled={busy} className={button} onClick={() => setEditing({ name: canteen.name, hours: canteen.hours || '', expectedVersion: canteen.version })}>Edit details</button>
      <button disabled={busy || !canteen.operational} className={button} onClick={() => patch({ acceptingOrders: !canteen.acceptingOrders })}>{canteen.acceptingOrders ? 'Pause orders' : 'Resume orders'}</button>
      <button disabled={busy} className={`${button} text-red-700`} onClick={() => {
        if (!canteen.operational || window.confirm(`Disable ${canteen.name} for new orders and sign-ins? Existing staff can still fulfill current orders.`)) void patch({ operational: !canteen.operational });
      }}>{canteen.operational ? 'Disable canteen' : 'Enable canteen'}</button>
      <button disabled={busy} className={button} onClick={() => setRotation({ secret: '', expectedCodeVersion: canteen.activeCodeVersion ?? 0 })}>Rotate join code</button>
    </div>
    {editing && <form className="mt-4 grid gap-3" onSubmit={event => { event.preventDefault(); void perform(`/admin/canteens/${canteen.id}`, 'PATCH', { ...editing, hours: editing.hours.trim() || null }, 'Canteen details saved.'); }}>
      <label className="font-bold">Name<input required maxLength={120} className={`${input} mt-2 w-full`} value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
      <label className="font-bold">Opening hours<input maxLength={240} className={`${input} mt-2 w-full`} value={editing.hours} onChange={event => setEditing({ ...editing, hours: event.target.value })} /></label>
      <div className="flex gap-3"><button disabled={busy} className={button}>Save details</button><button type="button" className={button} onClick={() => setEditing(null)}>Cancel</button></div>
    </form>}
    {rotation && <form className="mt-4 grid gap-3" onSubmit={event => {
      event.preventDefault();
      if (window.confirm(`Replace the join code for ${canteen.name}? Current staff sessions and pending sign-ins will end. Members must join again with the new code.`)) void perform(`/admin/canteens/${canteen.id}/access-code`, 'POST', { accessCode: rotation.secret, expectedCodeVersion: rotation.expectedCodeVersion }, 'Join code rotated. Share the new code with authorized members.');
    }}>
      <p className="text-sm text-gray-600">Current join code version: {canteen.activeCodeVersion ?? 'Not set'}. Enter a new code of 12–256 characters. Existing codes cannot be retrieved.</p>
      <label className="font-bold">New join code<input required type="password" autoComplete="new-password" minLength={12} maxLength={256} className={`${input} mt-2 w-full`} value={rotation.secret} onChange={event => setRotation({ ...rotation, secret: event.target.value })} /></label>
      <div className="flex gap-3"><button disabled={busy} className={button}>Replace join code</button><button type="button" className={button} onClick={() => setRotation(null)}>Cancel</button></div>
    </form>}
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-green-700">{message}</p>}
  </article>;
}
