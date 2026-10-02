/**
 * The river's shape (the river scene's River shape panel, Remy 2026-09-28).
 *
 * The judged river must not change: the default shape builds the same bed and
 * the same design level as the table alone, before and after another shape is
 * built. A changed shape must change the bed, stay inside the panel's ranges,
 * and carry its flow into the reach.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  RIVER_DISCHARGE_M3S, RIVER_SHAPE_DEFAULT, RIVER_SHAPE_LIMITS, buildRiverReach, clampRiverShape,
  courseKeyAt, designLevelAt, getRiverShape, riverCeilingMarginM, riverShapeKey, setRiverShape,
} from '../riverReach';

afterEach(() => { setRiverShape(null); });

describe('river shape', () => {
  it('keeps the judged river at the default shape', () => {
    setRiverShape(null);
    const a = buildRiverReach();
    expect(getRiverShape()).toBe(RIVER_SHAPE_DEFAULT);
    expect(riverShapeKey(getRiverShape())).toBe('');
    expect(riverCeilingMarginM()).toBe(0.8);
    expect(a.dischargeM3S).toBe(RIVER_DISCHARGE_M3S);
    // The design level's held pools, from the table's own rules.
    expect(designLevelAt(110)).toBeCloseTo(2.25, 9);
    expect(designLevelAt(200)).toBeCloseTo(1.2, 9);

    setRiverShape({ widthScale: 1.3, depthScale: 1.4, dischargeM3S: 4 });
    const b = buildRiverReach();
    expect(b.dischargeM3S).toBe(4);
    expect(courseKeyAt(50).halfW).toBeCloseTo(12 * 1.3, 9);

    setRiverShape(null);
    const c = buildRiverReach();
    // Bit for bit, after another shape was built.
    expect(Buffer.from(c.bed.buffer).equals(Buffer.from(a.bed.buffer))).toBe(true);
    expect(Buffer.from(b.bed.buffer).equals(Buffer.from(a.bed.buffer))).toBe(false);
  }, 30000);

  it('clamps a shape to the panel ranges and reads a bad number as the default', () => {
    const s = clampRiverShape({ widthScale: 9, depthScale: -1, dischargeM3S: Number.NaN });
    expect(s.widthScale).toBe(RIVER_SHAPE_LIMITS.widthScale[1]);
    expect(s.depthScale).toBe(RIVER_SHAPE_LIMITS.depthScale[0]);
    expect(s.dischargeM3S).toBe(RIVER_DISCHARGE_M3S);
    expect(clampRiverShape({})).toBe(RIVER_SHAPE_DEFAULT);
  });

  it('deepens the bed under the bank top and raises the flow ceiling for a changed shape', () => {
    setRiverShape({ depthScale: 2 });
    const k = courseKeyAt(50);
    // The table at s = 50: bank top 4.4 m, thalweg 3.35 m (1.05 m deep).
    expect(k.bankTop - k.thalweg).toBeCloseTo(2.1, 9);
    expect(riverCeilingMarginM()).toBeGreaterThan(0.8);
  });
});
