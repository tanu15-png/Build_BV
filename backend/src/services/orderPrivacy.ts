// Responses may include nested orders, conflict details, or previously saved replay bodies.
export function withoutCustomerNames(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutCustomerNames);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'studentName').map(([key, item]) => [key, withoutCustomerNames(item)]));
}
