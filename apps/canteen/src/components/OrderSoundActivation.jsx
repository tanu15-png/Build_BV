import { useEffect } from 'react';
import { unlockOrderSound } from '@spoonate/portal/services/orderSound';

export default function OrderSoundActivation() {
  useEffect(() => {
    window.addEventListener('pointerdown', unlockOrderSound, true);
    window.addEventListener('keydown', unlockOrderSound, true);
    return () => {
      window.removeEventListener('pointerdown', unlockOrderSound, true);
      window.removeEventListener('keydown', unlockOrderSound, true);
    };
  }, []);
  return null;
}
