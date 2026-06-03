"use client";

import { useEffect, useSyncExternalStore } from "react";

let hydrated = false;
const hydrationListeners = new Set<() => void>();

function subscribeHydration(listener: () => void) {
  hydrationListeners.add(listener);
  return () => hydrationListeners.delete(listener);
}

function getHydrationSnapshot() {
  return hydrated;
}

function getHydrationServerSnapshot() {
  return false;
}

function markHydrated() {
  if (hydrated) return;
  hydrated = true;
  hydrationListeners.forEach((listener) => listener());
}

export function useHydrated() {
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    getHydrationSnapshot,
    getHydrationServerSnapshot,
  );

  useEffect(() => {
    markHydrated();
  }, []);

  return isHydrated;
}
