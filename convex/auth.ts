import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";

// Minimal email/password auth: no verification, no reset.
// `name` is the public display name shown in the feed.
const PasswordWithName = Password({
  profile(params) {
    const email = String(params.email ?? "").trim().toLowerCase();
    const name = String(params.name ?? "").trim();
    if (params.flow === "signUp") {
      if (name.length < 2 || name.length > 32) {
        throw new ConvexError("نام نمایشی باید بین ۲ تا ۳۲ حرف باشد");
      }
    }
    return { email, name: name || email.split("@")[0] };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordWithName],
});
