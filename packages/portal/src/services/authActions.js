export const pendingAuthKey = 'spoonatePendingAuth';
export function studentEmail(value) {
  const email = value.trim().toLowerCase();
  if (!/^[^@\s]+@banasthali\.in$/.test(email)) throw new Error('Use your exact @banasthali.in email address.');
  return email;
}
export function createAuthActions({ auth, api, storage, origin, portal }) {
  const key = portal ? `${pendingAuthKey}:${portal}` : pendingAuthKey;
  const ensureRole = role => { if (portal && role !== portal) throw new Error('Use the correct portal for this account.'); };
  const ensureFlow = flow => {
    if (!portal) return;
    if (flow === 'signup') ensureRole('student');
    else if (flow === 'admin-signup') ensureRole('admin');
    else if (flow === 'staff') ensureRole('canteen');
    else if (flow === 'reset') { if (portal === 'canteen') throw new Error('Use email verification to sign in.'); }
    else throw new Error('Start sign-in again.');
  };
  const pending = () => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
  const save = value => storage.setItem(key, JSON.stringify(value));
  const check = result => { if (result.error) throw result.error; return result.data; };
  const ready = () => { if (!auth) throw new Error('Sign-in is unavailable. Check the Supabase configuration.'); };
  const redirect = flow => `${origin}/auth/callback?flow=${flow}`;
  async function finish(session, flow = pending()?.flow) {
    ensureFlow(flow);
    ready();
    if (!session?.access_token) throw new Error('The email verification expired. Request a new email.');
    if (session.user?.email && pending()?.email && session.user.email.toLowerCase() !== pending().email) throw new Error('This verification belongs to a different email. Start again with the intended account.');
    const token = session.access_token;
    if (flow === 'signup') {
      throw new Error('Enter the signup OTP on the signup page to finish creating your account.');
    }
    if (flow === 'admin-signup') {
      await api('/auth/admin/confirm', { method: 'POST', body: {}, token });
      check(await auth.signOut({ scope: 'local' }));
      storage.removeItem(key);
      return { verified: true, role: 'admin' };
    }
    if (flow !== 'staff' || !pending()?.challengeId) throw new Error('Open this email in the browser where you started canteen sign-in.');
    const actor = await api('/auth/session', { method: 'POST', token, body: { role: 'CANTEEN', challengeId: pending().challengeId } });
    storage.removeItem(key);
    return actor;
  }
  return {
    pending, finish,
    async signup({ email, name, password }) {
      ensureRole('student');
      ready(); email = studentEmail(email);
      if (!name.trim() || name.trim().length > 120) throw new Error('Enter your name (up to 120 characters).');
      if (password.length < 8 || password.length > 256) throw new Error('Use a password with 8–256 characters.');
      const data = check(await auth.signUp({ email, password, options: { data: { name: name.trim() }, emailRedirectTo: redirect('signup') } }));
      if (data.session) { await auth.signOut({ scope: 'local' }); throw new Error('Email confirmation must be enabled in Supabase before signup can be used.'); }
      if (data.user?.identities?.length === 0) {
        storage.removeItem(key);
        throw new Error('This email may already be registered. Log in with your password, or use Forgot password on the login page.');
      }
      save({ flow: 'signup', email, resendAfter: Date.now() + 60000 });
    },
    async login({ email, password, role }) {
      ensureRole(role);
      ready(); email = role === 'student' ? studentEmail(email) : email.trim().toLowerCase();
      if (!['student', 'admin'].includes(role)) throw new Error('Choose a valid account role.');
      const response = await auth.signInWithPassword({ email, password });
      if (response.error?.code === 'email_not_confirmed') {
        save({ flow: role === 'student' ? 'signup' : 'admin-signup', email, resendAfter: 0 });
        return { pending: true };
      }
      const data = check(response);
      try { return await api('/auth/session', { method: 'POST', token: data.session.access_token, body: { role: role.toUpperCase() } }); }
      catch (error) { await auth.signOut({ scope: 'local' }); throw error; }
    },
    async activateAdmin({ email, password }) {
      ensureRole('admin');
      ready(); email = email.trim().toLowerCase();
      await api('/auth/admin/activate', { method: 'POST', body: { email, password } });
      save({ flow: 'admin-signup', email, resendAfter: Date.now() + 60000 });
    },
    async staff({ email, canteenId, accessCode, returning = false }) {
      ensureRole('canteen');
      ready(); email = email.trim().toLowerCase();
      const challenge = await api(returning ? '/auth/canteen/returning' : '/auth/canteen/login', {
        method: 'POST', body: returning ? { email, canteenId } : { email, canteenId, accessCode },
      });
      check(await auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirect('staff') } }));
      save({ flow: 'staff', email, ...challenge, resendAfter: Date.now() + 60000 });
    },
    async verify(code) {
      ready(); const value = pending();
      if (value) ensureFlow(value.flow);
      code = code.trim();
      if (!value || !/^\d{6,10}$/.test(code)) throw new Error('Enter the code from your email.');
      if (value.flow === 'staff' && Date.parse(value.expiresAt) <= Date.now()) throw new Error('Canteen sign-in expired. Start again with your access code to request a new email.');
      if (value.flow === 'signup') {
        const actor = await api('/auth/confirm-signup', { method: 'POST', body: { email: value.email, code } });
        storage.removeItem(key);
        return actor;
      }
      const type = ['signup', 'admin-signup'].includes(value.flow) ? 'signup' : value.flow === 'reset' ? 'recovery' : 'email';
      const response = await auth.verifyOtp({ email: value.email, token: code, type });
      if (value.flow === 'staff' && response.error?.code === 'otp_expired') {
        throw new Error('This code is invalid, expired, or has been replaced. Use the code from your newest canteen sign-in email, or resend when it becomes available.');
      }
      const data = check(response);
      if (value.flow === 'reset') {
        if (!data?.session?.access_token) throw new Error('The password reset code expired. Request a new code.');
        if (data.session.user?.email && data.session.user.email.toLowerCase() !== value.email) throw new Error('This verification belongs to a different email. Start again with the intended account.');
        return { recovery: true };
      }
      return finish(data.session);
    },
    async resend() {
      ready(); const value = pending();
      if (value) ensureFlow(value.flow);
      if (!value) throw new Error('Start sign-in again.');
      if (Date.now() < value.resendAfter) throw new Error('Please wait before requesting another email.');
      if (value.flow === 'staff' && Date.parse(value.expiresAt) <= Date.now()) throw new Error('Canteen sign-in expired. Start again with your access code.');
      if (['signup', 'admin-signup'].includes(value.flow)) check(await auth.resend({ type: 'signup', email: value.email, options: { emailRedirectTo: redirect(value.flow) } }));
      else if (value.flow === 'reset') check(await auth.resetPasswordForEmail(value.email, { redirectTo: `${redirect('reset')}&role=${value.role}` }));
      else check(await auth.signInWithOtp({ email: value.email, options: { shouldCreateUser: true, emailRedirectTo: redirect('staff') } }));
      save({ ...value, resendAfter: Date.now() + 60000 });
    },
    async requestVerification(email, role) {
      ensureRole(role);
      ready(); email = role === 'student' ? studentEmail(email) : email.trim().toLowerCase();
      const flow = role === 'admin' ? 'admin-signup' : 'signup';
      check(await auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirect(flow) } }));
      save({ flow, email, resendAfter: Date.now() + 60000 });
    },
    async reset(email, role) {
      ensureRole(role);
      ready(); email = role === 'student' ? studentEmail(email) : email.trim().toLowerCase();
      if (!['student', 'admin'].includes(role)) throw new Error('Choose a valid account role.');
      check(await auth.resetPasswordForEmail(email, { redirectTo: `${redirect('reset')}&role=${role}` }));
      save({ flow: 'reset', email, role, resendAfter: Date.now() + 60000 });
    },
    async changePassword(password, role = pending()?.role || portal || 'student') {
      ensureRole(role);
      ready();
      if (password.length < 8 || password.length > 256) throw new Error('Use a password with 8–256 characters.');
      const { session } = check(await auth.getSession());
      if (!session) throw new Error('Request a new password reset email.');
      const email = session.user?.email || pending()?.email;
      if (!email || !['student', 'admin'].includes(role)) throw new Error('Request a new password reset email.');
      await api('/auth/revoke-sessions', { method: 'POST', body: {}, token: session.access_token });
      check(await auth.updateUser({ password }));
      check(await auth.signOut({ scope: 'global' }));
      const data = check(await auth.signInWithPassword({ email, password }));
      let actor;
      try { actor = await api('/auth/session', { method: 'POST', token: data.session.access_token, body: { role: role.toUpperCase() } }); }
      catch (error) { await auth.signOut({ scope: 'local' }); throw error; }
      storage.removeItem(key);
      return actor;
    },
    async callback(flow) {
      ensureFlow(flow);
      if (flow === 'signup') throw new Error('Enter the signup OTP on the signup page to finish creating your account.');
      ready(); const { session } = check(await auth.getSession());
      if (flow === 'reset') { if (!session) throw new Error('Request a new password reset email.'); return { recovery: true }; }
      return finish(session, flow);
    },
    clear() { storage.removeItem(key); },
  };
}
