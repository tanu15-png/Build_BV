// Compare the cart the student saw with the confirmed cart; refreshed tokens are not cart edits.
export function checkoutSnapshot(cart) {
  if (!cart) return null;
  return JSON.stringify({ id: cart.id, canteenId: cart.canteenId, version: cart.version,
    totalPaise: cart.totalPaise, available: cart.available,
    items: cart.items.map(item => ({ id: item.id, menuItemId: item.menuItemId, name: item.name,
      quantity: item.quantity, unitPricePaise: item.unitPricePaise, available: item.available }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}
export async function submitCheckout({ cart, review, createOrder, pickupAt, pendingRequest }) {
  // An uncertain submission must retry its original payload and idempotency key.
  if (pendingRequest) return createOrder(pendingRequest.body);
  const shown = checkoutSnapshot(cart);
  let current;
  try { current = await review(); }
  catch (issue) {
    // A token can expire while the cart itself remains unchanged.
    if (issue.code !== 'QUOTE_CHANGED' || shown !== checkoutSnapshot(issue.details?.cart)) throw issue;
    current = await review();
  }
  if (shown !== checkoutSnapshot(current)) {
    throw new Error('Your cart changed. Check the updated items and total, then place your order again.');
  }
  return createOrder({ expectedVersion: current.version, quote: current.quote, pickupAt: pickupAt() });
}
