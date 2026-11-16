import { ChefHat } from 'lucide-react';
import { useState } from 'react';

export function BrandMark({ className = '' }) {
  return <span className={`brand-mark ${className}`}><ChefHat aria-hidden="true" /><span>Spoon<span className="brand-accent">Ate</span></span></span>;
}

function LoadingAnimation() {
  const [playing, setPlaying] = useState(false);
  return <div className={`loading-animation ${playing ? 'is-playing' : ''}`}>
    <div className="loading-fallback"><BrandMark /><span className="brand-loading-dots" aria-hidden="true"><i /><i /><i /></span></div>
    <video className="loading-film" src="/brand/spoonate-loading.mp4" autoPlay muted loop playsInline preload="auto" aria-hidden="true" disablePictureInPicture onPlaying={() => setPlaying(true)} onError={() => setPlaying(false)} />
  </div>;
}

export function BrandSplash() {
  return <main className="brand-splash" role="status" aria-label="Opening SpoonAte"><LoadingAnimation /></main>;
}

export function FoodSticker({ className = '' }) {
  return <img src="/brand/campus-snack.webp" alt="" aria-hidden="true" width="240" height="240" decoding="async" className={`food-sticker ${className}`} />;
}

export function MenuLoading() {
  return <div role="status" className="menu-loading"><div className="menu-loading-animation"><LoadingAnimation /></div><p className="mt-3 text-center text-sm font-bold">Loading the menu…</p><div className="menu-skeletons" aria-hidden="true">{[0, 1, 2].map(i => <div key={i}><span /><div><i /><i /></div></div>)}</div></div>;
}
