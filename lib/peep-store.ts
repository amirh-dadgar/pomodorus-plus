// Tiny pub/sub around the saved peep selection so any component (nav, profile
// header, etc.) can react to a save made elsewhere without prop drilling or
// relying on the same-document `window` event (which can be missed during a
// React state batch / dialog close). Framework-agnostic on purpose.

import { loadPeep } from "@/components/peep-picker";
import { type PeepSelection } from "@/lib/peeps-parts";

type Listener = (sel: PeepSelection | null) => void;

const listeners = new Set<Listener>();

/** Notify subscribers that the saved peep changed (after a save). */
export function notifyPeepChanged(): void {
  const sel = loadPeep();
  for (const l of listeners) l(sel);
}

/** Subscribe to peep changes. Returns an unsubscribe fn. Fires immediately
 *  with the current value on subscribe so callers don't need a separate seed. */
export function subscribePeep(fn: Listener): () => void {
  listeners.add(fn);
  fn(loadPeep());
  return () => {
    listeners.delete(fn);
  };
}
