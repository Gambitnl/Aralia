import { describe, it, expect } from 'vitest';
import {
  styleFamilyForCultureType, styledWallColor, styledRoof, styleFrameOf, hash01,
  STYLE_FAMILIES,
} from '../architectureStyle';

describe('architectureStyle', () => {
  it('maps every FMG culture type to a family', () => {
    for (const t of ['Generic', 'River', 'Lake', 'Naval', 'Nomadic', 'Hunting', 'Highland']) {
      expect(styleFamilyForCultureType(t).id).toBeTruthy();
    }
    expect(styleFamilyForCultureType('Highland').id).toBe('highlandStone');
    expect(styleFamilyForCultureType('Naval').id).toBe('coastalTimber');
    expect(styleFamilyForCultureType('Lake').id).toBe('coastalTimber');
    expect(styleFamilyForCultureType('River').id).toBe('riverHalfTimber');
    expect(styleFamilyForCultureType('Hunting').id).toBe('roughLog');
    expect(styleFamilyForCultureType('Generic').id).toBe('temperateFrame');
  });

  it('THROWS on an unknown culture type (no-fallback directive)', () => {
    expect(() => styleFamilyForCultureType('Astral')).toThrow(/no architecture style/i);
  });

  it('every family is fully populated', () => {
    for (const fam of Object.values(STYLE_FAMILIES)) {
      expect(fam.wallPalette.length).toBeGreaterThanOrEqual(2);
      expect(fam.roofPalette.length).toBeGreaterThanOrEqual(1);
      expect(fam.roofForms.length).toBeGreaterThanOrEqual(1);
      expect(fam.gatehouseForms.length).toBeGreaterThanOrEqual(1);
      expect(fam.deckDetail.pilingSpacingM).toBeGreaterThan(0);
    }
  });

  it('per-plot picks are deterministic from the polygon + frame', () => {
    const poly: Array<[number, number]> = [[10, 10], [40, 10], [40, 30], [10, 30]];
    const frame = styleFrameOf([[0, 0], [100, 0], [100, 100], [0, 100]]);
    const fam = styleFamilyForCultureType('River');
    expect(styledWallColor(fam, poly, frame)).toBe(styledWallColor(fam, poly, frame));
    expect(styledRoof(fam, poly, frame)).toEqual(styledRoof(fam, poly, frame));
    expect(fam.wallPalette).toContain(styledWallColor(fam, poly, frame));
  });

  it('picks are invariant under a shared scale+translate of polygon and frame (2D↔3D frames)', () => {
    // The 2D map hashes in the NORMALIZED engine frame; the 3D bake hashes
    // AFTER transformTownPlan scales/translates to region feet. Same affine on
    // polygon AND footprint must yield the same picks.
    const footprint: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const polys: Array<Array<[number, number]>> = [
      [[10, 10], [40, 10], [40, 30], [10, 30]],
      [[55.5, 62.25], [78.5, 62.25], [78.5, 90], [55.5, 90]],
      [[3, 97], [9, 97], [9, 99.5], [3, 99.5]],
    ];
    const k = 3.7, dx = 1234, dy = 567; // deliberately non-integer scale
    const xf = (p: Array<[number, number]>) => p.map(([x, y]) => [x * k + dx, y * k + dy] as [number, number]);
    const frameA = styleFrameOf(footprint);
    const frameB = styleFrameOf(xf(footprint));
    for (const fam of Object.values(STYLE_FAMILIES)) {
      for (const poly of polys) {
        expect(styledWallColor(fam, xf(poly), frameB)).toBe(styledWallColor(fam, poly, frameA));
        expect(styledRoof(fam, xf(poly), frameB)).toEqual(styledRoof(fam, poly, frameA));
      }
    }
  });

  it('hash01 stays in [0,1) and differs across inputs', () => {
    const a = hash01(3, 7), b = hash01(4, 7);
    expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(1);
    expect(a).not.toBe(b);
  });
});
