/**
 * Pick a banner, avoiding an immediate repeat of `last` (the banner shown on
 * the previous visit). Returns null when there are no banners to show.
 */
export function pickBanner(
  banners: readonly string[],
  last: string | null,
  random: () => number = Math.random,
): string | null {
  if (banners.length === 0) return null;
  const fresh = banners.filter((b) => b !== last);
  // With a single banner there is nothing to rotate to, so repeat it.
  const pool = fresh.length > 0 ? fresh : banners;
  return pool[Math.floor(random() * pool.length)];
}
