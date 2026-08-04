"use client";

import { useState } from "react";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { copy, t } from "@/lib/copy";
import { faDigits } from "@/lib/format";
import { useLocalState } from "@/lib/local/hooks";
import { setSetting } from "@/lib/local/store";
import { type RangeKey, RANGE_FIELD, stepValue } from "@/lib/local/types";

/**
 * One interval, as the same − / + pair the start screen uses for the pomodoro
 * length. The button for an end you have reached is disabled, exactly as the
 * duration stepper has always behaved.
 */
function IntervalRow({
  settingKey,
  label,
  value,
  format,
}: {
  settingKey: RangeKey;
  label: string;
  value: number;
  format: (n: number) => string;
}) {
  const down = stepValue(settingKey, value, -1);
  const up = stepValue(settingKey, value, 1);
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="min-w-0 text-sm">{label}</span>
      <div className="flex shrink-0 items-center gap-2" dir="ltr">
        <Button
          variant="outline"
          size="icon"
          aria-label={`${label} −`}
          disabled={down === null}
          onClick={() => down !== null && setSetting(settingKey, down)}
        >
          <Minus className="size-4" />
        </Button>
        <span className="w-24 text-center font-mono text-sm tabular-nums">
          {format(value)}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label={`${label} +`}
          disabled={up === null}
          onClick={() => up !== null && setSetting(settingKey, up)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * The break intervals and the cycle length.
 *
 * They are settings rather than start-screen controls because you do not
 * choose them per session — they are a policy. The pomodoro length stays on
 * the start screen, where it genuinely is a per-session decision.
 *
 * Everything here is device-local (ADR 0001): the device owns the timer, and
 * these durations *are* the timer, so a phone and a laptop may disagree.
 */
export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { settings } = useLocalState();

  const minutes = (n: number) => t(copy.timer.minutes, { m: faDigits(n) });
  const count = (n: number) => t(copy.timer.count, { n: faDigits(n) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Quiet on purpose: the monochrome, flat theme has no colour or
          elevation to demote anything with, so size and placement are the
          only tools. Same reason the cancel button is a ghost. */}
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <SlidersHorizontal size={14} />
          {copy.timer.settings}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle>{copy.timer.settingsTitle}</DialogTitle>
          <DialogDescription>{copy.timer.settingsNote}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <IntervalRow
            settingKey="shortBreak"
            label={copy.timer.settingsShortBreak}
            value={settings[RANGE_FIELD.shortBreak]}
            format={minutes}
          />
          <IntervalRow
            settingKey="longBreak"
            label={copy.timer.settingsLongBreak}
            value={settings[RANGE_FIELD.longBreak]}
            format={minutes}
          />
          <IntervalRow
            settingKey="perCycle"
            label={copy.timer.settingsPerCycle}
            value={settings[RANGE_FIELD.perCycle]}
            format={count}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {copy.timer.settingsDone}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
