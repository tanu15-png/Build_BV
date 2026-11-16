import { canteenPoster } from '../services/canteenBranding';
export default function CanteenPoster({ className = '' }) {
  return <img src={canteenPoster()} alt="Shanu's Canteen" className={`shrink-0 rounded-lg bg-[#191919] object-contain ${className}`} />;
}
