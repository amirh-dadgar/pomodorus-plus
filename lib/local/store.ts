// localStorage-backed store for the local-first timer. One state blob per
// username so switching accounts on a device never mixes queues; the blob
// survives sign-out, which is what lets unsynced focus time outlive an
// expired auth token. Tabs stay consistent via the `storage` event.

import copy from "../copy.json";
import {
  type CategoryOp,
  type Category,
  type LocalState,
  type PendingSession,
  type ServerCategory,
  EMPTY_STATE,
  IDLE_RESET_MS,
  LONG_BREAK_MS,
  MINUTE_MS,
  SESSIONS_PER_CYCLE,
  SHORT_BREAK_MS,
  WORK_MINUTES,
  endAt,
} from "./types";

const IDENTITY_KEY = "pomodorus:user";
const stateKey = (username: string) => `pomodorus:v1:${username}`;

let cachedIdentity: string | null | undefined; // undefined = not loaded yet
let cachedState: LocalState = EMPTY_STATE;
let cachedStateKey: string | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function loadIdentity(): string | null {
  if (typeof window === "undefined") return null;
  if (cachedIdentity === undefined) {
    cachedIdentity = window.localStorage.getItem(IDENTITY_KEY);
  }
  return cachedIdentity;
}

function loadState(): LocalState {
  if (typeof window === "undefined") return EMPTY_STATE;
  const username = loadIdentity();
  const key = username === null ? null : stateKey(username);
  if (key === cachedStateKey) return cachedState;
  cachedStateKey = key;
  cachedState = EMPTY_STATE;
  if (key !== null) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) cachedState = { ...EMPTY_STATE, ...(JSON.parse(raw) as LocalState) };
    } catch {
      // Corrupt blob: start fresh rather than brick the app.
    }
  }
  return cachedState;
}

