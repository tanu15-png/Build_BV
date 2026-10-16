// Keep drafts separate from persisted records until the server confirms the write.
export function prepareMenuChange(menu, path, method, body, temporaryId) {
  const data = { ...body };
  delete data.expectedVersion;
  if (typeof data.name === 'string') data.name = data.name.trim();
  let field;
  let id;
  if (/\/menu-categories\//.test(path) || path.endsWith('/categories')) field = 'categories';
  else if (/\/menu-items\//.test(path) || path.endsWith('/menu')) field = 'items';
  else field = 'canteen';
  const creating = method === 'POST';
  if (field === 'canteen') id = menu.canteen.id;
  else id = creating ? temporaryId || `pending-${crypto.randomUUID()}` : path.split('/').at(-1);
  const existing = field === 'canteen' ? menu.canteen : menu[field].find(row => row.id === id);
  if (!creating && !existing) throw new Error('Refresh your menu and retry.');
  if (method === 'DELETE') {
    const next = { ...menu, [field]: menu[field].filter(row => row.id !== id) };
    if (field === 'categories') next.items = menu.items.filter(item => item.categoryId !== id);
    return { optimistic: next, confirm: () => next, field, id };
  }
  const draft = { ...(creating ? { id, canteenId: menu.canteen.id, version: 1, archived: false,
    ...(field === 'items' ? { available: true, description: null, imageRef: null } : {}) } : existing),
    ...data, ...(creating ? {} : { version: existing.version + 1 }) };
  function update(record) {
    const next = { ...menu, [field]: field === 'canteen' ? record : creating ? [...menu[field], record] : menu[field].map(row => row.id === id ? record : row) };
    const names = new Map(next.categories.map(category => [category.id, category.name]));
    next.items = next.items.map(item => ({ ...item, category: names.get(item.categoryId) || item.category }));
    return next;
  }
  return { optimistic: update(draft), confirm: update, field, id };
}

export function mergeCanteenMenu(catalog, menu) {
  const id = menu.canteen.id;
  const categories = menu.categories.filter(category => !category.archived);
  const categoryIds = new Set(categories.map(category => category.id));
  const canteens = catalog.canteens.some(canteen => canteen.id === id)
    ? catalog.canteens.map(canteen => canteen.id === id ? menu.canteen : canteen)
    : [...catalog.canteens, menu.canteen];
  return { canteens,
    categories: [...catalog.categories.filter(category => category.canteenId !== id), ...categories],
    items: [...catalog.items.filter(item => item.canteenId !== id), ...menu.items.filter(item => !item.archived && categoryIds.has(item.categoryId))] };
}

export async function saveMenuChange({ menu, path, method, body, request, optimistic, confirmed, rollback }) {
  const change = prepareMenuChange(menu, path, method, body);
  optimistic(change.optimistic);
  try {
    const result = await request(path, { method, body });
    const next = change.confirm(result);
    confirmed(next);
    return next;
  } catch (error) { rollback(menu); throw error; }
}
