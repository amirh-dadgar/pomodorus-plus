// Turns a day detail on the profile into a PNG the visitor can post. The card
// in the image is the card on the page — same layout, same font, same art —
// so nothing here composes a separate "share" design.

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

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Capture `node` and hand it to the platform: the native share sheet where one
 * exists, a download everywhere else. Desktop browsers largely refuse file
 * shares, and Safari can reject a share whose user gesture went stale while the
 * capture ran — both fall through to the download.
 */
export async function shareCard(node: HTMLElement, filename: string): Promise<void> {
  const blob = await renderCard(node);
  if (blob === null) return;
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      // Closing the sheet is a finished interaction, not a reason to download.
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  download(blob, filename);
}
