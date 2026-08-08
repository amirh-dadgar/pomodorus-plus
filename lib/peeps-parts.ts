// Open Peeps part catalogue, scanned from public/peeps/parts, plus the
// per-part footprint on the shared 850x1200 character canvas.
//
// Open Peeps is composed on ONE canvas: the body sits at translate(0 459)
// and the head group at translate(225 0); inside the head, the face is at
// translate(159 186), facial hair at translate(123 338), accessories at
// translate(47 241). Each standalone .svg ships in its own viewBox, so we
// place it on the shared canvas at exactly that offset (scaled to its own
// viewBox), which is what makes the pieces line up like the real character
// instead of overlapping randomly.

export type PeepPart = "head" | "body" | "face" | "facialHair" | "accessories";

export type PeepSelection = Partial<Record<PeepPart, string | null>>;

/** A part's box on the 850x1200 canvas (matching the library's translate). */
export type Footprint = { x: number; y: number; w: number; h: number };

// Raw viewBoxes of the part .svgs (from the files in public/peeps/parts).
const VIEWBOX: Record<PeepPart, { w: number; h: number }> = {
  body: { w: 818, h: 733 },
  head: { w: 473, h: 567 },
  face: { w: 289, h: 293 },
  facialHair: { w: 280, h: 230 },
  accessories: { w: 392, h: 138 },
};

// Where each part's viewBox origin lands on the 850x1200 canvas.
const ORIGIN: Record<PeepPart, { x: number; y: number }> = {
  body: { x: 0, y: 459 },
  head: { x: 225, y: 0 },
  face: { x: 225 + 159, y: 186 },
  facialHair: { x: 225 + 123, y: 338 },
  accessories: { x: 225 + 47, y: 241 },
};

/** Footprint of a part on the 850x1200 canvas. */
export function footprint(part: PeepPart): Footprint {
  const o = ORIGIN[part];
  const v = VIEWBOX[part];
  return { x: o.x, y: o.y, w: v.w, h: v.h };
}

export const PEEP_PARTS: Record<PeepPart, string[]> = {
  head: [
    "Afro",
    "Bangs 2",
    "Bangs",
    "Bantu Knots",
    "Bun 2",
    "Bun",
    "Buns",
    "Cornrows 2",
    "Cornrows",
    "Flat Top Long",
    "Flat Top",
  ],
  body: [
    "Blazer Black Tee",
    "Button Shirt 1",
    "Button Shirt 2",
    "Coffee",
    "Device",
    "Dress",
    "Explaining",
    "Fur Jacket",
    "Gaming",
    "Gym Shirt",
  ],
  face: [
    "Angry with Fang",
    "Awe",
    "Blank",
    "Calm",
    "Cheeky",
    "Concerned Fear",
    "Concerned",
    "Contempt",
    "Cute",
  ],
  facialHair: [
    "Chin",
    "Full 2",
    "Full 3",
    "Full 4",
    "Full",
    "Goatee 1",
    "Goatee 2",
    "Moustache 1",
  ],
  accessories: [
    "Eyepatch",
    "Glasses 2",
    "Glasses 3",
    "Glasses 4",
    "Glasses 5",
    "Glasses",
    "Sunglasses 2",
    "Sunglasses",
  ],
};

export function peepSrc(category: PeepPart, name: string): string {
  return `/peeps/parts/${category}/${encodeURIComponent(name)}.svg`;
}

// The order parts are drawn back-to-front so they composite like a person.
export const LAYER_ORDER: PeepPart[] = [
  "body",
  "head",
  "face",
  "facialHair",
  "accessories",
];

export const PART_LABEL: Record<PeepPart, string> = {
  body: "بدن",
  head: "سر",
  face: "صورت",
  facialHair: "ریش",
  accessories: "لوازم",
};
