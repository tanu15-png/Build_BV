import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdminResource } from '../../hooks/useAdminResource';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { api } from '../../services/api';
const input = 'rounded-xl border border-gray-200 bg-white px-4 py-3';
const button = 'rounded-xl border px-3 py-2 font-bold text-[#075d50] disabled:opacity-50';
export function AdminCanteenCard({ canteen, saved }) {
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
export default function AdminMaintenance({ canteens, saved }) {
  const { user } = useAuth();
  const [searchDraft, setSearch] = useState('');
  const search = useDebouncedValue(searchDraft);
  const [role, setRole] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [canteenId, setCanteenId] = useState('');
  const [memberStatus, setMemberStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const users = useAdminResource('/admin/users?' + new URLSearchParams({ limit: '25', ...(search.trim() ? { search: search.trim() } : {}), ...(role ? { role } : {}), ...(accountStatus ? { status: accountStatus } : {}) }));
  const members = useAdminResource('/admin/memberships?' + new URLSearchParams({ limit: '25', ...(canteenId ? { canteenId } : {}), ...(memberStatus ? { status: memberStatus } : {}) }));
  const write = async (target, body, success) => {
    if (busy) return;
    setBusy(target); setError(''); setMessage('');
    try { await api(target, { method: 'PATCH', body }); setMessage(success); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(''); users.refresh(); members.refresh(); saved(); }
  };
  return <section id="access" className="scroll-mt-5 space-y-7">
    <h2 className="text-2xl font-black">Accounts and canteen access</h2>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-700">{message}</p>}
    <div className="rounded-2xl bg-white p-5"><h3 className="text-xl font-black">Accounts</h3>
      <div className="mt-4 flex flex-wrap gap-3"><input aria-label="Search accounts" type="search" maxLength={120} value={searchDraft} onChange={event => setSearch(event.target.value)} placeholder="Search name or email" className={input} />
        <select aria-label="Account role" value={role} onChange={event => setRole(event.target.value)} className={input}><option value="">All roles</option>{['STUDENT', 'CANTEEN', 'ADMIN'].map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Account status" value={accountStatus} onChange={event => setAccountStatus(event.target.value)} className={input}><option value="">All account states</option><option>ACTIVE</option><option>DISABLED</option></select>
      </div>
      {users.error && <p role="alert" className="mt-3 text-red-700">{users.error} <button onClick={users.refresh} className="underline">Retry</button></p>}
      {users.loading && <p role="status" className="mt-3 text-gray-500">Refreshing accounts…</p>}
      <ul className="mt-4 divide-y">{users.items.map(account => <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{account.name} · {account.email}</p><p className="mt-1 text-sm text-gray-500">{account.roles.join(', ')} · {account.status}</p></div>
        <button disabled={Boolean(busy) || account.id === user.id} className={button} onClick={() => {
          const disabled = account.status === 'DISABLED';
          if (disabled || window.confirm(`Disable ${account.email}? All their sessions and pending sign-ins will end. Their order history will be retained.`)) void write(`/admin/users/${account.id}`, { status: disabled ? 'ACTIVE' : 'DISABLED', expectedUpdatedAt: account.updatedAt }, disabled ? 'Account enabled. The user can sign in again.' : 'Account disabled and sessions ended.');
        }}>{account.id === user.id ? 'Current administrator' : account.status === 'DISABLED' ? 'Enable account' : 'Disable account'}</button></li>)}</ul>
      {!users.loading && !users.error && !users.items.length && <p className="mt-4 text-gray-500">No matching accounts.</p>}
      {users.loadMore && <button disabled={users.loading} onClick={users.loadMore} className={`${button} mt-4`}>Load more accounts</button>}
    </div>
    <div className="rounded-2xl bg-white p-5"><h3 className="text-xl font-black">Canteen memberships</h3>
      <div className="mt-4 flex flex-wrap gap-3"><select aria-label="Membership canteen" value={canteenId} onChange={event => setCanteenId(event.target.value)} className={input}><option value="">All canteens</option>{canteens.map(canteen => <option key={canteen.id} value={canteen.id}>{canteen.name}</option>)}</select>
        <select aria-label="Membership status" value={memberStatus} onChange={event => setMemberStatus(event.target.value)} className={input}><option value="">All membership states</option><option>ACTIVE</option><option>REVOKED</option></select>
      </div>
      {members.error && <p role="alert" className="mt-3 text-red-700">{members.error} <button onClick={members.refresh} className="underline">Retry</button></p>}
      {members.loading && <p role="status" className="mt-3 text-gray-500">Refreshing memberships…</p>}
      <ul className="mt-4 divide-y">{members.items.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{member.email} · {member.canteenName}</p><p className="mt-1 text-sm text-gray-500">{member.status}{member.accountStatus === 'DISABLED' ? ' · Account disabled' : member.requiresAccessCode ? ' · New join code required' : ''}</p></div>
        <div className="flex flex-wrap gap-2">{(member.status === 'REVOKED' || member.requiresAccessCode) && <button disabled={Boolean(busy) || member.accountStatus === 'DISABLED'} className={button} onClick={() => write(`/admin/memberships/${member.id}`, { status: 'ACTIVE', expectedVersion: member.version }, 'Canteen access restored. The member must sign in again.')}>Restore access</button>}
          {member.status === 'ACTIVE' && <button disabled={Boolean(busy)} className={`${button} text-red-700`} onClick={() => { if (window.confirm(`Remove ${member.email}'s access to ${member.canteenName}? Their sessions for this canteen will end.`)) void write(`/admin/memberships/${member.id}`, { status: 'REVOKED', expectedVersion: member.version }, 'Canteen access removed.'); }}>Remove access</button>}</div>
      </li>)}</ul>
      {!members.loading && !members.error && !members.items.length && <p className="mt-4 text-gray-500">No matching memberships.</p>}
      {members.loadMore && <button disabled={members.loading} onClick={members.loadMore} className={`${button} mt-4`}>Load more memberships</button>}
    </div>
  </section>;
}
