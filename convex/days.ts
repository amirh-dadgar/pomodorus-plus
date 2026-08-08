// Tehran-local day bucketing, used wherever the sessions log is read per day.
// Fixed UTC+3:30: Iran abolished DST in 2022, so no tz database is needed.

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const TEHRAN_OFFSET_MS = 3.5 * 60 * MINUTE_MS;

/** "YYYY-MM-DD" key of the Tehran-local day containing `ts`. */
export function tehranDayKey(ts: number): string {
  return new Date(ts + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Epoch ms of the start (00:00) of the Tehran-local day containing `ts`. */
export function tehranDayStart(ts: number): number {
  const key = tehranDayKey(ts); // "YYYY-MM-DD"
  return Date.parse(`${key}T00:00:00.000+03:30`);
}

/**
 * Epoch ms of the start of the Tehran-local week (Saturday 00:00) containing
 * `ts`. The Persian week starts on Saturday; JS getUTCDay() is 6 for Saturday.
 */
export function tehranWeekStart(ts: number): number {
  const dayStart = tehranDayStart(ts);
  // Tehran weekday of `dayStart`: 0 = Saturday .. 6 = Friday.
  const dow = (new Date(dayStart + TEHRAN_OFFSET_MS).getUTCDay() + 1) % 7;
  return dayStart - dow * DAY_MS;
}

/** The last `count` Tehran day keys ending at the day containing `now`, oldest first. */
export function lastDayKeys(count: number, now: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(tehranDayKey(now - i * DAY_MS));
  return keys;
}
