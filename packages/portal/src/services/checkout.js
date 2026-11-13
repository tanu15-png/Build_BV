// Compare the visible purchase intent. Background saves replace temporary IDs
// and advance versions without changing the items the student chose.
export function checkoutSnapshot(cart) {
  if (!cart) return null;
  return JSON.stringify({ canteenId: cart.canteenId,
    totalPaise: cart.totalPaise, available: cart.available,
    items: cart.items.map(item => ({ menuItemId: item.menuItemId, name: item.name,
      quantity: item.quantity, unitPricePaise: item.unitPricePaise, available: item.available }))
      .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId)),
  });
}
export async function submitCheckout({ cart, review, createOrder, pendingRequest, onStage = () => {} }) {
  // An uncertain submission must retry its original payload and idempotency key.
  if (pendingRequest) { onStage('Submitting…'); return createOrder(pendingRequest.body); }
  onStage('Checking items and prices…');
  const shown = checkoutSnapshot(cart);
  let current;
  // review() joins the cart's existing write queue, so pending additions finish
  // during Submitting before their latest confirmed quote is validated.
  try { current = await review(); }
  catch (issue) {
    // A token can expire while the cart itself remains unchanged.
    if (issue.code !== 'QUOTE_CHANGED' || shown !== checkoutSnapshot(issue.details?.cart)) throw issue;
    current = await review();
  }
  if (shown !== checkoutSnapshot(current)) {
    throw new Error('Your cart changed. Check the updated items and total, then place your order again.');
  }
  onStage('Submitting…');
  return createOrder({ expectedVersion: current.version, quote: current.quote });
}
