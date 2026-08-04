import { v, ConvexError } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import copy from "../lib/copy.json";
import { isProfane } from "../lib/profanity";
import { verdictFor } from "../lib/sync-rules";

// How much of a backlog one push drains. The rest is left unacked and comes
// straight back on the next round, so a long spell offline costs round trips
// rather than sessions.
const SESSION_BATCH = 500;
const OP_BATCH = 200;

// Dev-only fast sessions are credited at their nominal duration. Gated by
// the DEV_FAST_POMODORO env var on the deployment so production drops them.
const fastAllowed = () => process.env.DEV_FAST_POMODORO !== undefined;

/**
 * A device's category reference is its client-minted uuid; rows created
 * before the local-first move have no clientId and are addressed by their
 * Convex _id instead.
 */
async function findOwnCategory(
  ctx: MutationCtx,
  userId: Id<"users">,
  clientId: string,
): Promise<Doc<"categories"> | null> {
  const byClient = await ctx.db
    .query("categories")
    .withIndex("by_user_client", (q) => q.eq("userId", userId).eq("clientId", clientId))
    .unique();
  if (byClient) return byClient;
  const legacyId = ctx.db.normalizeId("categories", clientId);
  if (!legacyId) return null;
  const row = await ctx.db.get(legacyId);
  return row && row.userId === userId ? row : null;
}

/**
 * The same test the device applies before queueing the op (`lib/local/device`),
 * repeated because the device is not trusted with it: a category name reaches
 * the public feed, and the queue is a plain JSON blob in localStorage that
 * anyone can hand-edit. A refused name is dropped like any other invalid item,
 * silently — the client that meant it already said no in its own words.
 */
function validName(name: string | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  if (trimmed.length < 1 || trimmed.length > 40) return null;
  return isProfane(trimmed) ? null : trimmed;
}

/**
 * What the device is allowed to forget, returned by every successful `push`.
 *
 * The device clears *only* what is named here, never simply what it sent
 * (`components/sync-engine`). Anything omitted stayed on the queue and is
 * pushed again next round — that is what makes a rejection cost a retry
 * instead of a user's afternoon.
 */
export type PushAck = {
  /** clientIds of sessions now settled: stored, already stored, or unstorable. */
  sessions: string[];
  /** `clientId:at` keys of category ops now settled. */
  categoryOps: string[];
};

/**
 * The whole sync protocol in one idempotent mutation
 * (docs/adr/0001-local-first-timer.md): a device uploads everything it has
 * done since it was last online. Category ops apply last-write-wins with
 * delete beating rename; completed work sessions append to the log, deduped by
 * clientId so retries are safe.
 *
 * Two kinds of "no" (docs/adr/0006-acknowledged-sync.md), and telling them
 * apart is the point of the ack: an item that *cannot* ever be stored is
 * settled and dropped, while an item that merely cannot be stored *yet* — a
 * device whose clock runs ahead of the server's, a backlog past the batch cap —
 * is left off the ack and keeps its place in the queue.
 */
export const push = mutation({
  args: {
    categoryOps: v.array(
      v.object({
        clientId: v.string(),
        op: v.union(v.literal("upsert"), v.literal("delete")),
        name: v.optional(v.string()),
        isPublic: v.optional(v.boolean()),
        at: v.number(), // client edit timestamp, for last-write-wins
      }),
    ),
    sessions: v.array(
      v.object({
        clientId: v.string(),
        categoryClientId: v.optional(v.string()),
        startedAt: v.number(),
        durationMs: v.number(),
        endedAt: v.number(),
        devFast: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, { categoryOps, sessions }): Promise<PushAck> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError(copy.errors.signInFirst);
    const now = Date.now();

    // Anything past the caps is simply not looked at this round, so it is not
    // acked either, and the device pushes it again immediately.
    const ack: PushAck = { sessions: [], categoryOps: [] };
    const settledOp = (op: { clientId: string; at: number }) =>
      ack.categoryOps.push(`${op.clientId}:${op.at}`);

    for (const op of categoryOps.slice(0, OP_BATCH)) {
      settledOp(op);
      const existing = await findOwnCategory(ctx, userId, op.clientId);
      if (existing?.deleted) continue; // tombstones never revive
      if (op.op === "delete") {
        if (existing) {
          await ctx.db.patch(existing._id, { deleted: true, updatedAt: op.at });
        } else {
          // Tombstone for a category the server never saw, so a stale
          // upsert queued on another device can't resurrect it.
          await ctx.db.insert("categories", {
            userId,
            clientId: op.clientId,
            name: "",
            isPublic: false,
            updatedAt: op.at,
            deleted: true,
          });
        }
        continue;
      }
      const name = validName(op.name);
      if (existing) {
        if (op.at <= (existing.updatedAt ?? 0)) continue;
        await ctx.db.patch(existing._id, {
          ...(name !== null ? { name } : {}),
          ...(op.isPublic !== undefined ? { isPublic: op.isPublic } : {}),
          updatedAt: op.at,
        });
      } else if (name !== null) {
        await ctx.db.insert("categories", {
          userId,
          clientId: op.clientId,
          name,
          isPublic: op.isPublic ?? true,
          updatedAt: op.at,
        });
      }
    }

    for (const s of sessions.slice(0, SESSION_BATCH)) {
      // `defer` is the one verdict that withholds the ack: the session keeps
      // its place on the device's queue and comes back next push. Everything
      // else is settled, so the device stops carrying it.
      const verdict = verdictFor(s, { now, fastAllowed: fastAllowed() });
      if (verdict === "defer") continue;
      ack.sessions.push(s.clientId);
      if (verdict === "reject") continue;

      // The one check the pure rules cannot make. Acked either way: a session
      // already in the log is as settled as one this push writes.
      const dupe = await ctx.db
        .query("sessions")
        .withIndex("by_user_client", (q) => q.eq("userId", userId).eq("clientId", s.clientId))
        .unique();
      if (dupe) continue; // an earlier push, a retry, or another device

      const category = s.categoryClientId
        ? await findOwnCategory(ctx, userId, s.categoryClientId)
        : null;
      await ctx.db.insert("sessions", {
        userId,
        kind: "work",
        ...(category ? { categoryId: category._id } : {}),
        startedAt: s.startedAt,
        durationMs: s.durationMs,
        status: "completed",
        endedAt: s.endedAt,
        clientId: s.clientId,
        ...(s.devFast ? { devFast: true } : {}),
      });
    }

    return ack;
  },
});
