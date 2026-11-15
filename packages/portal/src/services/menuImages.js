import { bannerImageSrc } from './promotions.js';
export const menuImageSrc = bannerImageSrc;
export async function prepareMenuImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    try { await image.decode(); } catch { throw new Error('This image could not be opened. Choose another photo.'); }
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Choose a smaller image (up to 40 megapixels).');
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable. Please try another browser.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob || blob.size > 4 * 1024 * 1024) throw new Error('Choose a smaller image. The upload limit is 4 MB.');
    return blob;
  } finally { URL.revokeObjectURL(objectUrl); }
}
