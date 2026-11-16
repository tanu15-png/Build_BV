import { useEffect, useRef, useState } from 'react';

export function BrandMark({ className = '' }) {
  return <img src="/brand/spoonate-logo.svg" alt="SpoonAte — Eat, enjoy, repeat" width="410" height="285" className={`brand-mark ${className}`} />;
}

function LoadingAnimation({ onComplete }) {
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [fallback, setFallback] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (fallback) {
      const timer = setTimeout(() => onComplete?.(), 3000);
      return () => clearTimeout(timer);
    }
    void video.current?.play().catch(() => setFallback(true));
    // A missing or stalled media download must not lock users out of the app.
    const timeout = setTimeout(() => setFallback(true), 20000);
    return () => clearTimeout(timeout);
  }, [fallback, onComplete]);
  return <div className={`loading-animation ${playing && !fallback ? 'is-playing' : ''}`}>
    <div className="loading-fallback"><BrandMark /><span className="brand-loading-dots" aria-hidden="true"><i /><i /><i /></span></div>
    {!fallback && <video ref={video} className="loading-film" src="/brand/spoonate-loading.mp4" autoPlay muted playsInline preload="auto" aria-hidden="true" disablePictureInPicture onPlaying={() => setPlaying(true)} onEnded={onComplete} onError={() => setFallback(true)} />}
  </div>;
}

export function BrandSplash({ onComplete }) {
  return <main className="brand-splash" role="status" aria-label="Opening SpoonAte"><LoadingAnimation onComplete={onComplete} /></main>;
}

export function FoodSticker({ className = '' }) {
  return <img src="/brand/campus-snack.webp" alt="" aria-hidden="true" width="240" height="240" decoding="async" className={`food-sticker ${className}`} />;
}

export function MenuLoading({ onComplete }) {
  return <div role="status" className="menu-loading"><div className="menu-loading-animation"><LoadingAnimation onComplete={onComplete} /></div><p className="mt-3 text-center text-sm font-bold">Loading the menu…</p><div className="menu-skeletons" aria-hidden="true">{[0, 1, 2].map(i => <div key={i}><span /><div><i /><i /></div></div>)}</div></div>;
}
