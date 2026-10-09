import { useEffect, useRef } from 'react';
import { safeStorage } from '@hms/ui';

const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
const SHARED_KEY = 'hms:lastActivity';

/**
 * Calls `onIdle` after `minutes` without keyboard, mouse or touch input. Activity in another tab
 * of the app counts too (shared through localStorage), so a second tab does not sign you out.
 */
export function useIdleTimeout({ minutes, onIdle, enabled = true, checkEveryMs = 15000 }) {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  });

  useEffect(() => {
    if (!enabled || !minutes) return undefined;
    const limit = minutes * 60 * 1000;
    let last = Date.now();
    let lastShared = 0;
    let fired = false;

    const activity = () => {
      last = Date.now();
      if (last - lastShared > 5000) {
        lastShared = last;
        safeStorage.set(SHARED_KEY, last);
      }
    };
    const check = () => {
      if (fired) return;
      const shared = Number(safeStorage.get(SHARED_KEY, 0)) || 0;
      if (Date.now() - Math.max(last, shared) >= limit) {
        fired = true;
        onIdleRef.current?.();
      }
    };

    activity();
    for (const ev of EVENTS) window.addEventListener(ev, activity, { passive: true });
    document.addEventListener('visibilitychange', check);
    const interval = setInterval(check, Math.min(checkEveryMs, limit));
    return () => {
      for (const ev of EVENTS) window.removeEventListener(ev, activity);
      document.removeEventListener('visibilitychange', check);
      clearInterval(interval);
    };
  }, [minutes, enabled, checkEveryMs]);
}
