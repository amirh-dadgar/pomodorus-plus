"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConvexError } from "convex/values";
import Link from "next/link";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/copy";

/**
 * One form, one button, two fields.
 *
 * There is no sign-in/sign-up toggle because there is nothing to choose
 * between: the server takes a username and a password and either signs you
 * into that account or creates it (see `convex/auth.ts`). The page never has
 * to know which of the two happened.
 */
export default function LoginPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signIn("password", new FormData(event.currentTarget));
      router.push("/app");
    } catch (e) {
      // The server states its own case in Persian for everything it can
      // name; anything else is a network or deployment problem, and the
      // wrong-password line is the likeliest reading of a bare failure.
      setError(
        e instanceof ConvexError && typeof e.data === "string"
          ? e.data
          : copy.login.badCredentials,
      );
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* The NavBar is hidden on this route, so the notice takes its band:
          full width of the content frame at the top, on the NavBar's px-6,
          rather than sitting in the narrow form column. */}
      <div className="shrink-0 px-6 py-4">
        <Alert>
          <TriangleAlert />
          <AlertTitle>{copy.landing.experimentalTitle}</AlertTitle>
          <AlertDescription>{copy.landing.experimental}</AlertDescription>
        </Alert>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-8">
          {/* Set like the hero's title — same treatment, its own size. */}
          <h1 className="text-center text-2xl font-light tracking-widest uppercase text-yellow-600">
            {copy.app.name}
          </h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{copy.login.username}</Label>
              <Input
                id="username"
                name="username"
                autoFocus
                required
                minLength={3}
                maxLength={20}
                pattern="[a-z0-9_]+"
                title={copy.login.usernameHint}
                autoComplete="username"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {copy.login.usernameHint}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{copy.login.password}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
            {/* The theme is monochrome, so an error can't be red — it
                separates itself from the grey hints around it by being full
                white, boxed and iconned instead. aria-live so it is
                announced, since it appears well below the field that caused
                it. */}
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
              ) : (
                copy.login.go
              )}
            </Button>
          </form>
          {/* Without this a signed-out visitor has no way back to the landing
              but the browser's own. */}
          <Link
            href="/"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="size-3" />
            {copy.login.backHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
