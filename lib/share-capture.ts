/**
 * Draws the share image for a profile's day card onto a canvas and triggers a
 * PNG download. Replaces the original anime illustration with the user's
 * profile (avatar when chosen, otherwise just the name) beside the day card.
 *
 * Drawn directly on a canvas (not html-to-image) so it works reliably across
 * browsers and never captures a blank/off-screen node.
 */
import { faDate, faHourClock, faDuration } from "@/lib/format";
import { copy } from "@/lib/copy";
import type { FocusDay } from "@/lib/focus-history";
import type { PeepSelection, PeepPart } from "@/lib/peeps-parts";
import { footprint, LAYER_ORDER, peepSrc } from "@/lib/peeps-parts";

const W = 720;
const H = 420;

function sliceLabel(slice: {
  name?: string;
  bucket?: string;
}): string {
  if (slice.name !== undefined) return slice.name;
  return slice.bucket === "private"
    ? copy.profile.privateBucket
    : copy.profile.noTask;
}

/** Draw one Open Peeps part onto the canvas as an <img> (awaited). */
function drawPeepPart(
  ctx: CanvasRenderingContext2D,
  category: PeepPart,
  name: string,
  scale: number,
  offsetX: number,
  offsetY: number,
): Promise<void> {
  return new Promise((resolve) => {
    const f = footprint(category);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.drawImage(
        img,
        offsetX + f.x * scale,
        offsetY + f.y * scale,
        f.w * scale,
        f.h * scale,
      );
      resolve();
    };
    img.onerror = () => resolve();
    img.src = peepSrc(category, name);
  });
}

export async function captureShareCard(opts: {
  username: string;
  peep: PeepSelection | null;
  day: FocusDay | null;
}) {
  const { username, peep, day } = opts;
  const canvas = document.createElement("canvas");
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // --- Profile block (right side, RTL) ---
  const avatarX = W - 96;
  const avatarY = 32;
  const avatarR = 32;
  if (peep) {
    // Draw Open Peeps avatar into an offscreen canvas, then stamp it.
    const off = document.createElement("canvas");
    off.width = 850;
    off.height = 1200;
    const octx = off.getContext("2d");
    if (octx) {
      octx.fillStyle = "#f4f4f5";
      octx.fillRect(0, 0, 850, 1200);
      await Promise.all(
        LAYER_ORDER.filter((p) => peep[p]).map((p) =>
          drawPeepPart(octx, p, peep[p] as string, 1, 0, 0),
        ),
      );
      // circular clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(off, avatarX, avatarY, avatarR * 2, avatarR * 2);
      ctx.restore();
      ctx.strokeStyle = "#e4e4e7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#f4f4f5";
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Username
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "500 18px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(username, avatarX - avatarR - 12, avatarY + avatarR);

  // --- Day card block (left side) ---
  const cardX = 32;
  const cardY = 96;
  if (day) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#71717a";
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(faDate(day.dayKey), cardX + 240, cardY);

    ctx.fillStyle = "#0a0a0a";
    ctx.font = "bold 40px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(faHourClock(day.totalMs), cardX + 240, cardY + 28);

    ctx.fillStyle = "#0a0a0a";
    ctx.font = "bold 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(copy.profile.focusedHours, cardX + 240, cardY + 52);

    // slices
    let sy = cardY + 76;
    for (const slice of day.slices.slice(0, 4)) {
      const label = sliceLabel(slice);
      ctx.fillStyle = slice.name === undefined ? "#71717a" : "#0a0a0a";
      ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, cardX + 240, sy);
      ctx.fillStyle = "#71717a";
      ctx.fillText(faDuration(slice.ms), cardX, sy);
      // bar
      const barW = 240;
      const pct = day.totalMs > 0 ? (slice.ms / day.totalMs) * 100 : 0;
      ctx.fillStyle = "#e4e4e7";
      ctx.fillRect(cardX, sy + 6, barW, 4);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(cardX, sy + 6, (barW * pct) / 100, 4);
      sy += 22;
    }
  } else {
    ctx.fillStyle = "#71717a";
    ctx.font = "14px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("بدون داده", cardX, cardY + 20);
  }

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `pomodorus-${username}.png`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
