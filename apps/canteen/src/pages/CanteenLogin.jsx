import { BrandMark, BrandSplash } from '@spoonate/portal/components/Brand';
import { unlockOrderSound } from '@spoonate/portal/services/orderSound';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useAuth } from '@spoonate/portal/context/AuthContext';

export default function CanteenLogin() {
  const { user, loading, login, authError } = useAuth();
  const [name, setName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!loading && !authError && user?.role === 'canteen') return <Navigate to="/canteen" replace />;
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    unlockOrderSound();
    setBusy(true); setError('');
    try { await login({ name, accessCode }); setAccessCode(''); }
    catch (issue) { setError(issue.message || 'Unable to enter the dashboard. Please retry.'); }
    finally { setBusy(false); }
  }
  const input = 'mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#287647]';
  if (loading) return <BrandSplash />;
  return <main className="flex min-h-screen items-center justify-center bg-[#185c3a] px-5 py-10">
    <section className="w-full max-w-md rounded-[28px] bg-[#fffdf7] p-8 shadow-2xl lg:p-10">
      <BrandMark />
      <p className="mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#185c3a]"><Store size={18} /> Member access</p>
      <h1 className="mt-3 text-3xl font-black">Canteen dashboard</h1>
      <p className="mt-3 text-gray-600">Enter your name and the Canteen password.</p>
      <form onSubmit={submit} className="mt-6">
        <fieldset disabled={busy || loading} className="space-y-5">
          <label className="block text-sm font-bold">Your name<input autoComplete="name" required maxLength={120} value={name} onChange={event => setName(event.target.value)} className={input} /></label>
          <label className="block text-sm font-bold">Canteen password<input type="password" autoComplete="current-password" required minLength={4} maxLength={256} value={accessCode} onChange={event => setAccessCode(event.target.value)} className={input} /></label>
          <button className="w-full rounded-xl bg-[#287647] py-3 font-black text-white disabled:opacity-60">{busy ? 'Opening…' : loading ? 'Checking access…' : 'Enter dashboard'}</button>
        </fieldset>
      </form>
      {(error || authError) && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error || authError}</p>}
    </section>
  </main>;
}
