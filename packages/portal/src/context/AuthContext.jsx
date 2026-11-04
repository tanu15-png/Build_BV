import { portal } from '../portal.js';
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import { createAuthActions } from '../services/authActions';
import { createLogoutRecovery } from '../services/logoutRecovery';
import { sessionEnded, logoutFailure } from '../services/sessionErrors';

const AuthContext = createContext();
const actions = createAuthActions({ auth: supabase?.auth, api, storage: sessionStorage, origin: window.location.origin, portal });
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [canteenMembers, setMembers] = useState([]);
  const [memberSummary, setMemberSummary] = useState(null);
  const [memberError, setMemberError] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const revision = useRef(0);
  const signingOut = useRef(false);
  const [logoutRecovery] = useState(() => createLogoutRecovery({
    revoke: () => api('/auth/logout', { method: 'POST', body: {} }),
    onSuccess: () => {
      setUser(null); setMembers([]); setMemberSummary(null); setMemberError(''); setNextCursor(null); setAuthError(''); actions.clear();
      // Only student and canteen portals have a Supabase browser session.
      // The application session has already been revoked at this point.
      void supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
    },
    onError: error => setAuthError(logoutFailure(error)),
  }));
  const logout = useCallback(async () => {
    if (signingOut.current) return logoutRecovery.logout();
    signingOut.current = true;
    revision.current++;
    try { await logoutRecovery.logout(); }
    finally { revision.current++; signingOut.current = false; }
  }, [logoutRecovery]);
  const canteenId = user?.canteenId;
  const mapUser = useCallback(async identity => {
    if (identity.role !== 'CANTEEN') return { ...identity, role: identity.role.toLowerCase() };
    const { canteens } = await api('/canteens');
    const cafeId = identity.canteenId ? canteens.find(c => c.id === identity.canteenId)?.slug : undefined;
    if (identity.role === 'CANTEEN' && !cafeId) throw new Error('Your canteen is unavailable. Contact an administrator.');
    return { ...identity, role: identity.role.toLowerCase(), cafeId };
  }, []);
  const refreshSession = useCallback(async () => {
    if (signingOut.current) return;
    if (logoutRecovery.pending()) {
      try { await logout(); } catch { /* Keep the retry screen until sign-out is confirmed. */ }
      return;
    }
    const started = revision.current;
    try { const next = await mapUser(await api('/auth/me')); if (started === revision.current) { setUser(next); setAuthError(''); } }
    catch (error) {
      if (started !== revision.current) return;
      if (sessionEnded(error)) { setUser(null); setAuthError(''); }
      else setAuthError(error.message);
    } finally { setLoading(false); }
  }, [mapUser, logoutRecovery, logout]);
  useEffect(() => {
    // Remove prototype plaintext accounts and roles. Never import their credentials.
    for (const key of ['campusEatsStudentsV2', 'campusEatsMembersV2', 'campusEatsStaffSessionsV2']) localStorage.removeItem(key);
    sessionStorage.removeItem('campusEatsSessionV2');
    const initial = setTimeout(() => { void refreshSession(); }, 0);
    const refresh = () => { void refreshSession(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [refreshSession]);
  const refreshMembers = useCallback(async (cursor = null) => {
    if (!canteenId) return;
    const started = revision.current;
    try {
      const page = await api(`/canteens/${canteenId}/members?limit=100${cursor ? `&cursor=${cursor}` : ''}`);
      if (started !== revision.current) return;
      setMembers(current => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
      setMemberSummary(page);
      setMemberError('');
    } catch (error) { if (started === revision.current) { setMemberError(error.message); if (error.status === 401) void refreshSession(); } }
  }, [canteenId, refreshSession]);
  useEffect(() => {
    if (!canteenId) return;
    const initial = setTimeout(() => { void refreshMembers(); }, 0);
    const timer = setInterval(() => { void refreshMembers(); }, 30000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [canteenId, refreshMembers]);
  const accept = async identity => {
    revision.current++;
    const mapped = await mapUser(identity); if (mapped.role !== portal) throw new Error('Use the correct portal for this account.'); setUser(mapped); setAuthError(''); setLoading(false); return mapped;
  };
  const login = async values => {
    values = { ...values, role: portal };
    if (portal === 'admin') return accept(await api('/auth/admin/password', { method: 'POST', body: { password: values.password } }));
    if (values.role === 'student' && values.register) { await actions.signup(values); return { pending: true }; }
    if (values.role === 'canteen') {
      const identity = await api('/auth/canteen/access', { method: 'POST', body: { name: values.name, accessCode: values.accessCode } });
      actions.clear();
      return accept(identity);
    }
    const result = await actions.login(values);
    return result.pending ? result : accept(result);
  };
  const finish = async result => result.verified || result.recovery ? result : accept(result);
  const removeMember = async id => {
    const member = canteenMembers.find(m => m.id === id);
    if (!member || !user?.canteenId) throw new Error('Refresh the member list and retry.');
    await api(`/canteens/${user.canteenId}/members/${id}/revoke`, { method: 'POST', body: { expectedVersion: member.version } });
    await refreshSession(); await refreshMembers();
  };
  return <AuthContext.Provider value={{ user, loading, authError, refreshSession, login, logout,
    canteenMembers, memberSummary, memberError, removeMember, loadMoreMembers: nextCursor ? () => refreshMembers(nextCursor) : null,
    pendingAuth: actions.pending, clearPending: actions.clear, resend: actions.resend,
    verifyEmail: async code => finish(await actions.verify(code)),
    completeCallback: async flow => finish(await actions.callback(flow)),
    activateAdmin: actions.activateAdmin, resetPassword: actions.reset,
    changePassword: async (password, role) => accept(await actions.changePassword(password, role)),
    requestVerification: actions.requestVerification,
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() { return useContext(AuthContext); }
