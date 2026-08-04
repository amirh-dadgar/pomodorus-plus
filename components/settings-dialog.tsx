"use client";

import { useState } from "react";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
    // Label above rather than beside the control: the labels differ in length
    // enough that one of them wraps to a second line, and a row that is a line
    // taller than its neighbours is the whole inconsistency. Stacked, every
    // interval is the same block — one line of label over one control row of
    // fixed width — however the copy changes.
    <div className="flex flex-col items-start gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2" dir="ltr">
        <Button
          variant="outline"
          size="icon"
          aria-label={`${label} −`}
          disabled={down === null}
          onClick={() => down !== null && setSetting(settingKey, down)}
        >
          <Minus className="size-4" />
        </Button>
        {/* Fixed width so «۵ دقیقه» and «۲۰ دقیقه» do not shift the buttons,
            and so all three controls are exactly as wide as each other. */}
        <span className="w-24 text-center font-mono tabular-nums">
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.timer.settingsTitle}</DialogTitle>
          <DialogDescription>{copy.timer.settingsNote}</DialogDescription>
        </DialogHeader>
        {/* One gap between every interval, and the same gap inside each one's
            label-to-control step is deliberately smaller, so the three read as
            three groups rather than six loose lines. */}
        <div className="flex flex-col gap-6">
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
        {/* Inline rather than a DialogFooter bar: the category picker is the
            reference dialog in this app and it closes with a plain button. */}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setOpen(false)}>
            {copy.timer.settingsDone}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
