"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConvexError } from "convex/values";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      router.push("/");
    } catch (e) {
      if (e instanceof ConvexError && typeof e.data === "string") {
        setError(e.data);
      } else if (flow === "signUp") {
        setError("ثبت‌نام ناموفق بود. رمز عبور باید حداقل ۸ حرف باشد.");
      } else {
        setError("ایمیل یا رمز عبور نادرست است.");
      }
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-8">
        <h1 className="text-center text-2xl font-bold tracking-tight">Pomodorus</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {flow === "signUp" && (
            <div className="space-y-2">
              <Label htmlFor="name">نام نمایشی</Label>
              <Input id="name" name="name" required minLength={2} maxLength={32} dir="auto" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">ایمیل</Label>
            <Input id="email" name="email" type="email" required dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <Input id="password" name="password" type="password" required minLength={8} dir="ltr" />
          </div>
          {error && <p className="text-sm text-muted-foreground">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {flow === "signIn" ? "ورود" : "ثبت‌نام"}
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
          {flow === "signIn" ? "حساب ندارید؟ ثبت‌نام" : "حساب دارید؟ ورود"}
        </button>
      </div>
    </main>
  );
}
