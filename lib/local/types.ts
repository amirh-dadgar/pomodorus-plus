// The local-first timer's state (docs/adr/0001-local-first-timer.md): the
// device owns the running session; everything here lives in localStorage,
// keyed by username, and the pending* queues drain to Convex on sync.

export type SessionKind = "work" | "shortBreak" | "longBreak";

export type RunningSession = {
  id: string; // client-minted uuid; becomes the log row's clientId
  kind: SessionKind;
  categoryClientId: string | null; // null on breaks
  startedAt: number;
  durationMs: number; // nominal; a devFast session really ends after 3s
  devFast?: boolean;
};

/** A completed work session waiting to be reported to the server. */
export type PendingSession = {
  clientId: string;
  categoryClientId?: string;
  startedAt: number;
  durationMs: number;
  endedAt: number;
  devFast?: boolean;
};

/** A category edit waiting to be reported. One op per category: later edits replace earlier ones. */
export type CategoryOp = {
  clientId: string;
  op: "upsert" | "delete";
  name?: string;
  isPublic?: boolean;
  at: number; // edit timestamp, for last-write-wins on the server
};

/** The server's view of a category, cached for offline use. */
export type ServerCategory = {
  clientId: string;
  name: string;
  isPublic: boolean;
  updatedAt: number;
};

/** ServerCategory with pending local ops applied on top. */
export type Category = ServerCategory;

export type LocalState = {
  running: RunningSession | null;
  cycleCount: number;
  // Last time a session/break ended — drives the 1h idle cycle reset.
  lastActivityAt: number;
  // Latest naturally-completed session; the UI notifies when this changes.
  lastEnded: { id: string; kind: SessionKind; at: number } | null;
  pendingSessions: PendingSession[];
  pendingCategoryOps: CategoryOp[];
  serverCategories: ServerCategory[];
};

export const EMPTY_STATE: LocalState = {
  running: null,
  cycleCount: 0,
  lastActivityAt: 0,
  lastEnded: null,
  pendingSessions: [],
  pendingCategoryOps: [],
  serverCategories: [],
};

export const MINUTE_MS = 60_000;
export const WORK_MINUTES = [25, 55] as const;
export const SHORT_BREAK_MS = 5 * MINUTE_MS;
export const LONG_BREAK_MS = 20 * MINUTE_MS;
export const SESSIONS_PER_CYCLE = 4;
export const IDLE_RESET_MS = 60 * MINUTE_MS;
// Dev-only fast sessions: credited at nominal duration, really end after this.
export const FAST_MS = 3_000;

/** The wall-clock moment a running session actually ends. */
export function endAt(running: RunningSession): number {
  return running.startedAt + (running.devFast ? FAST_MS : running.durationMs);
}
