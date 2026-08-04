"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useLocalState, useOnline } from "@/lib/local/hooks";
import { advertisement } from "@/lib/presence";
import { effectiveCategories } from "@/lib/local/device";
import { markSynced, setIdentity, setServerCategories } from "@/lib/local/store";

const RETRY_MS = 15_000;

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

  // Drain the queues. The busy flag serializes pushes; `missed` remembers that
  // something wanted one while a push was in flight, so the drain always gets
  // a fresh attempt rather than waiting on the next thing to happen to change
  // the queue. A failed or unacknowledged push retries after a pause, and
  // regaining connectivity retries immediately.
  const busy = useRef(false);
  const missed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retry, setRetry] = useState(0);
  const online = useOnline();
  const { pendingSessions, pendingCategoryOps } = state;
  useEffect(() => {
    if (!isAuthenticated) return;
    if (pendingSessions.length === 0 && pendingCategoryOps.length === 0) return;
    if (busy.current) {
      missed.current = true;
      return;
    }
    // One pending retry at a time: a queue that changes while a timer is
    // armed should not stack up a push per change.
    const later = () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        setRetry((r) => r + 1);
      }, RETRY_MS);
    };

    busy.current = true;
    missed.current = false;
    push({ sessions: pendingSessions, categoryOps: pendingCategoryOps })
      .then((ack) => {
        // Clear what the server acknowledged, never what we happened to send:
        // anything it could not store yet — a batch past the cap, a session
        // dated ahead of the server's clock — stays queued for the next round.
        markSynced(ack.sessions, ack.categoryOps);
        // A partial ack shrinks the queue, which re-runs this effect on its
        // own. An ack that names nothing changes no state, so nothing would
        // wake us up; that case needs the timer.
        if (ack.sessions.length === 0 && ack.categoryOps.length === 0) later();
      })
      .catch(later)
      .finally(() => {
        busy.current = false;
        // Whatever asked for a push while we were busy — including a re-render
        // triggered by our own `markSynced`, which can land before this runs —
        // is owed one now.
        if (missed.current) {
          missed.current = false;
          setRetry((r) => r + 1);
        }
      });
  }, [isAuthenticated, online, pendingSessions, pendingCategoryOps, retry, push]);

  // Never leave a retry armed against an unmounted engine.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

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
