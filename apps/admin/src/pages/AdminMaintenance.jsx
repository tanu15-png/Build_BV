import { roleLabel } from '@spoonate/portal/portal.js';
import { useState } from 'react';
import { useAdminResource } from '@spoonate/portal/hooks/useAdminResource';
import { api } from '@spoonate/portal/services/api';
import { useAuth } from '@spoonate/portal/context/AuthContext';
import { useDebouncedValue } from '@spoonate/portal/hooks/useDebouncedValue';
const input = 'rounded-xl border border-gray-200 bg-white px-4 py-3';
const button = 'rounded-xl border px-3 py-2 font-bold text-[#075d50] disabled:opacity-50';
export default function AdminMaintenance() {
  const { user } = useAuth();
  const [searchDraft, setSearch] = useState('');
  const search = useDebouncedValue(searchDraft);
  const [role, setRole] = useState('STUDENT');
  const [accountStatus, setAccountStatus] = useState('');
  const users = useAdminResource('/admin/users?' + new URLSearchParams({ limit: '25', role, ...(search.trim() ? { search: search.trim() } : {}), ...(accountStatus ? { status: accountStatus } : {}) }));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const write = async (target, body, success) => {
    if (busy) return;
    setBusy(target); setError(''); setMessage('');
    try { await api(target, { method: 'PATCH', body }); setMessage(success); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(''); users.refresh(); }
  };
  return <section className="space-y-5">
    <h1 className="text-3xl font-black">Accounts and canteen access</h1>
    <p className="text-gray-500">Choose User, Canteen or Admin to manage account status.</p>
    <nav aria-label="Account type" className="flex flex-wrap gap-2">
      {['STUDENT', 'CANTEEN', 'ADMIN'].map(value => <button key={value} type="button" aria-pressed={role === value} disabled={Boolean(busy)} onClick={() => {
        setRole(value); setError(''); setMessage('');
      }} className={`rounded-xl border px-5 py-3 font-bold disabled:opacity-50 ${role === value ? 'border-[#075d50] bg-[#075d50] text-white' : 'border-gray-200 bg-white text-gray-600'}`}>{roleLabel(value)}</button>)}
    </nav>
    <button disabled={users.loading} className={button} onClick={users.refresh}>Refresh accounts</button>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-700">{message}</p>}
    <div className="rounded-2xl bg-white p-5"><h2 className="text-xl font-black">{roleLabel(role)} accounts</h2>
      <div className="mt-4 flex flex-wrap gap-3"><input aria-label="Search accounts" type="search" maxLength={120} value={searchDraft} onChange={event => setSearch(event.target.value)} placeholder="Search name or email" className={input} />
        <select aria-label="Account status" value={accountStatus} onChange={event => setAccountStatus(event.target.value)} className={input}><option value="">All account states</option><option>ACTIVE</option><option>DISABLED</option></select>
      </div>
      {users.error && <p role="alert" className="mt-3 text-red-700">{users.error} <button onClick={users.refresh} className="underline">Retry</button></p>}
      {users.initialLoading && <p role="status" className="mt-3 text-gray-500">Loading accounts…</p>}
      <ul className="mt-4 divide-y">{users.items.map(account => <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{account.name}{!account.email.endsWith('@canteen.spoonate.invalid') && ` · ${account.email}`}</p><p className="mt-1 text-sm text-gray-500">{account.roles.map(roleLabel).join(', ')} · {account.status}</p></div>
        <button disabled={Boolean(busy) || account.id === user.id} className={button} onClick={() => {
          const disabled = account.status === 'DISABLED';
          if (disabled || window.confirm(`Disable ${account.name}? All their sessions and pending sign-ins will end. Their order history will be retained.`)) void write(`/admin/users/${account.id}`, { status: disabled ? 'ACTIVE' : 'DISABLED', expectedUpdatedAt: account.updatedAt }, disabled ? 'Account enabled. The user can sign in again.' : 'Account disabled and sessions ended.');
        }}>{account.id === user.id ? 'Current administrator' : account.status === 'DISABLED' ? 'Enable account' : 'Disable account'}</button></li>)}</ul>
      {users.initialized && !users.error && !users.items.length && <p className="mt-4 text-gray-500">No matching {roleLabel(role).toLowerCase()} accounts.</p>}
      {users.loadMore && <button disabled={users.loading} onClick={users.loadMore} className={`${button} mt-4`}>Load more accounts</button>}
    </div>
  </section>;
}
