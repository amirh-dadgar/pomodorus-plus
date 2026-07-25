import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import copy from "../lib/copy.json";

const MINUTE_MS = 60_000;
export const WORK_MINUTES = [25, 55] as const;
const MAX_PRESENCE_MS = 60 * MINUTE_MS;
const CLOCK_SKEW_MS = 5 * MINUTE_MS;

async function requireUserId(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError(copy.errors.signInFirst);
  return userId;
}

/**
 * Advertise the running session to the feed. Best-effort presence, not
 * truth (docs/adr/0001-local-first-timer.md): the row self-expires at
 * startedAt + durationMs, so an offline cancel goes stale for at most one
 * session length. `label` is the category name for public work sessions,
 * null for private tasks and breaks — denormalized here because the server
 * may not know offline-created categories yet.
 */
export const setPresence = mutation({
  args: {
    kind: v.union(v.literal("work"), v.literal("shortBreak"), v.literal("longBreak")),
    label: v.union(v.string(), v.null()),
    startedAt: v.number(),
    durationMs: v.number(),
  },
  handler: async (ctx, { kind, label, startedAt, durationMs }) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    if (
      !Number.isFinite(startedAt) ||
      !Number.isFinite(durationMs) ||
      durationMs <= 0 ||
      durationMs > MAX_PRESENCE_MS ||
      startedAt > now + CLOCK_SKEW_MS
    ) {
      return;
    }
    const trimmed = label === null ? null : label.trim().slice(0, 40) || null;
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const row = { userId, kind, label: trimmed, startedAt, durationMs };
    if (existing) {
      await ctx.db.replace(existing._id, row);
    } else {
      await ctx.db.insert("presence", row);
    }
    // Opportunistic cleanup: long-expired rows from clients that never came
    // back to clear them. The table holds at most one row per active user.
    const all = await ctx.db.query("presence").collect();
    for (const p of all) {
      if (p.startedAt + p.durationMs < now - MINUTE_MS) await ctx.db.delete(p._id);
    }
  },
});

/** Drop the presence row (cancel, skip, or completion seen while online). */
export const clearPresence = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

/** Everyone working or on break right now. Public: also feeds the landing page. */
export const activeFeed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    const rows = await ctx.db.query("presence").take(200);
    const feed = [];
    for (const p of rows) {
      if (p.startedAt + p.durationMs <= now) continue;
      const user = await ctx.db.get(p.userId);
      if (!user?.username) continue;
      feed.push({
        id: p._id,
        username: user.username,
        isMe: p.userId === userId,
        kind: p.kind,
        label: p.kind === "work" ? p.label : null, // null on work = private task
        startedAt: p.startedAt,
        durationMs: p.durationMs,
      });
    }
    feed.sort((a, b) => a.startedAt - b.startedAt);
    return feed;
  },
});

/**
 * No-op stub. The old server-authoritative timer scheduled this at every
 * session's end time; keeping the name prevents pre-migration scheduled
 * jobs from erroring after deploy. Safe to delete once none are pending.
 */
export const finalize = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async () => {},
});
