/**
 * @file perfGif.ts — capture a few seconds of a tracked canvas into a GIF file.
 *
 * WHY. Remy asked (2026-10-10) for a "capture GIF" button at the bottom of the
 * performance panel, so a stutter or a visual fault can be handed to someone
 * as one small moving picture, with no screen recorder and no upload. The panel
 * already knows every tracked canvas (`PerfSession.element`), so the capture
 * reads that canvas and nothing else on the page.
 *
 * HOW. For `seconds` at `fps`, each tick draws the session's canvas into an
 * offscreen 2D canvas scaled to at most `maxWidth` wide (a GIF of a full
 * 1600 x 900 frame would be tens of megabytes). `drawImage` of a WebGL or
 * WebGPU canvas reads the frame that was last presented, so the capture runs
 * on `requestAnimationFrame` and takes the frame after the page's own draw.
 * Each frame is quantized to 256 colors with a median-cut palette of its own
 * (a local color table per frame, which the GIF format allows) and written
 * with the standard LZW encoder. No library: the encoder is about a hundred
 * lines, and a dependency would be one more thing the page downloads.
 *
 * WHAT IT IS NOT. It is not a measurement. The capture costs a readback and
 * a quantization per tick on the main thread, so the frame times during a
 * capture are not a reading of the scene; the panel says so while it runs.
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

export const GIF_CAPTURE_DEFAULTS: GifCaptureOptions = { seconds: 5, fps: 10, maxWidth: 480 };

/** The frames read off the canvas, before encoding. */
interface RawFrame {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

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
// Quantization: a median-cut palette of at most 256 colors per frame.
// ---------------------------------------------------------------------------

interface Box { readonly idx: Uint32Array; }

/** Median cut over the frame's pixels (sampled every `step` pixels for speed), then nearest-color indexing. */
export function quantizeFrame(frame: RawFrame, maxColors = 256): { palette: Uint8Array; indices: Uint8Array } {
  const { data, width, height } = frame;
  const n = width * height;
  const step = Math.max(1, Math.floor(n / 20000));
  const sample: number[] = [];
  for (let i = 0; i < n; i += step) sample.push(i);
  const sampleIdx = Uint32Array.from(sample);
  const r = (i: number) => data[i * 4];
  const g = (i: number) => data[i * 4 + 1];
  const b = (i: number) => data[i * 4 + 2];

  let boxes: Box[] = [{ idx: sampleIdx }];
  while (boxes.length < maxColors) {
    // Split the box with the largest color range along its widest channel.
    let best = -1;
    let bestRange = 1; // a box with range 0 or 1 cannot split further
    let bestChannel = 0;
    for (let k = 0; k < boxes.length; k += 1) {
      const bx = boxes[k];
      if (bx.idx.length < 2) continue;
      let mn = [255, 255, 255];
      let mx = [0, 0, 0];
      for (let j = 0; j < bx.idx.length; j += 1) {
        const p = bx.idx[j];
        const c = [r(p), g(p), b(p)];
        for (let ch = 0; ch < 3; ch += 1) { if (c[ch] < mn[ch]) mn[ch] = c[ch]; if (c[ch] > mx[ch]) mx[ch] = c[ch]; }
      }
      for (let ch = 0; ch < 3; ch += 1) {
        const range = mx[ch] - mn[ch];
        if (range > bestRange) { bestRange = range; best = k; bestChannel = ch; }
      }
    }
    if (best < 0) break;
    const bx = boxes[best];
    const key = bestChannel === 0 ? r : bestChannel === 1 ? g : b;
    const sorted = Array.from(bx.idx).sort((p, q) => key(p) - key(q));
    const mid = sorted.length >> 1;
    boxes.splice(best, 1, { idx: Uint32Array.from(sorted.slice(0, mid)) }, { idx: Uint32Array.from(sorted.slice(mid)) });
  }

  const palette = new Uint8Array(256 * 3);
  for (let k = 0; k < boxes.length; k += 1) {
    const bx = boxes[k];
    let sr = 0, sg = 0, sb = 0;
    for (let j = 0; j < bx.idx.length; j += 1) { const p = bx.idx[j]; sr += r(p); sg += g(p); sb += b(p); }
    const cnt = Math.max(1, bx.idx.length);
    palette[k * 3] = Math.round(sr / cnt);
    palette[k * 3 + 1] = Math.round(sg / cnt);
    palette[k * 3 + 2] = Math.round(sb / cnt);
  }

  // Nearest color for every pixel, with a small cache keyed on the 15-bit color.
  const cache = new Int16Array(32768).fill(-1);
  const indices = new Uint8Array(n);
  const count = boxes.length;
  for (let i = 0; i < n; i += 1) {
    const cr = data[i * 4], cg = data[i * 4 + 1], cb = data[i * 4 + 2];
    const key = ((cr >> 3) << 10) | ((cg >> 3) << 5) | (cb >> 3);
    let best = cache[key];
    if (best < 0) {
      let bestD = Infinity;
      best = 0;
      for (let k = 0; k < count; k += 1) {
        const dr = cr - palette[k * 3], dg = cg - palette[k * 3 + 1], db = cb - palette[k * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) { bestD = d; best = k; }
      }
      cache[key] = best;
    }
    indices[i] = best;
  }
  return { palette, indices };
}

// ---------------------------------------------------------------------------
// GIF89a writer: one local color table and one LZW image block per frame.
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

/** Encode frames as an animated GIF that loops; `delayCs` is the frame delay in hundredths of a second. */
export function encodeGif(frames: readonly RawFrame[], delayCs: number): Uint8Array {
  const out = new ByteSink();
  const { width, height } = frames[0];
  out.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  out.short(width);
  out.short(height);
  out.byte(0x00); // no global color table
  out.byte(0);
  out.byte(0);
  // Netscape loop extension: loop forever.
  out.bytes([0x21, 0xff, 0x0b]);
  out.bytes([0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30]);
  out.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);
  for (const frame of frames) {
    const { palette, indices } = quantizeFrame(frame);
    // Graphic control extension: the delay, no transparency.
    out.bytes([0x21, 0xf9, 0x04, 0x00]);
    out.short(delayCs);
    out.bytes([0x00, 0x00]);
    // Image descriptor with a 256-entry local color table.
    out.byte(0x2c);
    out.short(0); out.short(0);
    out.short(frame.width); out.short(frame.height);
    out.byte(0x87); // local table present, 2^(7+1) = 256 entries
    out.bytes(palette);
    out.byte(8); // LZW minimum code size
    lzwEncode(indices, 8, out);
    out.byte(0); // block terminator
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
