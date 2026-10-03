/**
 * Guards the part gate's specimen-distinctness check.
 *
 * WHY (2026-08-24): the campaign's rule is that a part passes when a blind
 * reader names it AND its metrics hold on THREE creatures — three because that
 * averages out pose and proportion luck. A hands re-gate passed 3/3 while two of
 * its three specimens were the same mesh at the same scale, so the trio was
 * really two samples and nothing said so. `silhouetteDiff.py` is what says so
 * now, and this file is what stops it from quietly breaking, since the tool it
 * protects had no test either.
 *
 * The test drives the REAL tool through the same `python <script> <dir>` call
 * partGate.mjs makes, so a change to the invocation is caught too.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';

const W = 400;
const H = 400;

/** A black shape on white, written as a PNG the tool will read. */
async function writeShape(dir, name, rects) {
  const px = Buffer.alloc(W * H * 3, 255);
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 3;
        px[i] = 0; px[i + 1] = 0; px[i + 2] = 0;
      }
    }
  }
  await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toFile(join(dir, name));
}

function run(dir) {
  const r = spawnSync('python', [join('tools', 'creatureGate', 'silhouetteDiff.py'), dir], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`silhouetteDiff exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

const pairOf = (rows, a, b) =>
  rows.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));

describe('silhouetteDiff — specimen distinctness', () => {
  let dir;
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sildiff-'));
    // Two IDENTICAL shapes under different labels — the duplicate-pair case
    // that slipped through the hands re-gate.
    await writeShape(dir, 'alpha-hand.png', [[120, 120, 280, 280]]);
    await writeShape(dir, 'beta-hand.png', [[120, 120, 280, 280]]);
    // A genuinely different shape: a bar with two prongs.
    await writeShape(dir, 'gamma-hand.png', [[100, 150, 300, 200], [110, 200, 150, 300], [250, 200, 290, 300]]);
    // A different PART kind entirely — must never be compared against a hand.
    await writeShape(dir, 'delta-foot.png', [[120, 120, 280, 280]]);
  });
  afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('reports near-zero disagreement for two identical specimens', () => {
    const p = pairOf(run(dir), 'alpha-hand', 'beta-hand');
    expect(p).toBeDefined();
    expect(p.disagreement).toBeLessThan(0.01);
  });

  it('reports a large disagreement for genuinely different specimens', () => {
    const rows = run(dir);
    for (const other of ['alpha-hand', 'beta-hand']) {
      const p = pairOf(rows, other, 'gamma-hand');
      expect(p, `${other} vs gamma-hand`).toBeDefined();
      // Far above the 0.10 duplicate threshold partGate.mjs applies.
      expect(p.disagreement).toBeGreaterThan(0.3);
    }
  });

  it('never compares across part kinds — a hand and a foot SHOULD differ', () => {
    const rows = run(dir);
    expect(pairOf(rows, 'alpha-hand', 'delta-foot')).toBeUndefined();
  });

  it('compares SHAPE, not framing — the same shape at another scale is still a duplicate', async () => {
    const scaled = mkdtempSync(join(tmpdir(), 'sildiff-scale-'));
    try {
      // Same square, half the size and off-centre: a camera change, not a
      // different specimen. Normalizing by bounding box must see through it.
      await writeShape(scaled, 'near-hand.png', [[120, 120, 280, 280]]);
      await writeShape(scaled, 'far-hand.png', [[40, 300, 120, 380]]);
      const p = pairOf(run(scaled), 'near-hand', 'far-hand');
      expect(p).toBeDefined();
      expect(p.disagreement).toBeLessThan(0.01);
    } finally {
      rmSync(scaled, { recursive: true, force: true });
    }
  });

  it('emits nothing rather than guessing when a capture has no subject', async () => {
    const blank = mkdtempSync(join(tmpdir(), 'sildiff-blank-'));
    try {
      await writeShape(blank, 'empty-hand.png', []);
      await writeShape(blank, 'solid-hand.png', [[100, 100, 300, 300]]);
      expect(run(blank)).toEqual([]);
    } finally {
      rmSync(blank, { recursive: true, force: true });
    }
  });
});
