"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import { useLocalState } from "@/lib/local/hooks";
import { advertisement } from "@/lib/presence";
import { effectiveCategories } from "@/lib/local/device";
import { setIdentity, setServerCategories } from "@/lib/local/store";
import { useSyncDrain } from "@/lib/sync-drain";

/**
 * Headless glue between the local-first store and Convex. Mounted once in
 * the root layout; everything it does is fire-and-forget:
 *
 * - caches the username and the server's categories for offline use
 * - drains the pending queues through sync.push whenever signed in
 * - advertises the running session to the feed (best-effort presence)
 */
export function SyncEngine() {
  const { isAuthenticated } = useConvexAuth();
  const state = useLocalState();
  const me = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const serverCategories = useQuery(api.categories.list, isAuthenticated ? {} : "skip");
  const push = useMutation(api.sync.push);
  const setPresence = useMutation(api.sessions.setPresence);
  const clearPresence = useMutation(api.sessions.clearPresence);

  useEffect(() => {
    if (typeof me === "string") setIdentity(me);
  }, [me]);

  useEffect(() => {
    if (serverCategories !== undefined) setServerCategories(serverCategories);
  }, [serverCategories]);

  // Drain the queues. The loop itself lives in `lib/sync-drain` so it can be
  // driven from a test without a Convex client.
  useSyncDrain({ isAuthenticated, push });

  // Presence: publish on start (and on reconnect mid-session), clear when
  // the session locally stops existing. Absolute timestamps make late
  // delivery harmless, and rows self-expire server-side anyway.
  const running = state.running;
  const prevRunningId = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    if (running) {
      // The guard, not the dependency list, is what keeps one session from
      // being advertised twice — so `state` can be listed honestly.
      if (running.id === prevRunningId.current) return;
      prevRunningId.current = running.id;
      const category =
        running.kind === "work" && running.categoryClientId !== null
          ? (effectiveCategories(state).find((c) => c.clientId === running.categoryClientId) ??
            null)
          : null;
      setPresence(advertisement(running, category)).catch(() => {});
    } else if (prevRunningId.current !== null) {
      prevRunningId.current = null;
      clearPresence().catch(() => {});
    }
  }, [isAuthenticated, running, state, setPresence, clearPresence]);

  return null;
}
