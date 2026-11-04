/**
 * @file perfGif.ts — capture a few seconds of a tracked canvas into a GIF file.
 *
 * WHY. Remy asked (2026-10-10) for a "capture GIF" button in the performance
 * panel, so a stutter or a visual fault can be handed to someone as one small
 * moving picture, with no screen recorder and no upload. The panel already
 * knows every tracked canvas (`PerfSession.element`), so the capture reads
 * that canvas and nothing else on the page.
 *
 * HOW. For `seconds` at `fps`, each tick draws the session's canvas into an
 * offscreen 2D canvas scaled to at most `maxWidth` wide, with high-quality
 * smoothing. `drawImage` of a WebGL or WebGPU canvas reads the frame that was
 * last presented, so the capture runs on `requestAnimationFrame` and takes the
 * frame after the page's own draw. The encoder then writes a GIF89a with the
 * standard LZW coder. No library: a dependency would be one more thing the
 * page downloads.
 *
 * QUALITY (Remy, 2026-11-04: "the GIF captures are terrible quality"). The
 * first version was 480 px at 10 fps, gave every frame its own 256-color
 * palette (so colors jumped from frame to frame) and had no dithering (so the
 * sky and other soft gradients showed hard bands). This version:
 * - builds ONE palette from samples of all frames, so a color stays the same
 *   color for the whole clip;
 * - uses ordered (Bayer 8x8) dithering, which softens bands and, unlike error
 *   diffusion, gives the same pattern on a still pixel in every frame, so the
 *   picture does not shimmer;
 * - writes a pixel that did not change since the previous frame as
 *   transparent, so a mostly still view stays small at the larger size.
 *
 * WHAT IT IS NOT. It is not a measurement. The capture costs a readback per
 * tick on the main thread, so the frame times during a capture are not a
 * reading of the scene; the panel says so while it runs.
 */

export interface GifCaptureOptions {
  /** How long to record, seconds. */
  readonly seconds: number;
  /** Frames per second in the file (the page may draw faster; frames are dropped to this rate). */
  readonly fps: number;
  /** The widest the frames are written; the height follows the canvas's aspect. */
  readonly maxWidth: number;
  /** Called after each captured frame with the count so far, for a countdown. */
  readonly onFrame?: (frames: number, totalFrames: number) => void;
}

/** 2026-11-04: was { seconds: 5, fps: 10, maxWidth: 480 }. */
export const GIF_CAPTURE_DEFAULTS: GifCaptureOptions = { seconds: 5, fps: 15, maxWidth: 800 };

