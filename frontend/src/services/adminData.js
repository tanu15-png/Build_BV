export function adminOrderQuery({ search = '', status = 'ALL', canteenId = 'ALL', from = '', to = '', codeDay = '', orderCode = '' }) {
  const query = new URLSearchParams({ limit: '25' });
  if (search.trim()) query.set('search', search.trim());
  if (status !== 'ALL') query.set('status', status);
  if (canteenId !== 'ALL') query.set('canteenId', canteenId);
  if (from) query.set('from', new Date(`${from}T00:00:00+05:30`).toISOString());
  if (to) query.set('to', new Date(`${to}T23:59:59.999+05:30`).toISOString());
  if (codeDay) query.set('codeDay', codeDay);
  if (orderCode.trim()) query.set('orderCode', orderCode.trim().toUpperCase());
  return '/admin/orders?' + query;
}
// Keep pages contiguous during polling and discard reads that predate an admin write.
export function createAdminResource({ path, request, changed, unauthorized = () => {} }) {
  let state = { items: [], nextCursor: null, meta: {}, loading: false, error: '' };
  let pages = 1; let revision = 0; let active = null; let reload = false; let disposed = false; let suspended = false;
  const emit = patch => { if (!disposed) { state = { ...state, ...patch }; changed(state); } };
  async function refresh(more = false) {
    if (disposed || suspended) return;
    if (active) { if (!more) reload = true; return active; }
    if (more && !state.nextCursor) return;
    const started = revision; const target = more ? 1 : pages;
    emit({ loading: true });
    active = (async () => {
      try {
        let cursor = more ? state.nextCursor : null; let fetched = 0; let page; let meta = state.meta; const rows = [];
        do {
          page = await request(path + (cursor ? `${path.includes('?') ? '&' : '?'}cursor=${cursor}` : ''));
          rows.push(...page.items); meta = { ...meta, ...page.meta }; fetched++; cursor = page.nextCursor;
        } while (cursor && fetched < target && !disposed);
        if (disposed) return;
        if (started !== revision) { reload = true; return; }
        pages = more ? pages + 1 : fetched;
        const items = more ? [...state.items, ...rows] : rows;
        emit({ items: [...new Map(items.map(item => [item.id, item])).values()], nextCursor: page.nextCursor, meta, error: '' });
      } catch (error) {
        if (!disposed) { emit({ error: error.message }); if ([401, 403].includes(error.status)) { suspended = true; unauthorized(); } }
        throw error;
      } finally {
        active = null; emit({ loading: false });
        if (reload && !disposed && !suspended) { reload = false; void refresh().catch(() => {}); }
      }
    })();
    return active;
  }
  return { refresh, invalidate() { revision++; return refresh(); }, snapshot: () => state, dispose() { disposed = true; } };
}
