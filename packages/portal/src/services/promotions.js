import { apiBase } from '../portal.js';

export const bannerImageSrc = ref => ref?.startsWith('/banners/images/') ? `${apiBase}${ref}` : ref;
export function bannerHref(banner) {
  if (banner.targetType === 'item' && banner.targetId) return `/dashboard?item=${encodeURIComponent(banner.targetId)}#cafes`;
  if (banner.targetType === 'category' && banner.targetId) return `/dashboard?category=${encodeURIComponent(banner.targetId)}#cafes`;
  if (banner.targetType === 'menu') return '/dashboard#cafes';
  return `/dashboard/specials/${banner.id}`;
}
export const bannerBody = banner => ({
  title:banner.title, description:banner.description, imageRef:banner.imageRef, active:banner.active,
  targetType:banner.targetType, targetId:banner.targetId,
  offerIds:(banner.offers||[]).map(link=>link.offerId), offers:[],
  itemIds:banner.items.map(item=>item.menuItemId), startsAt:banner.startsAt, endsAt:banner.endsAt, expectedVersion:banner.version,
});
