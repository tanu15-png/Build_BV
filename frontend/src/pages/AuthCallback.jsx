import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const { completeCallback, changePassword } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const flow = params.get('flow');
  const work = useRef(null);
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!work.current) work.current = completeCallback(flow);
    void work.current.then(result => {
      if (!active) return;
      if (result.recovery) setRecovery(true);
      else if (result.verified) navigate('/login', { replace: true, state: { role: result.role, message: 'Email verified. Please log in with your password.' } });
      else navigate(`/${result.role}`, { replace: true });
    }).catch(issue => { if (active) setError(issue.message); });
    return () => { active = false; };
  }, [completeCallback, flow, navigate]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (password !== confirmation) throw new Error('Passwords do not match.');
      await changePassword(password);
      navigate('/login', { replace: true, state: { message: 'Password changed and previous SpoonAte sessions ended. Please log in.' } });
    } catch (issue) { setError(issue.message); } finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#075d50] p-6"><section className="w-full max-w-md rounded-2xl bg-white p-8">
    <h1 className="text-2xl font-black">{recovery ? 'Choose a new password' : flow === 'signup' ? 'Enter your signup OTP' : 'Verifying your email'}</h1>
    {recovery && <form onSubmit={submit} className="mt-6 space-y-4"><fieldset disabled={busy} className="space-y-4">
      <label className="block">New password<input type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label>
      <label className="block">Confirm password<input type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label>
      <button className="w-full rounded-xl bg-[#0f8f73] p-3 font-bold text-white">{busy ? 'Saving…' : 'Save new password'}</button>
    </fieldset></form>}
    {error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : !recovery && <p role="status" className="mt-4">Please wait…</p>}
    <Link to="/login" className="mt-6 inline-block font-bold text-[#075d50]">{flow === 'signup' ? 'Back to OTP verification' : 'Back to login'}</Link>
  </section></main>;
}
