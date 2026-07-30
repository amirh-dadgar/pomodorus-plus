// Which image a day card shows.
//
// The draw is remembered for the page visit rather than the card's lifetime:
// changing Range unmounts the card while the new range loads, and a day whose
// art came back different every time would read as a glitch. That memory is the
// point of this module — the random pick on its own is a one-liner.

/** A page visit's record of which image each key was given. */
export type BannerAssignment = {
  /**
   * The image for `key`, drawn at random the first time it is asked for and
   * kept from then on, so pointing back and forth along the chart never
   * reshuffles the art. Successive draws avoid each other, which keeps
   * neighbouring days off the same picture. Null when there is nothing to show.
   */
  for(key: string): string | null;
};

/**
 * A fresh assignment over `banners`. Pass `random` to make the draws
 * deterministic; the app uses the default.
 */
export function createBannerAssignment(
  banners: readonly string[],
  random: () => number = Math.random,
): BannerAssignment {
  const assigned = new Map<string, string>();
  let lastDrawn: string | null = null;

  return {
    for(key) {
      const seen = assigned.get(key);
      if (seen !== undefined) return seen;
      if (banners.length === 0) return null;
      const fresh = banners.filter((b) => b !== lastDrawn);
      // With a single image there is nothing to rotate to, so repeat it.
      const pool = fresh.length > 0 ? fresh : banners;
      const picked = pool[Math.floor(random() * pool.length)];
      assigned.set(key, picked);
      lastDrawn = picked;
      return picked;
    },
  };
}

// One assignment per banner list for the life of the page, so every card drawn
// on that page shares one history of draws.
const byList = new Map<string, BannerAssignment>();

/** The visit's image for `key`. The app's binding of `createBannerAssignment`. */
export function bannerFor(banners: readonly string[], key: string): string | null {
  const listKey = banners.join("\n");
  let assignment = byList.get(listKey);
  if (assignment === undefined) {
    assignment = createBannerAssignment(banners);
    byList.set(listKey, assignment);
  }
  return assignment.for(key);
}
