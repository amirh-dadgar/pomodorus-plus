// Tehran-local day bucketing, shared by sync (writes) and profiles (reads).
// Fixed UTC+3:30: Iran abolished DST in 2022, so no tz database is needed.

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const TEHRAN_OFFSET_MS = 3.5 * 60 * MINUTE_MS;

/** "YYYY-MM-DD" key of the Tehran-local day containing `ts`. */
export function tehranDayKey(ts: number): string {
  return new Date(ts + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** The last `count` Tehran day keys ending at the day containing `now`, oldest first. */
export function lastDayKeys(count: number, now: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(tehranDayKey(now - i * DAY_MS));
  return keys;
}
