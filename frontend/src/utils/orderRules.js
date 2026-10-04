export const orderStatuses = ["RECEIVED", "ACCEPTED", "PREPARING", "READY", "COLLECTED"];
export const statusLabels = {
  RECEIVED: "Awaiting acceptance",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready for pickup",
  COLLECTED: "Collected",
};

export function visibleOrders(orders, user) {
  return orders.filter((order) =>
    user?.role === "admin" ||
    (user?.role === "canteen" && order.cafeId === user.cafeId) ||
    (user?.role === "student" && order.studentEmail === user.email)
  );
}

export function orderNotifications(orders) {
  return orders.flatMap((order) => (order.history || [])
    .filter((event) => ["ACCEPTED", "READY"].includes(event.status))
    .map((event) => ({
      id: `${order.id}-${event.status}`,
      orderId: order.id,
      at: event.at,
      title: event.status === "READY" ? "Ready for pickup" : "Order accepted",
      message: event.status === "READY"
        ? `${order.cafeName} has prepared order ${orderCode(order)} (${orderDay(order)}). Show your dated order card at pickup.`
        : `${order.cafeName} accepted order ${orderCode(order)} (${orderDay(order)}).`,
    }))).sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function normalizeStudentEmail(email) {
  const normalized = email.trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@banasthali\.in$/.test(normalized)) {
    throw new Error("Use your email ending in @banasthali.in.");
  }
  return normalized;
}

export function assertAvailable(food, cafes, availability) {
  const cafe = cafes.find((item) => item.id === food.cafeId);
  if (!cafe || availability.pausedCafes.includes(cafe.id)) {
    throw new Error("This canteen has paused incoming orders. Please try later.");
  }
  if (availability.disabledFoods.includes(food.id)) {
    throw new Error(`${food.name} is currently unavailable. Remove it from your cart to continue.`);
  }
}

export function addCartItem(cart, food, cafes, availability) {
  assertAvailable(food, cafes, availability);
  if (cart.some((item) => item.cafeId !== food.cafeId)) {
    throw new Error("Your cart can contain items from only one canteen. Empty your cart before switching canteens.");
  }
  const existing = cart.find((item) => item.id === food.id);
  return existing
    ? cart.map((item) => item.id === food.id ? { ...item, quantity: item.quantity + 1 } : item)
    : [...cart, { ...food, quantity: 1 }];
}

const campusDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
});
const campusTimestampFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
});
export const formatCampusTimestamp = (timestamp) => campusTimestampFormatter.format(new Date(timestamp));
export const pickupLabel = (order) => `${formatCampusTimestamp(order.pickupAt)} IST`;

export function campusDay(timestamp = new Date()) {
  const parts = campusDateFormatter.formatToParts(new Date(timestamp));
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export const orderCode = (order) => order.orderCode || order.id;
export const orderDay = (order) => order.codeDay || campusDay(order.createdAt);

export function generateOrderId(orders, random = Math.random, now = new Date()) {
  const day = campusDay(now);
  const used = new Set(orders.filter((order) => orderDay(order) === day).map(orderCode));
  const capacity = 36 ** 3;
  const start = Math.floor(random() * capacity);
  // Probe this campus day's namespace across every canteen and status.
  for (let offset = 0; offset < capacity; offset += 1) {
    const code = ((start + offset) % capacity).toString(36).toUpperCase().padStart(3, "0");
    if (!used.has(code)) return code;
  }
  throw new Error("All test order codes are in use for this campus day. No new order can be placed.");
}

export function buildOrder({ cart, orders, user, cafes, foods, availability, pickupAt, now = new Date() }) {
  if (user?.role !== "student") throw new Error("Sign in as a student to place an order.");
  normalizeStudentEmail(user.email);
  if (!cart.length) throw new Error("Your cart is empty.");
  if (cart.some((item) => item.cafeId !== cart[0].cafeId)) throw new Error("Choose items from only one canteen.");
  const pickup = new Date(pickupAt);
  if (!Number.isFinite(pickup.getTime()) || pickup <= now) throw new Error("Choose a future pickup time.");
  const items = cart.map((item) => {
    const food = foods.find((entry) => entry.id === item.id && entry.cafeId === item.cafeId);
    if (!food) throw new Error("A cart item is no longer on the menu. Remove it to continue.");
    assertAvailable(food, cafes, availability);
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error("Invalid item quantity.");
    return { foodId: food.id, name: food.name, quantity: item.quantity, price: food.price };
  });
  const cafe = cafes.find((item) => item.id === cart[0].cafeId);
  return {
    id: globalThis.crypto.randomUUID(),
    orderCode: generateOrderId(orders, Math.random, now),
    codeDay: campusDay(now),
    studentEmail: user.email,
    studentName: user.name,
    cafeId: cafe.id,
    cafeName: cafe.name,
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    pickupAt: pickup.toISOString(),
    pickupTime: pickup.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }),
    createdAt: now.toISOString(),
    status: "RECEIVED",
    paymentStatus: "NOT_REQUIRED_TEST",
    history: [{ status: "RECEIVED", at: now.toISOString() }],
  };
}

export function transitionOrder(order, user, nextStatus, pickupCode = "", now = new Date()) {
  if (user?.role !== "canteen" || user.cafeId !== order.cafeId) {
    throw new Error("You can only manage orders for your selected canteen.");
  }
  const index = orderStatuses.indexOf(order.status);
  if (index < 0 || orderStatuses[index + 1] !== nextStatus) throw new Error("This order cannot move to that status.");
  if (nextStatus === "COLLECTED" && pickupCode.trim().toUpperCase() !== orderCode(order)) {
    throw new Error("The pickup code does not match this order.");
  }
  const at = now.toISOString();
  return {
    ...order,
    status: nextStatus,
    history: [...(order.history || []), { status: nextStatus, at }],
    ...(nextStatus === "COLLECTED" ? { pickupVerifiedBy: user.email, collectedAt: at } : {}),
  };
}
