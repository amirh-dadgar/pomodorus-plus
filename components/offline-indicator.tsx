"use client";

import { copy } from "@/lib/copy";
import { useLocalState, useOnline } from "@/lib/local/hooks";

/**
 * The subtle sync marker: one quiet line when offline, one while queued
 * work is still syncing. Silence means everything is on the server.
 */
export function OfflineIndicator() {
  const online = useOnline();
  const state = useLocalState();
  const pending = state.pendingSessions.length + state.pendingCategoryOps.length;

  const text = !online
    ? copy.offline.indicator
    : pending > 0
      ? copy.offline.syncing
      : null;
  if (text === null) return null;

  return (
    <p className="pt-8 text-center text-xs text-muted-foreground" role="status">
      {text}
    </p>
  );
}
