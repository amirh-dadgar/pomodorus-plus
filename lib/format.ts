const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert ASCII digits in a string (or a number) to Persian digits. */
export function faDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** mm:ss countdown with Persian digits, e.g. ۲۴:۰۵ */
export function faClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return faDigits(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
}

/** Total focus time as «۲ ساعت و ۲۵ دقیقه» / «۴۵ دقیقه». */
export function faDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${faDigits(minutes)} دقیقه`;
  if (minutes === 0) return `${faDigits(hours)} ساعت`;
  return `${faDigits(hours)} ساعت و ${faDigits(minutes)} دقیقه`;
}

const jalali = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
});

/** Jalali date for a "YYYY-MM-DD" Tehran day key, e.g. «پنجشنبه ۲ مرداد ۱۴۰۵». */
export function faDate(dayKey: string): string {
  // Noon UTC is unambiguously inside the Tehran day.
  return jalali.format(new Date(`${dayKey}T12:00:00Z`));
}
