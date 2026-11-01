/** The warm-start file (2026-10-24): a saved steady run loads exactly onto the
 * same river and is refused, with a reason, on a changed one. The original
 * reach stands in for the seven-falls course, whose 5.9 M cells take a minute. */
import { describe, expect, it } from 'vitest';
import { LiveRiver, bedChecksum, encodeRiverWarmState } from '../riverLive';
import { setRiverHeadwaters } from '../riverHeadwaters';
import { setRiverShape } from '../riverReach';

describe('river warm start', () => {
  it('loads a saved river exactly and refuses a changed bed', () => {
    try {
      const a = new LiveRiver(20260928);
      a.startCold();
      a.advance(Infinity, 2);
      const s = (a as unknown as { solver: { h: Float64Array; hu: Float64Array; hv: Float64Array; bed: Float64Array } }).solver;
      const bytes = encodeRiverWarmState({ simTime: a.simTime, cells: 0, n: s.h.length, bedSum: bedChecksum(s.bed) }, s.h, s.hu, s.hv);
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

      const b = new LiveRiver(20260928);
      expect(b.startWarm(buf)).toBeNull();
      const t = (b as unknown as { solver: { h: Float64Array; hu: Float64Array } }).solver;
      let wet = 0;
      for (let c = 0; c < s.h.length; c++) {
        expect(t.h[c]).toBe(Math.fround(s.h[c]));
        if (s.h[c] > 0) { wet++; expect(t.hu[c]).toBeCloseTo(s.hu[c], 4); }
      }
      expect(wet).toBeGreaterThan(1000);

      const c = new LiveRiver(20260928);
      (c as unknown as { solver: { bed: Float64Array } }).solver.bed[12345] += 0.01;
      expect(c.startWarm(buf)).toMatch(/bed changed/);
      expect(new LiveRiver(20260928).startWarm(buf.slice(0, buf.byteLength - 4))).toMatch(/cut short/);
    } finally { setRiverHeadwaters(false); setRiverShape(null); }
  }, 120000);
});
