export const foodImage = '/food-placeholder.svg';
export function mapCatalog(data) {
  const slugs = new Map(data.canteens.map(c => [c.id, c.slug]));
  return {
    cafes: data.canteens.map(c => ({ ...c, databaseId: c.id, id: c.slug,
      status: !c.operational ? 'Closed' : c.acceptingOrders ? 'Open' : 'Paused',
      hours: c.hours || 'Hours not provided',
      categories: data.categories.filter(category => category.canteenId === c.id).map(category => category.name),
      preparationTime: 'Choose pickup time at checkout', image: foodImage })),
    categories: data.categories,
    foods: data.items.map(item => ({ ...item, cafeId: slugs.get(item.canteenId), price: item.pricePaise / 100, image: item.imageRef || foodImage })),
  };
}
export function mapCart(data, cafes) {
  return data.items.map(line => ({ ...line, id: line.menuItemId, lineId: line.id,
    cafeId: cafes.find(c => c.databaseId === line.canteenId)?.id,
    price: line.unitPricePaise / 100, image: line.imageRef || foodImage }));
}
export function rupeesToPaise(value) {
  const text = String(value).trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) throw new Error('Enter a valid price with at most two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (paise > 10000000) throw new Error('Price cannot exceed ₹100,000.');
  return paise;
}
