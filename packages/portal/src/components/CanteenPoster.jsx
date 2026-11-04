import { canteenPoster } from '../services/canteenBranding';
export default function CanteenPoster({ slug, name, className = '' }) {
  return <img src={canteenPoster(slug)} alt={`${name || 'Canteen'} poster`} className={`shrink-0 bg-white object-contain ${className}`} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/food-placeholder.svg'; }} />;
}