/** The frames read off the canvas, before encoding. */
export interface RawFrame {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** Palette index 255 is kept free: it marks "unchanged since the last frame". */
export const GIF_TRANSPARENT_INDEX = 255;
const MAX_PALETTE_COLORS = 255;

/**
 * Record the canvas for the given time and return the GIF bytes. Rejects when
 * the element is not a canvas that can be drawn (a detached or zero-size one).
 */
export async function captureCanvasGif(canvas: HTMLCanvasElement, options: GifCaptureOptions = GIF_CAPTURE_DEFAULTS): Promise<Blob> {
  if (!(canvas instanceof HTMLCanvasElement) || canvas.width === 0 || canvas.height === 0) {
    throw new Error('The tracked surface is not a canvas with a size, so there is nothing to capture.');
  }
  const scale = Math.min(1, options.maxWidth / canvas.width);
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No 2D context for the capture canvas.');
  // The default downscale filter is the browser's fastest one; it aliases thin
  // lines and text. The capture can afford the better filter.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const totalFrames = Math.max(1, Math.round(options.seconds * options.fps));
  const intervalMs = 1000 / options.fps;
  const frames: RawFrame[] = [];
  // A wall-clock cap: a page whose main thread is busy (a shader build, a
  // stopped surface) delivers animation frames slowly or not at all, and a
  // capture that waits for its frame count would hold the button forever.
  // After three times the asked length it ends with the frames it has.
  const capMs = options.seconds * 1000 * 3;
  await new Promise<void>((resolve) => {
    const start = performance.now();
    let next = start;
    const tick = (now: number) => {
      if (now >= next) {
        next += intervalMs;
        // The frame last presented by the page's own renderer. A WebGPU canvas
        // keeps it until the next present, so a draw here reads the latest one.
        ctx.drawImage(canvas, 0, 0, w, h);
        frames.push({ data: ctx.getImageData(0, 0, w, h).data, width: w, height: h });
        options.onFrame?.(frames.length, totalFrames);
        if (frames.length >= totalFrames) { resolve(); return; }
      }
      if (now - start >= capMs && frames.length > 0) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const bytes = encodeGif(frames, Math.round(intervalMs / 10));
  // A copy into its own ArrayBuffer: the encoder's result is a view on a larger buffer.
  const owned = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([owned], { type: 'image/gif' });
}

/** Hand a blob to the browser as a download. The name carries the surface and the time. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Palette: one median-cut palette over samples of every frame.
// ---------------------------------------------------------------------------

/** A sampled pixel, packed as 0xRRGGBB. */
type Packed = number;
const R = (c: Packed) => (c >> 16) & 0xff;
const G = (c: Packed) => (c >> 8) & 0xff;
const B = (c: Packed) => c & 0xff;

/**
 * Median cut over pixels sampled from all `frames` (about 60 000 in total),
 * at most `maxColors` entries. Returns a 256-entry RGB table (unused entries
 * black) and the number of colors in use.
 */
export function buildPalette(frames: readonly RawFrame[], maxColors = MAX_PALETTE_COLORS): { palette: Uint8Array; count: number } {
  const sample: Packed[] = [];
  const perFrame = Math.max(1, Math.floor(60000 / Math.max(1, frames.length)));
  for (const { data, width, height } of frames) {
    const n = width * height;
    const step = Math.max(1, Math.floor(n / perFrame));
    for (let i = 0; i < n; i += step) sample.push((data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2]);
  }

  let boxes: Packed[][] = [sample];
  while (boxes.length < maxColors) {
    // Split the box with the largest color range along its widest channel.
    let best = -1;
    let bestRange = 1; // a box with range 0 or 1 cannot split further
    let bestChannel = 0;
    for (let k = 0; k < boxes.length; k += 1) {
      const bx = boxes[k];
      if (bx.length < 2) continue;
      let r0 = 255, g0 = 255, b0 = 255, r1 = 0, g1 = 0, b1 = 0;
      for (let j = 0; j < bx.length; j += 1) {
        const c = bx[j];
        const r = R(c), g = G(c), b = B(c);
        if (r < r0) r0 = r; if (r > r1) r1 = r;
        if (g < g0) g0 = g; if (g > g1) g1 = g;
        if (b < b0) b0 = b; if (b > b1) b1 = b;
      }
      const ranges = [r1 - r0, g1 - g0, b1 - b0];
      for (let ch = 0; ch < 3; ch += 1) {
        if (ranges[ch] > bestRange) { bestRange = ranges[ch]; best = k; bestChannel = ch; }
      }
    }
    if (best < 0) break;
    const key = bestChannel === 0 ? R : bestChannel === 1 ? G : B;
    const sorted = boxes[best].slice().sort((p, q) => key(p) - key(q));
    const mid = sorted.length >> 1;
    boxes.splice(best, 1, sorted.slice(0, mid), sorted.slice(mid));
  }
  boxes = boxes.filter((bx) => bx.length > 0);

  const palette = new Uint8Array(256 * 3);
  for (let k = 0; k < boxes.length; k += 1) {
    const bx = boxes[k];
    let sr = 0, sg = 0, sb = 0;
    for (let j = 0; j < bx.length; j += 1) { sr += R(bx[j]); sg += G(bx[j]); sb += B(bx[j]); }
    palette[k * 3] = Math.round(sr / bx.length);
    palette[k * 3 + 1] = Math.round(sg / bx.length);
    palette[k * 3 + 2] = Math.round(sb / bx.length);
  }
  return { palette, count: Math.max(1, boxes.length) };
}

// The 8x8 Bayer matrix, as thresholds centered on zero (-0.5 .. +0.5).
const BAYER8 = (() => {
  const m = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
  ];
  return Float32Array.from(m, (v) => (v + 0.5) / 64 - 0.5);
})();
/** Dither amplitude in 0..255 units: about one palette step for a 255-color clip. */
const DITHER_STRENGTH = 18;

/**
 * Map one frame to palette indices. With `dither`, each pixel gets the fixed
 * Bayer offset of its position first, so a still pixel maps the same way in
 * every frame. A cache keyed on the 18-bit color (6 bits a channel) keeps the
 * nearest search fast. The search uses the key's own center color, not the
 * first pixel that filled the key, so a pixel's index never depends on which
 * pixels came before it: an unchanged pixel stays unchanged between frames.
 */
export function mapFrame(frame: RawFrame, palette: Uint8Array, count: number, dither = true,
  cache: Int16Array = newColorCache()): Uint8Array {
  const { data, width, height } = frame;
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const t = dither ? BAYER8[((y & 7) << 3) | (x & 7)] * DITHER_STRENGTH : 0;
      const cr = Math.min(255, Math.max(0, data[i * 4] + t));
      const cg = Math.min(255, Math.max(0, data[i * 4 + 1] + t));
      const cb = Math.min(255, Math.max(0, data[i * 4 + 2] + t));
      const qr = cr >> 2, qg = cg >> 2, qb = cb >> 2;
      const key = (qr << 12) | (qg << 6) | qb;
      let best = cache[key];
      if (best < 0) {
        const mr = (qr << 2) + 2, mg = (qg << 2) + 2, mb = (qb << 2) + 2; // the key's center color
        let bestD = Infinity;
        best = 0;
        for (let k = 0; k < count; k += 1) {
          const dr = mr - palette[k * 3], dg = mg - palette[k * 3 + 1], db = mb - palette[k * 3 + 2];
          const d = dr * dr * 2 + dg * dg * 4 + db * db * 3; // weighted toward the eye's green sensitivity
          if (d < bestD) { bestD = d; best = k; }
        }
        cache[key] = best;
      }
      indices[i] = best;
    }
  }
  return indices;
}

/** An empty nearest-color cache. Share one across frames that use the same palette. */
export function newColorCache(): Int16Array {
  return new Int16Array(1 << 18).fill(-1);
}

/** A single frame's own palette and plain nearest-color indices (no dither). */
export function quantizeFrame(frame: RawFrame, maxColors = MAX_PALETTE_COLORS): { palette: Uint8Array; indices: Uint8Array } {
  const { palette, count } = buildPalette([frame], maxColors);
  return { palette, indices: mapFrame(frame, palette, count, false) };
}

// ---------------------------------------------------------------------------
// GIF89a writer: one global color table, one LZW image block per frame.
// ---------------------------------------------------------------------------

class ByteSink {
  private buf = new Uint8Array(1 << 16);
  private len = 0;
  byte(v: number): void { this.ensure(1); this.buf[this.len++] = v & 0xff; }
  short(v: number): void { this.byte(v & 0xff); this.byte((v >> 8) & 0xff); }
  bytes(a: ArrayLike<number>): void { this.ensure(a.length); this.buf.set(a, this.len); this.len += a.length; }
  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  result(): Uint8Array { return this.buf.subarray(0, this.len); }
}

/**
 * Encode frames as an animated GIF that loops; `delayCs` is the frame delay in
 * hundredths of a second. All frames share one palette. After the first frame,
 * a pixel whose index did not change is written as GIF_TRANSPARENT_INDEX and
 * the frame keeps the previous one underneath (disposal "do not dispose").
 */
export function encodeGif(frames: readonly RawFrame[], delayCs: number): Uint8Array {
  const out = new ByteSink();
  const { width, height } = frames[0];
  const { palette, count } = buildPalette(frames);
  out.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  out.short(width);
  out.short(height);
  out.byte(0xf7); // global table present, 8-bit color resolution, 2^(7+1) = 256 entries
  out.byte(0); // background color index
  out.byte(0); // no pixel aspect ratio
  out.bytes(palette);
  // Netscape loop extension: loop forever.
  out.bytes([0x21, 0xff, 0x0b]);
  out.bytes([0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30]);
  out.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);
  let previous: Uint8Array | null = null;
  const cache = newColorCache(); // one palette, so one cache for the whole clip
  for (const frame of frames) {
    const indices = mapFrame(frame, palette, count, true, cache);
    let written = indices;
    if (previous) {
      written = new Uint8Array(indices.length);
      for (let i = 0; i < indices.length; i += 1) {
        written[i] = indices[i] === previous[i] ? GIF_TRANSPARENT_INDEX : indices[i];
      }
    }
    // Graphic control extension: disposal 1 (keep this frame for the next),
    // the transparency flag after the first frame, the delay, the clear index.
    out.bytes([0x21, 0xf9, 0x04, (1 << 2) | (previous ? 1 : 0)]);
    out.short(delayCs);
    out.bytes([GIF_TRANSPARENT_INDEX, 0x00]);
    // Image descriptor: the whole frame, no local table.
    out.byte(0x2c);
    out.short(0); out.short(0);
    out.short(frame.width); out.short(frame.height);
    out.byte(0x00);
    out.byte(8); // LZW minimum code size
    lzwEncode(written, 8, out);
    out.byte(0); // block terminator
    previous = indices;
  }
  out.byte(0x3b); // trailer
  return out.result();
}

/** The GIF variable-code-size LZW encoder, written in 255-byte sub-blocks. */
function lzwEncode(pixels: Uint8Array, minCodeSize: number, out: ByteSink): void {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<number, number>();
  const block: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;
  const flush = () => { out.byte(block.length); out.bytes(block); block.length = 0; };
  const emit = (code: number) => {
    bitBuf |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      block.push(bitBuf & 0xff);
      bitBuf >>>= 8;
      bitCount -= 8;
      if (block.length === 255) flush();
    }
  };
  emit(clearCode);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i += 1) {
    const c = pixels[i];
    const key = (prefix << 8) | c;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    if (nextCode < 4096) {
      dict.set(key, nextCode);
      nextCode += 1;
      if (nextCode > (1 << codeSize) && codeSize < 12) codeSize += 1;
    } else {
      emit(clearCode);
      dict = new Map();
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    }
    prefix = c;
  }
  emit(prefix);
  emit(eoiCode);
  if (bitCount > 0) { block.push(bitBuf & 0xff); if (block.length === 255) flush(); }
  if (block.length) flush();
}
