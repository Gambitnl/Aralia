/**
 * @file perfGif.test.ts — the GIF writer behind the panel's "capture GIF" button:
 * a valid GIF89a container, a palette no larger than 256 colors, and an LZW
 * stream that a decoder reads back to the same indices.
 */
import { describe, expect, it } from 'vitest';
import { encodeGif, quantizeFrame } from '../perfGif';

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

describe('perfGif', () => {
  it('quantizes to at most 256 colors and keeps a flat frame exact', () => {
    const f = frame(8, 8, () => [10, 200, 30]);
    const { palette, indices } = quantizeFrame(f);
    expect(Array.from(new Set(indices)).length).toBe(1);
    expect([palette[0], palette[1], palette[2]]).toEqual([10, 200, 30]);
  });

  it('writes a GIF89a that loops and decodes back to the frame indices', () => {
    const f1 = frame(16, 8, (x) => [x * 16, 0, 255 - x * 16]);
    const f2 = frame(16, 8, (x, y) => [0, y * 30, x * 10]);
    const bytes = encodeGif([f1, f2], 10);
    expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe('GIF89a');
    expect(bytes[6] | (bytes[7] << 8)).toBe(16);
    expect(bytes[8] | (bytes[9] << 8)).toBe(8);
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    // The first image descriptor follows the 13-byte header and the 19-byte loop extension.
    let p = 13 + 19;
    expect(bytes[p]).toBe(0x21); // graphic control extension
    expect(bytes[p + 4] | (bytes[p + 5] << 8)).toBe(10); // the delay
    p += 8;
    expect(bytes[p]).toBe(0x2c);
    expect(bytes[p + 9]).toBe(0x87);
    const paletteStart = p + 10;
    const minCodeSize = bytes[paletteStart + 768];
    expect(minCodeSize).toBe(8);
    const { indices } = lzwDecode(bytes, paletteStart + 769, minCodeSize, 16 * 8);
    const expected = quantizeFrame(f1).indices;
    expect(indices.length).toBe(128);
    expect(indices).toEqual(Array.from(expected));
  });
});
