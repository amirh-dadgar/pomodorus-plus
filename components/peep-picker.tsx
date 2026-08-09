"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import {
  footprint,
  LAYER_ORDER,
  PART_LABEL,
  PEEP_PARTS,
  peepSrc,
  type PeepPart,
  type PeepSelection,
} from "@/lib/peeps-parts";
import { notifyPeepChanged } from "@/lib/peep-store";

const STORAGE_KEY = "peep-selection";

const CANVAS = { w: 850, h: 1200 };

/** Read the saved peep from localStorage (null when none yet). */
export function loadPeep(): PeepSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PeepSelection) : null;
  } catch {
    return null;
  }
}

/**
 * Compose the selected Open Peeps parts onto one 850x1200 canvas. Each part is
 * an inner <svg> placed at its real footprint (matching the library's
 * translate offsets) so the pieces line up like the actual character instead
 * of being stretched to fill the box.
 */
/** Inline a part .svg's inner markup so it renders inside our wrapper <svg>
 *  with `overflow: visible`. Referencing the file via <image> rasterizes it
 *  into its own viewBox window, which clips hair paths that reach negative
 *  coordinates — inlining lets the wrapper's overflow show them. */
const svgTextCache = new Map<string, string>();

function PeepPartSvg({
  category,
  name,
  x,
  y,
  w,
  h,
}: {
  category: PeepPart;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const src = peepSrc(category, name);
  const [inner, setInner] = useState<string | null>(() => svgTextCache.get(src) ?? null);
  useEffect(() => {
    let alive = true;
    // Always push the current content (cached or freshly fetched) into state so
    // the rendered markup updates when `src` (the selected part) changes — not
    // just on first cache miss. Without this, a part already in the cache would
    // never re-set state and the avatar would keep showing the old part until
    // a full page reload.
    const cached = svgTextCache.get(src);
    if (cached !== undefined) {
      // Defer so we don't call setState synchronously in the effect body
      // (React lint rule). The initializer already seeded state from cache,
      // this just refreshes it when `src` changes to a cached part.
      queueMicrotask(() => setInner(cached));
      return;
    }
    fetch(src)
      .then((r) => r.text())
      .then((t) => {
        const m = t.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
        const content = m ? m[1] : "";
        svgTextCache.set(src, content);
        if (alive) setInner(content);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);
  if (!inner) return null;
  return (
    <svg
      x={x}
      y={y}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      overflow="visible"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export function PeepAvatar({
  selection,
  className,
  background = "#f4f4f5",
}: {
  selection: PeepSelection | null;
  className?: string;
  /** Backdrop behind the character so dark hair/clothes stay visible on dark UIs. */
  background?: string | null;
}) {
  return (
    <svg
      viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`}
      className={className}
      role="img"
      aria-label="آواتار"
      overflow="visible"
    >
      {background && (
        <rect x={0} y={0} width={CANVAS.w} height={CANVAS.h} fill={background} />
      )}
      {LAYER_ORDER.filter((p) => selection?.[p]).map((p) => {
        const f = footprint(p);
        return (
          <PeepPartSvg
            key={p}
            category={p}
            name={selection![p] as string}
            x={f.x}
            y={f.y}
            w={f.w}
            h={f.h}
          />
        );
      })}
    </svg>
  );
}

/**
 * The "آواتار" control: a button that opens a dialog where the visitor assembles
 * their Open Peeps avatar part by part, sees a live (correctly composited)
 * preview, and saves the selection to localStorage. Built on the app's own
 * radix Dialog so it matches every other dialog.
 */
export function PeepPicker({
  onSaved,
  className,
}: {
  /** Called with the saved selection so the parent can re-render live. */
  onSaved?: (sel: PeepSelection) => void;
  /** Extra classes for the trigger button (e.g. nav sizing). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<PeepPart>("head");
  const [sel, setSel] = useState<PeepSelection>(() => {
    if (typeof window === "undefined") return {};
    const base: PeepSelection = {};
    for (const p of LAYER_ORDER) base[p] = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? { ...base, ...(JSON.parse(raw) as PeepSelection) } : base;
    } catch {
      return base;
    }
  });

  const pick = (part: PeepPart, name: string | null) => {
    setSel((prev) => ({ ...prev, [part]: name }));
  };

  const save = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
    } catch {
      /* ignore quota / private-mode errors */
    }
    // Tell any listener (nav, profile page, etc.) the avatar changed so they
    // can re-render without a refresh. `storage` events only fire in *other*
    // tabs, so we broadcast a same-document event too.
    onSaved?.(sel);
    notifyPeepChanged();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("peep:updated"));
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={`text-muted-foreground ${className ?? ""}`}>
          <User />
          {copy.timer.peep ?? "آواتار"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="size-4 text-yellow-500" />
            {copy.timer.peep ?? "آواتار"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Live, correctly-composited preview. */}
          <div className="mx-auto aspect-square w-40 overflow-hidden rounded-lg border bg-[#f4f4f5]">
            <PeepAvatar selection={sel} className="h-full w-full" />
          </div>

          {/* Part tabs. */}
          <div className="flex flex-wrap justify-center gap-1">
            {LAYER_ORDER.map((p) => (
              <Button
                key={p}
                size="xs"
                variant={active === p ? "secondary" : "ghost"}
                onClick={() => setActive(p)}
                className={active === p ? "" : "text-muted-foreground"}
              >
                {PART_LABEL[p]}
              </Button>
            ))}
          </div>

          {/* Thumbnails for the active part. */}
          <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
            <button
              type="button"
              onClick={() => pick(active, null)}
              className={`flex aspect-square items-center justify-center rounded border bg-[#f4f4f5] text-xs text-muted-foreground ${
                sel[active] == null ? "border-yellow-500" : ""
              }`}
            >
              بدون
            </button>
            {PEEP_PARTS[active].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => pick(active, name)}
                className={`flex aspect-square items-center justify-center rounded border bg-[#f4f4f5] p-1 ${
                  sel[active] === name ? "border-yellow-500" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={peepSrc(active, name)} alt={name} className="h-full w-full" />
              </button>
            ))}
          </div>

          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={save}>
              ذخیره
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
