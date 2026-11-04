const invalid = (message, status = 422) => Object.assign(new Error(message), { status });
const empty = () => ({ id: 'pending-cart', version: 0, canteenId: null, items: [], totalPaise: 0, available: false, quote: '' });

function recalculate(cart, items) {
  return { ...cart, items, canteenId: items[0]?.canteenId ?? null,
    totalPaise: items.reduce((sum, item) => sum + item.quantity * item.unitPricePaise, 0),
    available: items.length > 0 && items.every(item => item.available), quote: '' };
}

export function addCartItem(cart, item, canteen) {
  cart = cart || empty();
  if (!item || !canteen || !canteen.operational || !canteen.acceptingOrders || !item.available || item.archived) {
    throw invalid('This item or canteen is currently unavailable.', 409);
  }
  if (cart.items.length && cart.canteenId !== item.canteenId) throw invalid('Your cart contains items from another canteen. Remove them before switching.', 409);
  const existing = cart.items.find(line => line.menuItemId === item.id);
  if (existing?.quantity >= 99) throw invalid('You can add at most 99 of an item.');
  if (!existing && cart.items.length >= 100) throw invalid('You can add at most 100 different items.');
  const items = existing
    ? cart.items.map(line => line.menuItemId === item.id ? { ...line, quantity: line.quantity + 1 } : line)
    : [...cart.items, { id: `pending-${item.id}`, menuItemId: item.id, canteenId: item.canteenId,
      name: item.name, quantity: 1, unitPricePaise: item.pricePaise, categoryId: item.categoryId,
      category: item.category, description: item.description, imageRef: item.imageRef,
      menuVersion: item.version, available: true, archived: false }];
  return recalculate(cart, items);
}

export function changeCartQuantity(cart, menuItemId, quantity) {
  if (!cart?.items.some(item => item.menuItemId === menuItemId)) throw invalid('This item is no longer in your cart. Refresh your cart and retry.', 409);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw invalid('Use a quantity from 0 to 99.');
  const line = cart.items.find(item => item.menuItemId === menuItemId);
  if (!line.available && quantity > line.quantity) throw invalid('This item is currently unavailable.', 409);
  return recalculate(cart, quantity === 0 ? cart.items.filter(item => item.menuItemId !== menuItemId)
    : cart.items.map(item => item.menuItemId === menuItemId ? { ...item, quantity } : item));
}

export const clearCart = cart => recalculate(cart || empty(), []);
