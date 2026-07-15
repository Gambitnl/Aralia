/** These tests keep detached parcel vocabulary coherent and fit-aware. */
import { describe, expect, it } from 'vitest';
import {
  detachedCompoundProfile,
  detachedEnvelopeSize,
  detachedParcelInsets,
  detachedParcelProfile,
} from '../detachedParcels';

describe('detached parcel negotiation', () => {
  it('gives one district a dominant setback with bounded side-yard exceptions', () => {
    const profiles = Array.from({ length: 80 }, (_, index) =>
      detachedParcelProfile('district:orchard', `lot:${index}`));
    const counts = new Map<string, number>();
    for (const profile of profiles) counts.set(profile, (counts.get(profile) ?? 0) + 1);

    expect(Math.max(...counts.values())).toBeGreaterThanOrEqual(55);
    expect(counts.size).toBeLessThanOrEqual(3);
    expect(profiles).toEqual(Array.from({ length: 80 }, (_, index) =>
      detachedParcelProfile('district:orchard', `lot:${index}`)));
  });

  it('retains distinct lane, garden, and handed side-yard envelopes', () => {
    const lane = detachedEnvelopeSize(20, 20, 'lane-setback');
    const garden = detachedEnvelopeSize(20, 20, 'garden-setback');
    expect(lane.width).toBeCloseTo(16.8, 8);
    expect(lane.depth).toBeCloseTo(16, 8);
    expect(garden.width).toBeCloseTo(17.6, 8);
    expect(garden.depth).toBeCloseTo(15, 8);
    expect(detachedEnvelopeSize(20, 20, 'left-side-yard'))
      .toEqual(detachedEnvelopeSize(20, 20, 'right-side-yard'));
    expect(detachedParcelInsets('left-side-yard').left)
      .toBe(detachedParcelInsets('right-side-yard').right);
    expect(detachedParcelInsets('left-side-yard').left)
      .not.toBe(detachedParcelInsets('right-side-yard').left);
  });

  it('authors compounds only when the retained envelope supports a 3x3 grid', () => {
    expect(detachedCompoundProfile(14, 14, 'lane-setback', 'small'))
      .toBeUndefined();
    expect(detachedCompoundProfile(24, 24, 'left-side-yard', 'large'))
      .toMatch(/envelope|return|court/);
  });
});
