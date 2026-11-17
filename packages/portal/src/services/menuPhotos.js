import { isComboCategory } from '../utils/menuRules.js';
import references from '../data/menuImageReferences.json' with { type: 'json' };
import { menuImageSrc } from './menuImages.js';

export function menuPhoto(item) {
  const reference = references[item.name?.trim().toLowerCase()];
  if (isComboCategory(item.category) && (!item.imageRef || item.imageRef === reference?.replacesImageRef)) return { image: null, illustrative: false };
  // Apply the approved reference set to old placeholder/external links, while
  // preserving later owner uploads and edits without touching stored menu data.
  if (item.imageRef && item.imageRef !== reference?.replacesImageRef) return { image: menuImageSrc(item.imageRef), illustrative: false };
  if (reference) return { image: reference.image, illustrative: true };
  return { image: menuImageSrc(item.imageRef) || '/food-placeholder.svg', illustrative: false };
}
