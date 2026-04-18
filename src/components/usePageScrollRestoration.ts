'use client';

import { useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'page-scroll:';
const MAX_RESTORE_ATTEMPTS = 12;
const RESTORE_RETRY_MS = 140;

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function usePageScrollRestoration(key: string | null, ready = true) {
  const restoredRef = useRef(false);

  useEffect(() => {
    restoredRef.current = false;
  }, [key]);

  useEffect(() => {
    if (!key || typeof window === 'undefined') return;

    const storageKey = getStorageKey(key);
    let frameId: number | null = null;

    const saveScrollPosition = () => {
      try {
        window.sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        // Ignore storage failures.
      }
    };

    const scheduleSave = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        saveScrollPosition();
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition();
      }
    };

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    window.addEventListener('scroll', scheduleSave, { passive: true });
    window.addEventListener('pagehide', saveScrollPosition);
    window.addEventListener('beforeunload', saveScrollPosition);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      saveScrollPosition();
      window.removeEventListener('scroll', scheduleSave);
      window.removeEventListener('pagehide', saveScrollPosition);
      window.removeEventListener('beforeunload', saveScrollPosition);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [key]);

  useEffect(() => {
    if (!key || !ready || typeof window === 'undefined' || restoredRef.current) return;
    if (window.location.hash) return;

    const storageKey = getStorageKey(key);
    const savedValue = window.sessionStorage.getItem(storageKey);
    if (!savedValue) {
      restoredRef.current = true;
      return;
    }

    const targetY = Number.parseFloat(savedValue);
    if (!Number.isFinite(targetY) || targetY <= 0) {
      restoredRef.current = true;
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    let attempts = 0;

    const restore = () => {
      if (cancelled) return;
      attempts += 1;

      const maxScrollY = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);
      const nextTargetY = Math.min(targetY, maxScrollY);
      window.scrollTo({ top: nextTargetY, left: 0, behavior: 'auto' });

      if (Math.abs(window.scrollY - nextTargetY) <= 4 || attempts >= MAX_RESTORE_ATTEMPTS) {
        restoredRef.current = true;
        return;
      }

      timeoutId = window.setTimeout(() => {
        window.requestAnimationFrame(restore);
      }, RESTORE_RETRY_MS);
    };

    window.requestAnimationFrame(restore);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [key, ready]);
}
