import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // authTables.users minus `name`, plus `username`: the unique, immutable
  // public handle shown in the feed and used in profile URLs (/u/[username]),
  // and since the move to username-only login the login credential too.
  users: defineTable({
    image: v.optional(v.string()),
    // Legacy: email was the login identifier before `convex/auth.ts` moved to
    // usernames. Nothing writes these any more and `migrations:usernameLogin`
    // clears them; the field and its index stay only because the auth library
    // still reads them on account-linking paths this app never takes. Safe to
    // delete once the migration has run on every deployment.
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    username: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_username", ["username"]),

  categories: defineTable({
    userId: v.id("users"),
    name: v.string(),
    isPublic: v.boolean(),
    // Client-minted id (uuid) so devices can reference categories they
    // created offline. Absent on rows created before the local-first move;
    // those are addressed by their Convex _id instead.
    clientId: v.optional(v.string()),
    // Client timestamp of the last accepted edit — last-write-wins on sync.
    updatedAt: v.optional(v.number()),
    // Tombstone instead of a hard delete so a delete on one device beats a
    // rename queued on another. The tombstone keeps its name and session rows
    // keep pointing at it, so deleting a category never erases past focus time.
    deleted: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_client", ["userId", "clientId"]),

  // Append-only log of completed sessions, reported by devices on sync
  // (see docs/adr/0001-local-first-timer.md). Only completed work sessions
  // are synced; `running` rows and break rows are pre-migration data.
  sessions: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("work"), v.literal("shortBreak"), v.literal("longBreak")),
    categoryId: v.optional(v.id("categories")),
    startedAt: v.number(),
    durationMs: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("canceled"),
      v.literal("skipped"),
    ),
    // Dev-only fast session: credited at the nominal duration above but
    // actually finished in seconds.
    devFast: v.optional(v.boolean()),
    endedAt: v.optional(v.number()),
    // Client-minted id (uuid); makes sync retries idempotent.
    clientId: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_client", ["userId", "clientId"]),

  // Best-effort "who's working right now" advertisements for the feed.
  // One row per user, upserted when an online client starts a session,
  // expiring on its own at startedAt + durationMs. Advisory, not truth.
  presence: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("work"), v.literal("shortBreak"), v.literal("longBreak")),
    // Category name for public work sessions; null = private task or break.
    label: v.union(v.string(), v.null()),
    startedAt: v.number(),
    durationMs: v.number(),
  }).index("by_user", ["userId"]),

  // Legacy: the cycle counter moved into the client with the local-first
  // timer. Kept only because pre-migration rows still exist.
  userStats: defineTable({
    userId: v.id("users"),
    cycleCount: v.number(),
    lastActivityAt: v.number(),
  }).index("by_user", ["userId"]),

  // Cached leaderboard entries. A row is created the first time a user appears
  // in the live presence feed (synced by the cron job `syncLeaderboard`), so
  // anyone who has *ever* been on the timer stays ranked even after they go
  // offline. The total focus time is refreshed from the session log when the
  // row is (re)written.
  leaderboard_cache: defineTable({
    username: v.string(),
    totalMs: v.number(),
    todayMs: v.optional(v.number()),
    weekMs: v.optional(v.number()),
    monthMs: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_username", ["username"]),
});
