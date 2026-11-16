import { useEffect, useRef, useState } from 'react';

export function BrandMark({ className = '' }) {
  return <img src="/brand/spoonate-logo.svg" alt="SpoonAte — Eat, enjoy, repeat" width="410" height="285" className={`brand-mark ${className}`} />;
}

function LoadingAnimation({ onComplete }) {
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [fallback, setFallback] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (fallback) {
      const timer = setTimeout(() => onComplete?.(), 3000);
      return () => clearTimeout(timer);
    }
    if (finished) return;
    void video.current?.play().catch(error => { if (error.name !== 'AbortError') setFallback(true); });
    // A missing or stalled media download must not lock users out of the app.
    const timeout = setTimeout(() => setFallback(true), 20000);
    return () => clearTimeout(timeout);
  }, [fallback, finished, onComplete]);
  return <div className={`loading-animation ${playing && !fallback ? 'is-playing' : ''}`}>
    {fallback && <div className="loading-fallback"><img src="/brand/spoonate-logo.svg" alt="SpoonAte — Eat, enjoy, repeat" width="410" height="285" /></div>}
    {!fallback && <video ref={video} className="loading-film" src="/brand/spoonate-loading-beige-v1.mp4" autoPlay muted playsInline preload="auto" aria-hidden="true" disablePictureInPicture onPlaying={() => setPlaying(true)} onEnded={() => { setFinished(true); onComplete?.(); }} onError={() => setFallback(true)} />}
  </div>;
}

export function BrandSplash({ onComplete }) {
  return <main className="brand-splash" role="status" aria-label="Opening SpoonAte"><LoadingAnimation onComplete={onComplete} /></main>;
}

export function FoodSticker({ className = '' }) {
  return <img src="/brand/campus-snack.webp" alt="" aria-hidden="true" width="240" height="240" decoding="async" className={`food-sticker ${className}`} />;
}

export function MenuLoading() {
  return <div role="status" className="menu-loading"><p className="text-sm font-bold text-gray-600">Loading the menu…</p><div className="menu-skeletons" aria-hidden="true">{[0, 1, 2].map(i => <div key={i}><span /><div><i /><i /></div></div>)}</div></div>;
}
