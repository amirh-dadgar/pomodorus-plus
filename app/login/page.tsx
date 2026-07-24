"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConvexError } from "convex/values";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
      router.push("/app");
    } catch (e) {
      if (e instanceof ConvexError && typeof e.data === "string") {
        setError(e.data);
      } else if (flow === "signUp") {
        setError(copy.login.signUpFailed);
      } else {
        setError(copy.login.badCredentials);
      }
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">
        <h1 className="text-center text-2xl font-bold tracking-tight">{copy.app.name}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {flow === "signUp" && (
            <div className="space-y-2">
              <Label htmlFor="username">{copy.login.username}</Label>
              <Input
                id="username"
                name="username"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-z0-9_]+"
                title={copy.login.usernameHint}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">{copy.login.usernameHint}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{copy.login.email}</Label>
            <Input id="email" name="email" type="email" required dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{copy.login.password}</Label>
            <Input id="password" name="password" type="password" required minLength={8} dir="ltr" />
          </div>
          {error && <p className="text-sm text-muted-foreground">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {flow === "signIn" ? copy.login.signIn : copy.login.signUp}
          </Button>
        </form>
        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            setError(null);
            setFlow(flow === "signIn" ? "signUp" : "signIn");
          }}
        >
          {flow === "signIn" ? copy.login.toSignUp : copy.login.toSignIn}
        </button>
      </div>
    </main>
  );
}
