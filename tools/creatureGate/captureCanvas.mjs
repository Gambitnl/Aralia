/**
 * One canvas capture with the page chrome removed.
 *
 * WHY (2026-08-24): both sweeps clipped to the canvas element, with the comment
 * "the dark page toolbar would read as mask pixels" — correct, but not enough.
 * The clip still caught the container's dark rounded border and, at the bottom,
 * a SOLID dark bar about 21 px tall sitting inside the canvas box.
 *
 * That matters because maskmetrics.py binarizes `im < 128`, crops to the
 * bounding box of dark pixels, and then measures `straight_max` as the longest
 * constant-slope run along the top, bottom, left AND right boundaries. A dark
 * bar spanning the full width makes the BOTTOM boundary a dead-flat line, so
 * `straight_max` saturates to exactly 1 and the `plank` floor (> 0.7) fires on
 * every view — for every creature, regardless of its shape.
 *
 * Measured on the 2026-08-24 nightly: 14 of 19 creatures at straight_max == 1.00
 * with nothing between 0.14 and 1.00. Saturation, not a distribution. None of it
 * described a creature.
 *
 * A fixed inset is not enough on its own — the band is asymmetric and its height
 * depends on page layout. So: inset a little to clear the rounded corners, then
 * TRIM any remaining border rows and columns that are essentially all dark. That
 * is self-correcting if the layout changes again.
 */
import sharp from 'sharp';

/** Pixels trimmed from every side before the dark-edge trim runs. Clears the
 *  container's rounded corner radius. */
export const INSET_PX = 8;

/** A border row/column this dark end-to-end is chrome, not a subject. */
const DARK_LEVEL = 128;
const DARK_SHARE = 0.98;

/** Never eat more than this share of the frame — a genuinely dark subject
 *  must not be trimmed away silently. */
const MAX_TRIM_FRAC = 0.25;

/** How many border rows/cols on each side are chrome. */
async function darkEdges(buf) {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const rowDark = (y) => {
    let n = 0;
    for (let x = 0; x < W; x++) if (data[y * W + x] < DARK_LEVEL) n++;
    return n / W;
  };
  const colDark = (x) => {
    let n = 0;
    for (let y = 0; y < H; y++) if (data[y * W + x] < DARK_LEVEL) n++;
    return n / H;
  };
  const maxY = Math.floor(H * MAX_TRIM_FRAC);
  const maxX = Math.floor(W * MAX_TRIM_FRAC);
  let top = 0; while (top < maxY && rowDark(top) >= DARK_SHARE) top++;
  let bottom = 0; while (bottom < maxY && rowDark(H - 1 - bottom) >= DARK_SHARE) bottom++;
  let left = 0; while (left < maxX && colDark(left) >= DARK_SHARE) left++;
  let right = 0; while (right < maxX && colDark(W - 1 - right) >= DARK_SHARE) right++;
  return { W, H, top, bottom, left, right };
}

/**
 * Screenshot the first canvas, inset past the rounded corners, then trim any
 * all-dark border rows/columns. Reports rather than guesses when the canvas is
 * too small to work with.
 */
export async function captureCanvas(page, path, { inset = INSET_PX } = {}) {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box || box.width <= inset * 2 + 8 || box.height <= inset * 2 + 8) {
    console.log(`captureCanvas: canvas too small to inset (${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'no box'}) — capturing WITH page chrome, expect a plank flag`);
    await page.locator('canvas').first().screenshot({ path });
    return;
  }
  const shot = await page.screenshot({
    clip: {
      x: Math.round(box.x + inset),
      y: Math.round(box.y + inset),
      width: Math.round(box.width - inset * 2),
      height: Math.round(box.height - inset * 2),
    },
  });
  const e = await darkEdges(shot);
  const w = e.W - e.left - e.right;
  const h = e.H - e.top - e.bottom;
  if (w < 32 || h < 32) {
    console.log(`captureCanvas: dark-edge trim would leave ${w}x${h} — writing untrimmed`);
    await sharp(shot).toFile(path);
    return;
  }
  await sharp(shot).extract({ left: e.left, top: e.top, width: w, height: h }).toFile(path);
}
