"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
              {/* Usernames are immutable with no rename path, so say so before
                  someone picks one, not after. */}
              <p className="text-xs text-foreground">{copy.login.usernameFinal}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{copy.login.email}</Label>
            {/* type="text": any string works as the login identifier ("test" is
                fine); inputMode keeps the email keyboard on mobile. */}
            <Input id="email" name="email" type="text" inputMode="email" required dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{copy.login.password}</Label>
            <Input id="password" name="password" type="password" required dir="ltr" />
          </div>
          {/* The theme is monochrome, so an error can't be red — it separates
              itself from the grey hints around it by being full white, boxed
              and iconned instead. aria-live so it is announced, since it
              appears well below the field that caused it. */}
          <div aria-live="polite">
            {error && (
              <Alert className="text-foreground">
                <TriangleAlert />
                <AlertDescription className="text-foreground">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" />
                {copy.login.signingIn}
              </>
            ) : flow === "signIn" ? (
              copy.login.signIn
            ) : (
              copy.login.signUp
            )}
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
        {/* The NavBar is hidden on this route, so without this a signed-out
            visitor has no way back to the landing but the browser's own. */}
        <Link
          href="/"
          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          {copy.login.backHome}
        </Link>
      </div>
    </main>
  );
}
