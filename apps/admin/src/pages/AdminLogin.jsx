import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '@spoonate/portal/context/AuthContext';

export default function AdminLogin() {
  const { user, loading, login } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!loading && user?.role === 'admin') return <Navigate to="/admin" replace />;
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await login({ password }); setPassword(''); }
    catch (issue) { setError(issue.message || 'Unable to enter the dashboard. Please retry.'); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#075d50] px-5 py-10">
    <section className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl lg:p-10">
      <p className="text-2xl font-black text-[#075d50]">Spoon<span className="text-[#a88a00]">Ate</span></p>
      <p className="mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#075d50]"><LockKeyhole size={18} /> Team access</p>
      <h1 className="mt-3 text-3xl font-black">Admin dashboard</h1>
      <p className="mt-3 text-gray-600">Enter the team password to continue.</p>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <fieldset disabled={busy || loading} className="space-y-5">
          <label className="block text-sm font-bold">Password<input type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#0f8f73]" /></label>
          <button className="w-full rounded-xl bg-[#0f8f73] py-3 font-black text-white disabled:opacity-60">{busy ? 'Opening…' : loading ? 'Checking access…' : 'Enter dashboard'}</button>
        </fieldset>
      </form>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </section>
  </main>;
}
