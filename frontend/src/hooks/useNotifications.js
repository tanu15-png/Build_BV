import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { createNotificationFeed } from '../services/notificationFeed';
import { pollingInterval, startVisiblePolling } from '../services/polling';
const empty = { items: [], nextCursor: null, unreadCount: 0, loading: false, error: '', readingIds: [] };
export function useNotifications(user, refreshSession) {
  const owner = user?.role === 'student' ? user.id : '';
  const feed = useRef(null);
  const [state, setState] = useState({ owner: '', ...empty });
  useEffect(() => {
    if (!owner) return;
    const current = createNotificationFeed({ request: api,
      changed: snapshot => { if (feed.current === current) setState({ owner, ...snapshot }); },
      unauthorized: () => { void refreshSession(); },
    });
    current.owner = owner; feed.current = current;
    const poller = startVisiblePolling({ refresh: () => current.refresh(), intervalMs: pollingInterval(import.meta.env.VITE_SYNC_INTERVAL_MS) });
    return () => { poller.stop(); current.dispose(); };
  }, [owner, refreshSession]);
  const refreshNotifications = useCallback(() => {
    if (feed.current?.owner === owner) return feed.current.refresh().catch(() => {});
  }, [owner]);
  const visible = state.owner === owner && owner ? state : empty;
  return {
    notifications: visible.items, unreadNotificationCount: visible.unreadCount,
    notificationsLoading: Boolean(owner) && (state.owner !== owner || visible.loading), notificationsError: visible.error,
    readingNotificationIds: visible.readingIds, refreshNotifications,
    loadMoreNotifications: visible.nextCursor ? () => feed.current?.refresh(true).catch(() => {}) : null,
    markNotificationRead: id => feed.current?.owner === owner ? feed.current.markRead(id) : Promise.reject(new Error('Sign in to read your notifications.')),
  };
}
