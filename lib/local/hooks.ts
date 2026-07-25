"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { EMPTY_STATE, type LocalState } from "./types";
import * as store from "./store";

/** The cached username, or null when this device has never signed in. */
export function useLocalIdentity(): string | null {
  return useSyncExternalStore(store.subscribe, store.getIdentity, () => null);
}

export function useLocalState(): LocalState {
  return useSyncExternalStore(store.subscribe, store.getState, () => EMPTY_STATE);
}

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * A ~2Hz clock that also settles due sessions each beat, so countdowns and
 * retroactive completions work with no server involved.
 */
export function useTimerNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    store.tick();
    const timer = setInterval(() => {
      setNow(Date.now());
      store.tick();
    }, 500);
    return () => clearInterval(timer);
  }, []);
  return now;
}