function write(next: LocalState) {
  cachedState = next;
  if (cachedStateKey !== null) {
    window.localStorage.setItem(cachedStateKey, JSON.stringify(next));
  }
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function onStorage(e: StorageEvent) {
  if (e.key === IDENTITY_KEY) cachedIdentity = undefined;
  if (e.key === IDENTITY_KEY || e.key === cachedStateKey) {
    cachedStateKey = null; // force reload from storage
    emit();
  }
}

export function getIdentity(): string | null {
  return loadIdentity();
}

export function getState(): LocalState {
  return loadState();
}

export function setIdentity(username: string) {
  if (loadIdentity() === username) return;
  window.localStorage.setItem(IDENTITY_KEY, username);
  cachedIdentity = username;
  cachedStateKey = null;
  emit();
}

/**
 * Finalize everything whose end time has passed — including whole chains
 * that elapsed while the app was closed: work completes retroactively at
 * its exact end time, its break auto-starts from that moment, and the
 * break may itself already be over. Returns the state unchanged (same
 * reference) when nothing was due.
 */
export function settled(state: LocalState, now: number): LocalState {
  let s = state;
  while (s.running && endAt(s.running) <= now) {
    const running = s.running;
    const end = endAt(running);
    if (running.kind === "work") {
      const completed: PendingSession = {
        clientId: running.id,
        ...(running.categoryClientId !== null
          ? { categoryClientId: running.categoryClientId }
          : {}),
        startedAt: running.startedAt,
        durationMs: running.durationMs,
        endedAt: end,
        ...(running.devFast ? { devFast: true } : {}),
      };
      const cycleCount = s.cycleCount + 1;
      const isLong = cycleCount >= SESSIONS_PER_CYCLE;
      s = {
        ...s,
        running: {
          id: crypto.randomUUID(),
          kind: isLong ? "longBreak" : "shortBreak",
          categoryClientId: null,
          startedAt: end,
          durationMs: isLong ? LONG_BREAK_MS : SHORT_BREAK_MS,
          ...(running.devFast ? { devFast: true } : {}),
        },
        cycleCount,
        lastActivityAt: end,
        lastEnded: { id: running.id, kind: "work", at: end },
        pendingSessions: [...s.pendingSessions, completed],
      };
    } else {
      s = {
        ...s,
        running: null,
        cycleCount: running.kind === "longBreak" ? 0 : s.cycleCount,
        lastActivityAt: end,
        lastEnded: { id: running.id, kind: running.kind, at: end },
      };
    }
  }
  return s;
}

/** Settle now; called on a short interval while the app is open. */
export function tick() {
  const state = loadState();
  const next = settled(state, Date.now());
  if (next !== state) write(next);
}

export function startWork(categoryClientId: string, minutes: number, fast: boolean) {
  if (!WORK_MINUTES.includes(minutes as (typeof WORK_MINUTES)[number])) {
    throw new Error(copy.errors.badDuration);
  }
  const now = Date.now();
  let s = settled(loadState(), now);
  if (s.running) throw new Error(copy.errors.alreadyRunning);
  if (s.cycleCount > 0 && now - s.lastActivityAt > IDLE_RESET_MS) {
    s = { ...s, cycleCount: 0 };
  }
  write({
    ...s,
    running: {
      id: crypto.randomUUID(),
      kind: "work",
      categoryClientId,
      startedAt: now,
      durationMs: minutes * MINUTE_MS,
      ...(fast ? { devFast: true } : {}),
    },
  });
}

/** Cancel the running work session. It counts for nothing. */
export function cancelWork() {
  const s = settled(loadState(), Date.now());
  if (!s.running || s.running.kind !== "work") {
    throw new Error(copy.errors.nothingRunning);
  }
  write({ ...s, running: null });
}

/** Skip the running break and become idle immediately. */
export function skipBreak() {
  const s = settled(loadState(), Date.now());
  if (!s.running || s.running.kind === "work") {
    throw new Error(copy.errors.noBreakRunning);
  }
  write({
    ...s,
    running: null,
    cycleCount: s.running.kind === "longBreak" ? 0 : s.cycleCount,
    lastActivityAt: Date.now(),
  });
}

// ---- Categories: the server cache with pending local ops applied on top ----

/**
 * Coerce whatever a server (or an old persisted cache) handed us into rows
 * that are safe to key by clientId. Born of a real incident: a stale
 * backend without clientId in its list response collapsed every category
 * onto the single key `undefined`, leaving one visible. Rows fall back to
 * their Convex _id; rows with no usable key or name are dropped.
 */
export function normalizeServerCategories(rows: readonly unknown[]): ServerCategory[] {
  const out: ServerCategory[] = [];
  for (const value of rows) {
    if (typeof value !== "object" || value === null) continue;
    const row = value as Record<string, unknown>;
    const clientId =
      typeof row.clientId === "string"
        ? row.clientId
        : typeof row._id === "string"
          ? row._id
          : null;
    if (clientId === null || typeof row.name !== "string") continue;
    out.push({
      clientId,
      name: row.name,
      isPublic: row.isPublic !== false,
      updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : 0,
    });
  }
  return out;
}

export function effectiveCategories(state: LocalState): Category[] {
  const byId = new Map<string, Category>();
  // Normalized again on read so a bad cache persisted by an old build
  // still renders correctly, not just future writes.
  for (const c of normalizeServerCategories(state.serverCategories)) byId.set(c.clientId, c);
  for (const op of state.pendingCategoryOps) {
    const existing = byId.get(op.clientId);
    if (existing && existing.updatedAt > op.at) continue; // server already newer
    if (op.op === "delete") {
      byId.delete(op.clientId);
    } else {
      byId.set(op.clientId, {
        clientId: op.clientId,
        name: op.name ?? existing?.name ?? "",
        isPublic: op.isPublic ?? existing?.isPublic ?? true,
        updatedAt: op.at,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

function pushOp(s: LocalState, op: CategoryOp): LocalState {
  // One pending op per category: a later edit replaces the queued one.
  return {
    ...s,
    pendingCategoryOps: [
      ...s.pendingCategoryOps.filter((o) => o.clientId !== op.clientId),
      op,
    ],
  };
}

function requireIdle(s: LocalState, clientId: string) {
  if (s.running?.kind === "work" && s.running.categoryClientId === clientId) {
    throw new Error(copy.errors.categoryBusy);
  }
}

export function createCategory(name: string, isPublic: boolean): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    throw new Error(copy.errors.categoryNameLength);
  }
  const clientId = crypto.randomUUID();
  write(
    pushOp(loadState(), { clientId, op: "upsert", name: trimmed, isPublic, at: Date.now() }),
  );
  return clientId;
}

export function updateCategory(clientId: string, name: string, isPublic: boolean) {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 40) {
    throw new Error(copy.errors.categoryNameLength);
  }
  const s = loadState();
  requireIdle(s, clientId);
  write(pushOp(s, { clientId, op: "upsert", name: trimmed, isPublic, at: Date.now() }));
}

export function deleteCategory(clientId: string) {
  const s = loadState();
  requireIdle(s, clientId);
  write(pushOp(s, { clientId, op: "delete", at: Date.now() }));
}

// ---- Sync bookkeeping ----

/** Refresh the cached server mirror (from the live categories query). */
export function setServerCategories(rows: readonly unknown[]) {
  const categories = normalizeServerCategories(rows);
  const s = loadState();
  // Cheap deep-equality check keeps reconnect churn from thrashing storage.
  if (JSON.stringify(s.serverCategories) === JSON.stringify(categories)) return;
  write({ ...s, serverCategories: categories });
}

/** Clear exactly what a successful sync.push delivered; later edits survive. */
export function markSynced(sessions: PendingSession[], ops: CategoryOp[]) {
  const sessionIds = new Set(sessions.map((x) => x.clientId));
  const opKeys = new Set(ops.map((o) => `${o.clientId}:${o.at}`));
  const s = loadState();
  write({
    ...s,
    pendingSessions: s.pendingSessions.filter((x) => !sessionIds.has(x.clientId)),
    pendingCategoryOps: s.pendingCategoryOps.filter((o) => !opKeys.has(`${o.clientId}:${o.at}`)),
  });
}
