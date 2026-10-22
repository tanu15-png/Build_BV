import { useState } from 'react';
import { useAdminResource } from '../../hooks/useAdminResource';
import { api } from '../../services/api';
const input = 'rounded-xl border border-gray-200 bg-white px-4 py-3';
const button = 'rounded-xl border px-3 py-2 font-bold text-[#075d50] disabled:opacity-50';
export default function AdminMemberships() {
  const directory = useAdminResource('/canteens', false, { poll: false });
  const canteens = directory.items;
  const [canteenId, setCanteenId] = useState('');
  const [memberStatus, setMemberStatus] = useState('');
  const members = useAdminResource('/admin/memberships?' + new URLSearchParams({ limit: '25', ...(canteenId ? { canteenId } : {}), ...(memberStatus ? { status: memberStatus } : {}) }), false, { poll: false });
  const refresh = () => { members.refresh(); directory.refresh(); };
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const write = async (target, body, success) => {
    if (busy) return;
    setBusy(target); setError(''); setMessage('');
    try { await api(target, { method: 'PATCH', body }); setMessage(success); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(''); refresh(); }
  };
  return <section className="space-y-5">
    <h1 className="text-3xl font-black">Canteen memberships</h1>
    <p className="text-gray-500">Restore or remove access to individual canteens.</p>
    <button disabled={members.loading || directory.loading} className={button} onClick={refresh}>Refresh memberships</button>
    {directory.error && <p role="alert" className="text-red-700">{directory.error} <button onClick={directory.refresh} className="underline">Retry canteen list</button></p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-700">{message}</p>}
    <div className="rounded-2xl bg-white p-5">
      <div className="mt-4 flex flex-wrap gap-3"><select aria-label="Membership canteen" value={canteenId} onChange={event => setCanteenId(event.target.value)} className={input}><option value="">All canteens</option>{canteens.map(canteen => <option key={canteen.id} value={canteen.id}>{canteen.name}</option>)}</select>
        <select aria-label="Membership status" value={memberStatus} onChange={event => setMemberStatus(event.target.value)} className={input}><option value="">All membership states</option><option>ACTIVE</option><option>REVOKED</option></select>
      </div>
      {members.error && <p role="alert" className="mt-3 text-red-700">{members.error} <button onClick={members.refresh} className="underline">Retry</button></p>}
      {members.initialLoading && <p role="status" className="mt-3 text-gray-500">Loading memberships…</p>}
      <ul className="mt-4 divide-y">{members.items.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{member.email} · {member.canteenName}</p><p className="mt-1 text-sm text-gray-500">{member.status}{member.accountStatus === 'DISABLED' ? ' · Account disabled' : member.requiresAccessCode ? ' · New join code required' : ''}</p></div>
        <div className="flex flex-wrap gap-2">{(member.status === 'REVOKED' || member.requiresAccessCode) && <button disabled={Boolean(busy) || member.accountStatus === 'DISABLED'} className={button} onClick={() => write(`/admin/memberships/${member.id}`, { status: 'ACTIVE', expectedVersion: member.version }, 'Canteen access restored. The member must sign in again.')}>Restore access</button>}
          {member.status === 'ACTIVE' && <button disabled={Boolean(busy)} className={`${button} text-red-700`} onClick={() => { if (window.confirm(`Remove ${member.email}'s access to ${member.canteenName}? Their sessions for this canteen will end.`)) void write(`/admin/memberships/${member.id}`, { status: 'REVOKED', expectedVersion: member.version }, 'Canteen access removed.'); }}>Remove access</button>}</div>
      </li>)}</ul>
      {members.initialized && !members.error && !members.items.length && <p className="mt-4 text-gray-500">No matching memberships.</p>}
      {members.loadMore && <button disabled={members.loading} onClick={members.loadMore} className={`${button} mt-4`}>Load more memberships</button>}
    </div>
  </section>;
}
