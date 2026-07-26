"use client";

import { Camera, Loader2 } from "lucide-react";
import { useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { shareCard } from "@/lib/share-card";

/**
 * Saves the day card next to it as a PNG. It deliberately sits outside the
 * captured node so it can never end up inside its own screenshot.
 *
 * Failures stay quiet: a dismissed share sheet and a capture that fell over are
 * indistinguishable from here, and this page has nowhere to put an error.
 */
export function ShareDayButton({
  target,
  dayKey,
}: {
  target: RefObject<HTMLElement | null>;
  dayKey: string;
}) {
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    const node = target.current;
    if (node === null) return;
    setBusy(true);
    try {
      // The Jalali date belongs on the card, not in a filename.
      await shareCard(node, `pomodorus-${dayKey}.png`);
    } catch {
      // Nothing to say, and nowhere to say it.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={capture}
      disabled={busy}
      className="mt-4 text-muted-foreground"
    >
      {busy ? <Loader2 className="animate-spin" /> : <Camera />}
      {copy.profile.screenshot}
    </Button>
  );
}
