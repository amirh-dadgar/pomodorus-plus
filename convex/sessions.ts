import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import copy from "../lib/copy.json";

const MINUTE_MS = 60_000;
export const WORK_MINUTES = [25, 55] as const;
const SHORT_BREAK_MS = 5 * MINUTE_MS;
const LONG_BREAK_MS = 20 * MINUTE_MS;
const SESSIONS_PER_CYCLE = 4;
const IDLE_RESET_MS = 60 * MINUTE_MS;

// Dev-only fast sessions: stored/credited at their nominal duration, but the
// finalize job fires after this instead. Gated by the DEV_FAST_POMODORO env
// var on the deployment so production rejects it.
const FAST_MS = 3_000;
const fastAllowed = () => process.env.DEV_FAST_POMODORO !== undefined;

// Day bucket in Asia/Tehran (fixed UTC+3:30, Iran abolished DST in 2022).
const TEHRAN_OFFSET_MS = 3.5 * 60 * MINUTE_MS;
function tehranDayKey(ts: number): string {
  return new Date(ts + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}

async function requireUserId(ctx: { auth: MutationCtx["auth"] }) {
  const userId = await getAuthUserId(ctx as MutationCtx);
  if (userId === null) throw new ConvexError(copy.errors.signInFirst);
  return userId;
}

async function getRunning(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("sessions")
    .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "running"))
    .unique();
}

async function getStats(ctx: MutationCtx, userId: Id<"users">) {
  const stats = await ctx.db
    .query("userStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (stats) return stats;
  const id = await ctx.db.insert("userStats", {
    userId,
    cycleCount: 0,
    lastActivityAt: 0,
  });
  return (await ctx.db.get(id))!;
}

/** Start a work session on a category (25 or 55 minutes; dev `fast` runs in 3s). */
export const startWork = mutation({
  args: {
    categoryId: v.id("categories"),
    minutes: v.number(),
    fast: v.optional(v.boolean()),
  },
  handler: async (ctx, { categoryId, minutes, fast }) => {
    const userId = await requireUserId(ctx);
    if (!WORK_MINUTES.includes(minutes as (typeof WORK_MINUTES)[number])) {
      throw new ConvexError(copy.errors.badDuration);
    }
    if (fast && !fastAllowed()) {
      throw new ConvexError(copy.errors.fastNotAllowed);
    }
    const category = await ctx.db.get(categoryId);
    if (!category || category.userId !== userId) {
      throw new ConvexError(copy.errors.categoryNotFound);
    }
    if (await getRunning(ctx, userId)) {
      throw new ConvexError(copy.errors.alreadyRunning);
    }

    const now = Date.now();
    const stats = await getStats(ctx, userId);
    if (stats.cycleCount > 0 && now - stats.lastActivityAt > IDLE_RESET_MS) {
      await ctx.db.patch(stats._id, { cycleCount: 0 });
    }

    const durationMs = minutes * MINUTE_MS;
    const sessionId = await ctx.db.insert("sessions", {
      userId,
      kind: "work",
      categoryId,
      startedAt: now,
      durationMs,
      status: "running",
      ...(fast ? { devFast: true } : {}),
    });
    await ctx.scheduler.runAfter(fast ? FAST_MS : durationMs, internal.sessions.finalize, {
      sessionId,
    });
  },
});

/** Cancel the running work session. It counts for nothing. */
export const cancelWork = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const running = await getRunning(ctx, userId);
    if (!running || running.kind !== "work") {
      throw new ConvexError(copy.errors.nothingRunning);
    }
    await ctx.db.patch(running._id, { status: "canceled" });
  },
});

/** Skip the running break and become idle immediately. */
export const skipBreak = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const running = await getRunning(ctx, userId);
    if (!running || running.kind === "work") {
      throw new ConvexError(copy.errors.noBreakRunning);
    }
    await ctx.db.patch(running._id, { status: "skipped" });
    const stats = await getStats(ctx, userId);
    await ctx.db.patch(stats._id, {
      cycleCount: running.kind === "longBreak" ? 0 : stats.cycleCount,
      lastActivityAt: Date.now(),
    });
  },
});

