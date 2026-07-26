// Downloads a day detail from the profile as a PNG the visitor can post. The
// card in the image is the card on the page — same layout, same font, same
// art — so nothing here composes a separate design for it.

// The profile's own p-6, mirrored around the capture so the PNG carries the
// margins the card has on screen rather than reading as a too-tight crop.
const PAGE_PADDING = 24;

/**
 * Point the images inside `clone` at PNG data URIs redrawn from the pixels
 * already decoded in `source`.
 *
 * html-to-image rasterises through an `<svg><foreignObject>`, and an AVIF data
 * URI nested in there does not decode reliably — Safari leaves it blank. The
 * browser has necessarily decoded these AVIFs in order to paint them, so a
 * canvas round-trip yields the very same pixels in a format the pipeline reads.
 */
function inlineImagesAsPng(source: HTMLElement, clone: HTMLElement): void {
  const targets = clone.querySelectorAll("img");
  source.querySelectorAll("img").forEach((img, i) => {
    const target = targets[i];
    // Not decoded yet: leave the URL alone and let html-to-image fetch it.
    if (!target || !img.complete || img.naturalWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.drawImage(img, 0, 0);
    target.src = canvas.toDataURL("image/png");
    // Otherwise the srcset would win and pull the AVIF back in.
    target.removeAttribute("srcset");
  });
}

/**
 * Render `node` to a PNG blob. Black is painted behind it because the node is
 * transparent on the page's black body, and an alpha PNG would drop white text
 * onto whatever a timeline puts underneath. Density is tripled so the result
 * survives a social feed; the layout itself is untouched.
 *
 * The capture runs against an offscreen clone, which keeps the image swap above
 * invisible and gives the padding somewhere to live.
 */
async function renderCard(node: HTMLElement): Promise<Blob | null> {
  const { toBlob } = await import("html-to-image");

  const stage = document.createElement("div");
  stage.style.position = "fixed";
  stage.style.top = "0";
  stage.style.left = "-100vw";
  stage.style.width = `${node.offsetWidth + PAGE_PADDING * 2}px`;
  stage.style.padding = `${PAGE_PADDING}px`;
  stage.style.background = "#000";

  const clone = node.cloneNode(true) as HTMLElement;
  stage.append(clone);
  document.body.append(stage);
  try {
    inlineImagesAsPng(node, clone);
    return await toBlob(stage, { pixelRatio: 3, backgroundColor: "#000000" });
  } finally {
    stage.remove();
  }
}

/** Capture `node` and save it to the visitor's downloads. */
export async function downloadCard(node: HTMLElement, filename: string): Promise<void> {
  const blob = await renderCard(node);
  if (blob === null) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
