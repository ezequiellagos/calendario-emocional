import { useEffect, useRef } from 'react';

export const AUTOMATIC_SYNC_INTERVAL_MS = 60_000;
const AUTOMATIC_SYNC_DEBOUNCE_MS = 2_000;

interface UseAutomaticSyncOptions {
  enabled: boolean;
  isOnline: boolean;
  onSync: () => Promise<void>;
  debounceMs?: number;
}

export function useAutomaticSync({ enabled, isOnline, onSync, debounceMs = AUTOMATIC_SYNC_DEBOUNCE_MS }: UseAutomaticSyncOptions) {
  const timeoutRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const onSyncRef = useRef(onSync);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  async function runSync() {
    if (!enabledRef.current || typeof window === 'undefined' || !window.navigator.onLine) {
      return;
    }

    await onSyncRef.current();
  }

  function scheduleAutomaticSync(immediate = false) {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      void runSync();
    }, immediate ? 0 : debounceMs);
  }

  useEffect(() => {
    if (!enabled || !isOnline) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void runSync();
    }, AUTOMATIC_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, isOnline]);

  useEffect(() => () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  return {
    scheduleAutomaticSync,
  };
}