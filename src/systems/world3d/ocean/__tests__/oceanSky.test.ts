/**
 * oceanSky.test.ts — the CPU half of the baked sky: the billow volume the
 * cloud march erodes its coverage with.
 *
 * The GPU bake itself is proved by the captures (it is a picture); what can
 * be proved here is that the volume the bake reads is deterministic, sits
 * where the erosion thresholds assume, and tiles, since the march reads
 * it with a repeat wrap over tens of kilometers and a seam would print a
 * straight edge through every cloud it crosses.
 */
import { describe, expect, it } from 'vitest';
import { cloudPuffVolume } from '../oceanSky';

const N = 32;

describe('cloudPuffVolume', () => {
  it('is the same volume for the same seed, and a different one for another seed', () => {
    const a = cloudPuffVolume(N, 0x5eed);
    const b = cloudPuffVolume(N, 0x5eed);
    const c = cloudPuffVolume(N, 0x5eee);
    expect(a).toEqual(b);
    let differ = 0;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== c[i]) differ += 1;
    expect(differ / a.length).toBeGreaterThan(0.5);
  });

  it('puts the lower erosion threshold (0.35) inside its bulk, with a wide spread', () => {
    const v = Array.from(cloudPuffVolume(N)).sort((x, y) => x - y);
    const q = (p: number) => v[Math.floor(v.length * p)] / 255;
    // Measured at 64^3: p10 0.33, p50 0.48, p90 0.64, p99 0.75. The erosion
    // eats a cloud's outline where the volume is under 0.35, so that edge
    // must fall between the tenth percentile and the median: some of every
    // outline goes, most stays. The upper threshold, 0.85, sits above the
    // 99th percentile, so no point escapes erosion entirely; the cloud look
    // was tuned with that, and this pins it.
    expect(q(0.1)).toBeLessThan(0.35);
    expect(q(0.5)).toBeGreaterThan(0.35);
    expect(q(0.9) - q(0.1)).toBeGreaterThan(0.2);
    expect(q(0.99)).toBeLessThan(0.85);
  });

  it('tiles: a face and the opposite face differ no more than two neighbor slices do', () => {
    const v = cloudPuffVolume(N);
    const at = (x: number, y: number, z: number) => v[(z * N + y) * N + x];
    let seam = 0;
    let inner = 0;
    for (let z = 0; z < N; z += 1) {
      for (let y = 0; y < N; y += 1) {
        seam += Math.abs(at(N - 1, y, z) - at(0, y, z));
        inner += Math.abs(at(N / 2, y, z) - at(N / 2 - 1, y, z));
      }
    }
    // The wrap step is one texel like any other step; 1.5 times the inner
    // mean leaves room for sampling noise and still fails a real seam, which
    // measures several times the inner step.
    expect(seam).toBeLessThan(inner * 1.5);
  });
});
