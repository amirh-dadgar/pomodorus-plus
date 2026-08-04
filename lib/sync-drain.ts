"use client";

// The loop that empties the pending queues, apart from the Convex wiring that
// feeds it (`components/sync-engine`).
//
// It is separated for one reason: this is the only place where losing a device's
// work is still possible after ADR 0006, and it is lost by *stalling* rather
// than by deleting — a queue nobody retries is a queue that never arrives. The
// stalls are all timing, so the loop takes `push` as an argument and can be
// driven from a test with a promise the test resolves itself.

import { useEffect, useRef, useState } from "react";
import { useLocalState, useOnline } from "./local/hooks";
import { markSynced } from "./local/store";
import type { CategoryOp, PendingSession } from "./local/types";

/** What a successful push reports back: the items the device may forget. */
export type Ack = { sessions: string[]; categoryOps: string[] };

export type Push = (args: {
  sessions: PendingSession[];
  categoryOps: CategoryOp[];
}) => Promise<Ack>;

/** How long a failed or wholly unacknowledged push waits before trying again. */
export const RETRY_MS = 15_000;

/**
 * Drain the queues, one push at a time, until the server has acknowledged
 * everything.
 *
 * Three things have to be true for work to be certain of arriving, and each
 * one is a way this has gone wrong:
 *
 * - **Only one push in flight.** Two concurrent pushes of the same queue are
 *   safe on the server (sessions dedupe by clientId) but waste a round trip.
 * - **Nothing asked for is forgotten.** A push wanted while another was in
 *   flight used to be dropped, and the loop then sat idle until something
 *   unrelated changed the queue. That includes the re-render caused by this
 *   loop's own `markSynced`, which can land before the in-flight push has
 *   finished settling.
 * - **Something always wakes it up.** A partial ack shrinks the queue and
 *   re-runs the effect; an ack that names nothing changes no state, so it
 *   needs a timer, as does a push that failed outright.
 */
export function useSyncDrain({
  isAuthenticated,
  push,
}: {
  isAuthenticated: boolean;
  push: Push;
}) {
  const state = useLocalState();
  const online = useOnline();
  const busy = useRef(false);
  const missed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retry, setRetry] = useState(0);
  const { pendingSessions, pendingCategoryOps } = state;

  useEffect(() => {
    if (!isAuthenticated) return;
    if (pendingSessions.length === 0 && pendingCategoryOps.length === 0) return;
    if (busy.current) {
      missed.current = true;
      return;
    }

    // One armed retry at a time, so a queue that changes while we are waiting
    // does not stack up a push per change.
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
        if (ack.sessions.length === 0 && ack.categoryOps.length === 0) later();
      })
      .catch(later)
      .finally(() => {
        busy.current = false;
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
}
