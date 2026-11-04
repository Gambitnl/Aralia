/**
 * @file perfGif.test.ts — the GIF writer behind the panel's "capture GIF" button:
 * a valid GIF89a container, one shared palette of at most 255 colors, an LZW
 * stream that a decoder reads back, transparent "unchanged" pixels after the
 * first frame, and a still pixel that keeps its color across frames.
 */
import { describe, expect, it } from 'vitest';
import { buildPalette, encodeGif, GIF_CAPTURE_DEFAULTS, GIF_TRANSPARENT_INDEX, mapFrame, quantizeFrame } from '../perfGif';

function frame(width: number, height: number, fill: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

/** A plain GIF LZW decoder for the test: reads one image's sub-blocks back to indices. */
function lzwDecode(bytes: Uint8Array, start: number, minCodeSize: number, count: number): { indices: number[]; end: number } {
  const blocks: number[] = [];
  let p = start;
  while (bytes[p] !== 0) { const n = bytes[p]; for (let i = 0; i < n; i += 1) blocks.push(bytes[p + 1 + i]); p += n + 1; }
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  const resetDict = () => { dict = []; for (let i = 0; i < clear; i += 1) dict.push([i]); dict.push([]); dict.push([]); codeSize = minCodeSize + 1; };
  resetDict();
  const out: number[] = [];
  let bitPos = 0;
  const read = () => { let v = 0; for (let i = 0; i < codeSize; i += 1) { const byte = blocks[(bitPos + i) >> 3]; v |= ((byte >> ((bitPos + i) & 7)) & 1) << i; } bitPos += codeSize; return v; };
  let prev: number[] | null = null;
  while (out.length < count) {
    const code = read();
    if (code === clear) { resetDict(); prev = null; continue; }
    if (code === eoi) break;
    let entry: number[];
    if (code < dict.length) { entry = dict[code]; if (prev) dict.push([...prev, entry[0]]); }
    else { if (!prev) throw new Error('bad code'); entry = [...prev, prev[0]]; dict.push(entry); }
    out.push(...entry);
    prev = entry;
    if (dict.length === (1 << codeSize) && codeSize < 12) codeSize += 1;
  }
  return { indices: out, end: p + 1 };
}

/** Read the whole file: the global palette and each frame's control and indices. */
function decodeGif(bytes: Uint8Array) {
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  expect(bytes[10]).toBe(0xf7); // global table of 256 entries
  const palette = bytes.subarray(13, 13 + 768);
  let p = 13 + 768;
  const frames: { packed: number; delay: number; transparent: number; indices: number[] }[] = [];
  let control = { packed: 0, delay: 0, transparent: 0 };
  while (bytes[p] !== 0x3b) {
    if (bytes[p] === 0x21 && bytes[p + 1] === 0xff) { p += 3 + bytes[p + 2]; while (bytes[p] !== 0) p += bytes[p] + 1; p += 1; continue; }
    if (bytes[p] === 0x21 && bytes[p + 1] === 0xf9) {
      control = { packed: bytes[p + 3], delay: bytes[p + 4] | (bytes[p + 5] << 8), transparent: bytes[p + 6] };
      p += 8; continue;
    }
    expect(bytes[p]).toBe(0x2c);
    expect(bytes[p + 9]).toBe(0x00); // no local table: one palette for the clip
    const minCodeSize = bytes[p + 10];
    const { indices, end } = lzwDecode(bytes, p + 11, minCodeSize, width * height);
    frames.push({ ...control, indices });
    p = end;
  }
  return { width, height, palette, frames };
}

describe('perfGif', () => {
  it('quantizes to at most 255 colors and keeps a flat frame exact', () => {
    const f = frame(8, 8, () => [10, 200, 30]);
    const { palette, indices } = quantizeFrame(f);
    expect(Array.from(new Set(indices)).length).toBe(1);
    expect([palette[0], palette[1], palette[2]]).toEqual([10, 200, 30]);
    // Dithering a flat frame against its own one-color palette changes nothing.
    const { palette: shared, count } = buildPalette([f]);
    expect(new Set(mapFrame(f, shared, count)).size).toBe(1);
  });

  it('keeps index 255 free for the "unchanged" marker', () => {
    const noisy = frame(64, 64, (x, y) => [(x * 37 + y * 11) & 255, (x * 5 + y * 53) & 255, (x * 91 + y * 7) & 255]);
    const { count } = buildPalette([noisy]);
    expect(count).toBeLessThanOrEqual(255);
    expect(Array.from(mapFrame(noisy, buildPalette([noisy]).palette, count)).every((i) => i < GIF_TRANSPARENT_INDEX)).toBe(true);
  });

  it('writes a looping GIF89a with one palette, and a still frame becomes all transparent', () => {
    const f1 = frame(16, 8, (x) => [x * 16, 0, 255 - x * 16]);
    const bytes = encodeGif([f1, f1], 10);
    expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe('GIF89a');
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    const gif = decodeGif(bytes);
    expect([gif.width, gif.height]).toEqual([16, 8]);
    expect(gif.frames).toHaveLength(2);
    expect(gif.frames[0].delay).toBe(10);
    expect(gif.frames[0].packed & 1).toBe(0); // the first frame is opaque
    const { palette, count } = buildPalette([f1, f1]);
    expect(gif.frames[0].indices).toEqual(Array.from(mapFrame(f1, palette, count)));
    // Disposal 1 and the transparency flag on the second frame; nothing changed.
    expect(gif.frames[1].packed).toBe((1 << 2) | 1);
    expect(gif.frames[1].transparent).toBe(GIF_TRANSPARENT_INDEX);
    expect(gif.frames[1].indices.every((i) => i === GIF_TRANSPARENT_INDEX)).toBe(true);
  });

  it('writes only the moved pixels, and a still pixel keeps its exact palette color', () => {
    const w = 120, h = 80;
    const sky = (x: number, y: number): [number, number, number] => [40 + y, 90 + y, 160 + Math.round(x / 2)];
    const f1 = frame(w, h, sky);
    // A 10 x 10 square moves; everything else stays the same.
    const f2 = frame(w, h, (x, y) => (x >= 50 && x < 60 && y >= 30 && y < 40 ? [250, 40, 20] : sky(x, y)));
    const gif = decodeGif(encodeGif([f1, f2], 7));
    const second = gif.frames[1].indices;
    const changed = second.filter((i) => i !== GIF_TRANSPARENT_INDEX).length;
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThanOrEqual(100);
    // A pixel outside the square shows the first frame's color under the transparent one.
    const at = 5 * w + 5;
    expect(second[at]).toBe(GIF_TRANSPARENT_INDEX);
    // The dithered gradient stays close to its source color.
    const k = gif.frames[0].indices[at];
    const [r, g, b] = sky(5, 5);
    expect(Math.abs(gif.palette[k * 3] - r) + Math.abs(gif.palette[k * 3 + 1] - g) + Math.abs(gif.palette[k * 3 + 2] - b)).toBeLessThan(40);
  });

  it('decodes a large noisy frame, through LZW code growth and dictionary resets', () => {
    const w = 200, h = 150;
    const noisy = frame(w, h, (x, y) => [(x * 37 + y * 11) & 255, (x * 5 + y * 53) & 255, (x * 91 + y * 7) & 255]);
    const gif = decodeGif(encodeGif([noisy], 7));
    const { palette, count } = buildPalette([noisy]);
    expect(gif.frames[0].indices).toEqual(Array.from(mapFrame(noisy, palette, count)));
  });

  it('records 5 s at 15 fps, at most 800 px wide', () => {
    expect(GIF_CAPTURE_DEFAULTS).toEqual({ seconds: 5, fps: 15, maxWidth: 800 });
  });
});
