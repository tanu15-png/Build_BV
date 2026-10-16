import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cafes } from '../data/mockData';

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState(location.state?.role || 'student');
  const [register, setRegister] = useState(false);
  const [adminActivate, setAdminActivate] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cafeId, setCafeId] = useState('');
  const [canteenMode, setCanteenMode] = useState('login');
  const [secretCode, setSecretCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(auth.pendingAuth);
  const [reset, setReset] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.message || '');
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const signedInRole = auth.user?.role;
  useEffect(() => {
    if (!auth.loading && !auth.authError && signedInRole && !pending && !recovery) navigate(`/${signedInRole}`, { replace: true });
  }, [auth.loading, auth.authError, signedInRole, pending, recovery, navigate]);
  const wait = pending ? Math.max(0, Math.ceil((pending.resendAfter - now) / 1000)) : 0;
  async function perform(action) {
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try { await action(); } catch (issue) { setError(issue.message || 'Unable to complete sign-in. Please retry.'); }
    finally { setBusy(false); }
  }
  const handleSubmit = event => {
    event.preventDefault();
    void perform(async () => {
      if (recovery) {
        if (password !== confirmation) throw new Error('Passwords do not match.');
        const result = await auth.changePassword(password);
        setRecovery(false); setPending(null); setPassword(''); setConfirmation('');
        navigate(`/${result.role}`, { replace: true }); return;
      }
      if (pending) {
        const result = await auth.verifyEmail(code);
        setCode('');
        if (result.recovery) { setRecovery(true); setPending(null); setPassword(''); setConfirmation(''); return; }
        if (result.verified) { setRole(result.role); setPending(null); setRegister(false); setAdminActivate(false); setSuccess('Email verified. Please log in with your password.'); return; }
        navigate(`/${result.role}`, { replace: true }); return;
      }
      if (reset) { await auth.resetPassword(email, role); setPending(auth.pendingAuth()); setReset(false); setPassword(''); setConfirmation(''); setSuccess('If the account exists, a password reset code has been sent to your email.'); return; }
      if (role === 'admin' && adminActivate) {
        await auth.activateAdmin({ email, password }); setPending(auth.pendingAuth()); setPassword('');
        setSuccess('Check your email to verify the provisioned admin account.'); return;
      }
      const result = await auth.login({ role, email, name, register, cafeId, secretCode, password, canteenMode });
      setPassword(''); setSecretCode('');
      if (result.pending) { const next = auth.pendingAuth(); setPending(next); setSuccess(next.flow === 'signup' ? 'Enter your email OTP to finish signup and sign in. Use Resend OTP if you need a new code.' : 'Check your email for a verification link or code.'); return; }
      navigate(`/${result.role}`, { replace: true });
    });
  };
  function changeRole(value) {
    auth.clearPending(); setPending(null); setRecovery(false); setReset(false); setAdminActivate(false); setRegister(false);
    setRole(value); setCanteenMode('login'); setError(''); setSuccess(''); setEmail(''); setPassword(''); setSecretCode(''); setCode('');
  }
  const inputStyle = 'mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#0f8f73]';
  const title = recovery ? 'Choose a new password' : pending ? 'Check your email' : reset ? 'Reset your password'
    : register && role === 'student' ? 'Create your account' : adminActivate ? 'Activate admin account' : 'Welcome back';
  return <div className="flex min-h-screen items-center justify-center bg-[#075d50] px-5 py-10">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-[#064e43] p-8 text-white lg:p-12">
        <p className="text-2xl font-black">Spoon<span className="text-[#facc15]">Ate</span></p>
        <div className="my-12"><p className="font-bold text-[#facc15]">BANASTHALI VIDYAPITH</p><h1 className="mt-4 text-4xl font-black">Order ahead.<br />Collect when ready.</h1><p className="mt-5 text-white/70">Choose your canteen, schedule your pickup, and track your order until it is ready.</p></div>
        <p className="flex items-center gap-2 text-sm text-white/70"><ShieldCheck size={18} /> Verified email access</p>
      </section>
      <section className="p-8 lg:p-12">
        <h2 className="text-3xl font-black">{title}</h2>
        {!pending && !recovery && <div className="mt-6 flex gap-2" aria-label="Account role">{['student', 'canteen', 'admin'].map(item =>
          <button key={item} type="button" disabled={busy} aria-pressed={role === item} onClick={() => changeRole(item)} className={`flex-1 rounded-xl px-3 py-3 text-sm font-bold capitalize ${role === item ? 'bg-[#075d50] text-white' : 'bg-gray-100 text-gray-600'}`}>{item}</button>)}</div>}
        {role === 'student' && !pending && !recovery && !reset && <div className="mt-6 flex gap-5 text-sm font-bold">{[false, true].map(value =>
          <button key={String(value)} type="button" disabled={busy} onClick={() => { setRegister(value); setError(''); setSuccess(''); }} className={register === value ? 'text-[#0f8f73] underline' : 'text-gray-500'}>{value ? 'Sign up' : 'Login'}</button>)}</div>}
        {role === 'canteen' && !pending && <div className="mt-6 flex gap-5 text-sm font-bold">{['login', 'join'].map(value =>
          <button key={value} type="button" disabled={busy} aria-pressed={canteenMode === value} onClick={() => { setCanteenMode(value); setSecretCode(''); setError(''); setSuccess(''); }} className={canteenMode === value ? 'text-[#0f8f73] underline' : 'text-gray-500'}>{value === 'login' ? 'Login' : 'Join canteen'}</button>)}</div>}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            {pending && <>
              <p className="break-all text-sm text-gray-600">{pending.flow === 'reset' ? `Enter the password reset code sent to ${pending.email}. After verification, choose a new password.` : pending.flow === 'signup' ? `Enter the OTP sent to ${pending.email}. After verification, you will be signed in automatically.` : `We sent an email to ${pending.email}. Open its link in this browser, or enter its verification code below if one is included.`}</p>
              {pending.flow === 'signup' && <p className="text-sm text-gray-500">If verification fails, you can retry here. Wait for the resend timer, request a new OTP and use the newest code.</p>}
              {pending.flow === 'staff' && <p className="text-sm text-gray-500">Use the code from the newest canteen sign-in email. After requesting another email, discard earlier codes. Each code works once; opening its verification link can also use it.</p>}
              {pending.expiresAt && <p className="text-sm text-gray-600">This canteen sign-in expires at {new Date(pending.expiresAt).toLocaleTimeString()}.</p>}
              <label className="block text-sm font-bold">Email verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={code} onChange={event => setCode(event.target.value)} className={inputStyle} /></label>
            </>}
            {recovery ? <>
              <label className="block text-sm font-bold">New password<input type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} className={inputStyle} /></label>
              <label className="block text-sm font-bold">Confirm new password<input type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} className={inputStyle} /></label>
            </> : !pending && <>
              {role === 'student' && register && !reset && <label className="block text-sm font-bold">Your name<input autoComplete="name" maxLength={120} required value={name} onChange={event => setName(event.target.value)} className={inputStyle} /></label>}
              <label className="block text-sm font-bold">{role === 'student' ? 'Banasthali email' : 'Email'}<input type="email" autoComplete="email" required value={email} placeholder={role === 'student' ? 'yourname@banasthali.in' : 'Enter your email'} onChange={event => setEmail(event.target.value)} className={inputStyle} /></label>
              {role !== 'canteen' && !reset && <label className="block text-sm font-bold">Password<input type="password" autoComplete={register || adminActivate ? 'new-password' : 'current-password'} minLength={register || adminActivate ? 12 : 1} maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} className={inputStyle} /></label>}
              {role === 'student' && <p className="text-sm text-gray-500">{reset ? 'We will email a verification code to your registered @banasthali.in address. Verify it to choose a new password.' : register ? 'Verify your @banasthali.in email with an OTP to finish signup and sign in. Use at least 12 characters for your password.' : 'Log in with your verified @banasthali.in email and password.'}</p>}
              {role === 'admin' && adminActivate && <p className="text-sm text-gray-500">Use the email and initial password supplied by your administrator. Verify your email, then return here to log in.</p>}
              {role === 'canteen' && <>
                <label className="block text-sm font-bold">Your canteen<select required value={cafeId} onChange={event => { setCafeId(event.target.value); setSecretCode(''); }} className={inputStyle}><option value="">Select the canteen you represent</option>{cafes.map(cafe => <option key={cafe.id} value={cafe.id}>{cafe.name}</option>)}</select></label>
                {canteenMode === 'join' && <label className="block text-sm font-bold">Member access code<input type="password" required maxLength={256} autoComplete="off" value={secretCode} onChange={event => setSecretCode(event.target.value)} className={inputStyle} /></label>}
                <p className="text-sm text-gray-500">{canteenMode === 'login' ? 'Already a member? Verify your email to log in. No access code needed.' : 'Enter the access code once to join, then verify your email. Next time, use Login.'}</p>
              </>}
            </>}
            <button className="w-full rounded-xl bg-[#0f8f73] py-3 font-black text-white disabled:opacity-60">{busy ? 'Please wait…' : recovery ? 'Save new password' : pending ? pending.flow === 'reset' ? 'Verify reset code' : 'Verify email' : reset ? 'Send reset code' : adminActivate ? 'Activate account' : role === 'student' && register ? 'Sign up' : role === 'canteen' ? 'Send verification email' : 'Login'}</button>
          </fieldset>
        </form>
        {success && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {pending && <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold">
          <button disabled={busy || wait > 0} onClick={() => void perform(async () => { await auth.resend(); setPending(auth.pendingAuth()); setCode(''); setSuccess('New verification email requested. Use the newest code in your inbox.'); })} className="text-[#075d50] disabled:opacity-50">{wait ? `Resend in ${wait}s` : pending.flow === 'reset' ? 'Resend reset code' : pending.flow === 'signup' ? 'Resend OTP' : 'Resend email'}</button>
          <button disabled={busy} onClick={() => { auth.clearPending(); setPending(null); setCode(''); setError(''); setSuccess(''); }} className="text-gray-600">Start again</button>
        </div>}
        {!pending && !recovery && role !== 'canteen' && !(role === 'student' && register) && <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold">
          {!adminActivate && <button disabled={busy} onClick={() => { setReset(!reset); setError(''); setSuccess(''); }} className="text-[#075d50]">{reset ? 'Back to login' : 'Forgot password?'}</button>}
          {role === 'admin' && !reset && <button disabled={busy} onClick={() => { setAdminActivate(!adminActivate); setError(''); setSuccess(''); }} className="text-[#075d50]">{adminActivate ? 'Back to login' : 'First sign-in? Activate account'}</button>}
        </div>}
      </section>
    </div>
  </div>;
}
