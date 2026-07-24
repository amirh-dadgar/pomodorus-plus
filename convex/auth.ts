import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";
import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import copy from "../lib/copy.json";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

// Minimal email/password auth: no verification, no reset.
// `name` is the public display name shown in the feed; `username` is the
// unique immutable handle used in profile URLs.
const PasswordWithProfile = Password({
  profile(params) {
    const email = String(params.email ?? "").trim().toLowerCase();
    const name = String(params.name ?? "").trim();
    const username = String(params.username ?? "").trim().toLowerCase();
    if (params.flow === "signUp") {
      if (name.length < 2 || name.length > 32) {
        throw new ConvexError(copy.errors.nameLength);
      }
      if (!USERNAME_RE.test(username)) {
        throw new ConvexError(copy.errors.usernameInvalid);
      }
    }
    // Only persisted on signUp; on other flows just `email` is read from this.
    return { email, name: name || email.split("@")[0], username };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordWithProfile],
  callbacks: {
    // Runs inside the signup transaction, so throwing here aborts the whole
    // signup — that's what enforces username uniqueness.
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId !== null) return;
      // The callback ctx is typed against a generic data model; recover ours.
      const db = ctx.db as unknown as GenericDatabaseWriter<DataModel>;
      const user = await db.get(userId);
      const username = user?.username;
      if (!username || !USERNAME_RE.test(username)) {
        throw new ConvexError(copy.errors.usernameInvalid);
      }
      const clash = await db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .filter((q) => q.neq(q.field("_id"), userId))
        .first();
      if (clash) {
        throw new ConvexError(copy.errors.usernameTaken);
      }
    },
  },
});
