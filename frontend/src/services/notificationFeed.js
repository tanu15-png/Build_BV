export function createNotificationFeed({ request, changed, unauthorized = () => {} }) {
  let state = { items: [], nextCursor: null, unreadCount: 0, loading: false, error: '', readingIds: [] };
  let pages = 1;
  let disposed = false;
  let suspended = false;
  let revision = 0;
  let active = null;
  let reload = false;
  const reads = new Map();
  const emit = patch => { if (!disposed) { state = { ...state, ...patch }; changed(state); } };
  function failed(error) {
    emit({ error: error.message });
    if ([401, 403].includes(error.status)) { suspended = true; unauthorized(); }
  }
  async function refresh(more = false) {
    if (disposed || suspended) return;
    if (active) { if (!more) reload = true; return active; }
    if (more && !state.nextCursor) return;
    const started = revision;
    const targetPages = more ? 1 : pages;
    emit({ loading: true });
    active = (async () => {
      try {
        let cursor = more ? state.nextCursor : null;
        const rows = [];
        let page;
        let fetched = 0;
        do {
          page = await request(`/notifications?limit=25${cursor ? `&cursor=${cursor}` : ''}`);
          rows.push(...page.items); fetched++; cursor = page.nextCursor;
        } while (cursor && fetched < targetPages && !disposed);
        if (disposed) return;
        if (started !== revision) { reload = true; return; }
        pages = more ? pages + 1 : fetched;
        const items = more ? [...state.items, ...rows] : rows;
        emit({ items: [...new Map(items.map(item => [item.id, item])).values()], nextCursor: page.nextCursor,
          unreadCount: page.unreadCount, error: '' });
      } catch (error) { if (!disposed) failed(error); throw error; }
      finally {
        active = null;
        emit({ loading: false });
        if (reload && !disposed && !suspended) { reload = false; void refresh().catch(() => {}); }
      }
    })();
    return active;
  }
  function markRead(id) {
    if (disposed || suspended) return Promise.reject(new Error('Sign in to read your notifications.'));
    if (reads.has(id)) return reads.get(id);
    emit({ readingIds: [...state.readingIds, id] });
    const completion = request(`/notifications/${id}/read`, { method: 'PATCH', body: {} }).then(saved => {
      if (disposed) return saved;
      revision++;
      const previous = state.items.find(item => item.id === id);
      emit({ items: state.items.map(item => item.id === id ? saved : item), error: '',
        unreadCount: previous && !previous.readAt ? Math.max(0, state.unreadCount - 1) : state.unreadCount });
      void refresh().catch(() => {});
      return saved;
    }).catch(error => { if (!disposed) failed(error); throw error; }).finally(() => {
      reads.delete(id); emit({ readingIds: state.readingIds.filter(value => value !== id) });
    });
    reads.set(id, completion);
    return completion;
  }
  return { refresh, markRead, snapshot: () => state, dispose() { disposed = true; } };
}