/**
 * Scheduled at session start for exactly its end time; the timer is fully
 * server-side so sessions complete even with no tab open. No-ops if the
 * session was canceled/skipped meanwhile.
 */
export const finalize = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.status !== "running") return;
    const now = Date.now();
    await ctx.db.patch(sessionId, { status: "completed", endedAt: now });
    const stats = await getStats(ctx, session.userId);

    if (session.kind === "work") {
      const dayKey = tehranDayKey(session.startedAt + session.durationMs);
      const day = await ctx.db
        .query("dailyStats")
        .withIndex("by_user_day", (q) => q.eq("userId", session.userId).eq("dayKey", dayKey))
        .unique();
      if (day) {
        await ctx.db.patch(day._id, {
          totalMs: day.totalMs + session.durationMs,
          sessionCount: day.sessionCount + 1,
        });
      } else {
        await ctx.db.insert("dailyStats", {
          userId: session.userId,
          dayKey,
          totalMs: session.durationMs,
          sessionCount: 1,
        });
      }

      const cycleCount = stats.cycleCount + 1;
      await ctx.db.patch(stats._id, { cycleCount, lastActivityAt: now });

      // Auto-start the break (skippable from the UI). A fast session's break
      // is fast too, so the whole cycle can be tested in seconds.
      const fast = session.devFast === true && fastAllowed();
      const isLong = cycleCount >= SESSIONS_PER_CYCLE;
      const durationMs = isLong ? LONG_BREAK_MS : SHORT_BREAK_MS;
      const breakId = await ctx.db.insert("sessions", {
        userId: session.userId,
        kind: isLong ? "longBreak" : "shortBreak",
        startedAt: now,
        durationMs,
        status: "running",
        ...(fast ? { devFast: true } : {}),
      });
      await ctx.scheduler.runAfter(fast ? FAST_MS : durationMs, internal.sessions.finalize, {
        sessionId: breakId,
      });
    } else {
      await ctx.db.patch(stats._id, {
        cycleCount: session.kind === "longBreak" ? 0 : stats.cycleCount,
        lastActivityAt: now,
      });
    }
  },
});

/** The signed-in user's live state: running session, cycle count, today's totals. */
export const myState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const running = await ctx.db
      .query("sessions")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "running"))
      .unique();
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const today = await ctx.db
      .query("dailyStats")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("dayKey", tehranDayKey(Date.now())))
      .unique();
    let category: Doc<"categories"> | null = null;
    if (running?.categoryId) category = await ctx.db.get(running.categoryId);
    // Latest naturally-completed session (per-user sessions are sequential,
    // so creation order matches completion order). The client notifies and
    // plays a sound when this changes.
    const lastCompleted = await ctx.db
      .query("sessions")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "completed"))
      .order("desc")
      .first();
    return {
      lastEnded: lastCompleted
        ? {
            id: lastCompleted._id,
            kind: lastCompleted.kind,
            at: lastCompleted.endedAt ?? lastCompleted.startedAt + lastCompleted.durationMs,
          }
        : null,
      running: running
        ? {
            id: running._id,
            kind: running.kind,
            startedAt: running.startedAt,
            durationMs: running.durationMs,
            categoryName: category?.name ?? null,
          }
        : null,
      cycleCount: stats?.cycleCount ?? 0,
      todayMs: today?.totalMs ?? 0,
      todayCount: today?.sessionCount ?? 0,
    };
  },
});

/** Everyone working or on break right now. Public: also feeds the landing page. */
export const activeFeed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const running = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(200);
    const feed = [];
    for (const session of running) {
      const user = await ctx.db.get(session.userId);
      if (!user?.username) continue;
      let label: string | null = null;
      if (session.kind === "work") {
        const category = session.categoryId ? await ctx.db.get(session.categoryId) : null;
        label = category?.isPublic ? category.name : null;
      }
      feed.push({
        id: session._id,
        username: user.username,
        isMe: session.userId === userId,
        kind: session.kind,
        label, // null on work = private task
        startedAt: session.startedAt,
        durationMs: session.durationMs,
      });
    }
    feed.sort((a, b) => a.startedAt - b.startedAt);
    return feed;
  },
});
