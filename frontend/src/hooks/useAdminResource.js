import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { createAdminResource } from '../services/adminData';
import { pollingInterval, startVisiblePolling } from '../services/polling';
const empty = { items: [], nextCursor: null, meta: {}, loading: false, error: '' };
export function useAdminResource(path, withOverview = false) {
  const { user, refreshSession } = useAuth();
  const owner = user?.role === 'admin' ? `${user.id}:${path}:${withOverview}` : '';
  const resource = useRef(null);
  const [state, setState] = useState({ owner: '', ...empty });
  useEffect(() => {
    if (!owner) return;
    const current = createAdminResource({ path,
      request: async endpoint => {
        const [page, overview] = await Promise.all([api(endpoint), withOverview && !endpoint.includes('cursor=') ? api('/admin/overview') : null]);
        return { ...page, meta: { ...(overview ? { overview } : {}), ...(page.totalCount !== undefined ? { totalCount: page.totalCount } : {}) } };
      },
      changed: snapshot => { if (resource.current === current) setState({ owner, ...snapshot }); },
      unauthorized: () => { void refreshSession(); },
    });
    current.owner = owner; resource.current = current;
    const poller = startVisiblePolling({ refresh: () => current.refresh(), intervalMs: pollingInterval(import.meta.env.VITE_SYNC_INTERVAL_MS) });
    return () => { poller.stop(); current.dispose(); };
  }, [owner, path, withOverview, refreshSession]);
  const refresh = useCallback(() => {
    if (resource.current?.owner === owner) return resource.current.invalidate().catch(() => {});
  }, [owner]);
  const visible = owner && state.owner === owner ? state : empty;
  return { ...visible, loading: Boolean(owner) && (state.owner !== owner || visible.loading), refresh,
    loadMore: visible.nextCursor ? () => resource.current?.refresh(true).catch(() => {}) : null };
}
