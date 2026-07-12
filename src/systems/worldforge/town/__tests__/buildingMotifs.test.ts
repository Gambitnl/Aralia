/**
 * These tests prove that exterior motifs make roles and cultures recognizable
 * while still behaving like a district vocabulary rather than per-house noise.
 */
import { describe, expect, it } from 'vitest';
import type { BuildingType } from '../../interior/blueprintTypes';
import {
  BUILDING_MOTIF_PROGRAMS,
  resolveBuildingMotifs,
} from '../buildingMotifs';

const BUILDING_TYPES: BuildingType[] = [
  'cottage', 'townhouse', 'tenement', 'farmstead',
  'shop', 'smithy', 'workshop', 'inn', 'tavern', 'storehouse',
  'manor', 'temple', 'keep', 'civic',
];

describe('building motif programs', () => {
  it('covers every building type with at least one resolved exterior cue', () => {
    expect(Object.keys(BUILDING_MOTIF_PROGRAMS).sort()).toEqual([...BUILDING_TYPES].sort());
    for (const type of BUILDING_TYPES) {
      const resolved = resolveBuildingMotifs('temperateFrame', type, 'district:a', 'building:1');
      expect(resolved.motifs.length, type).toBeGreaterThan(0);
    }
  });

  it('keeps load-bearing recognition cues on major roles', () => {
    const resolve = (type: BuildingType) =>
      resolveBuildingMotifs('temperateFrame', type, 'district:a', 'building:1').motifs;

    expect(resolve('shop')).toContain('hanging-sign');
    expect(resolve('smithy')).toContain('vent-stack');
    expect(resolve('workshop')).toContain('loading-hoist');
    expect(resolve('farmstead')).toContain('side-shed');
    expect(resolve('temple')).toContain('bell-cote');
    expect(resolve('keep')).toContain('battlements');
  });

  it('adds recognizable culture accents without changing building type', () => {
    expect(resolveBuildingMotifs('roughLog', 'cottage', 'd', 'b').motifs)
      .toContain('log-porch');
    expect(resolveBuildingMotifs('riverHalfTimber', 'shop', 'd', 'b').motifs)
      .toContain('jettied-bay');
    expect(resolveBuildingMotifs('coastalTimber', 'inn', 'd', 'b').motifs)
      .toContain('covered-gallery');
    expect(resolveBuildingMotifs('highlandStone', 'temple', 'd', 'b').motifs)
      .toContain('buttresses');
    expect(resolveBuildingMotifs('temperateFrame', 'townhouse', 'd', 'b').motifs)
      .toContain('bay-window');
  });

  it('keeps one district/type signature with a dominant plus one alternate treatment', () => {
    const variants = Array.from({ length: 120 }, (_, index) =>
      resolveBuildingMotifs('coastalTimber', 'shop', 'district:harbor', `building:${index}`));

    expect(new Set(variants.map((variant) => variant.motifSignature)).size).toBe(1);
    expect(new Set(variants.map((variant) => variant.motifs.join('|'))).size).toBe(2);
    expect(new Set(variants.map((variant) => variant.motifVariant))).toEqual(new Set([0, 1, 2]));

    const motifSets = variants.map((variant) => variant.motifs.join('|'));
    const counts = motifSets.reduce<Record<string, number>>((tally, value) => {
      tally[value] = (tally[value] ?? 0) + 1;
      return tally;
    }, {});
    expect(Math.max(...Object.values(counts)) / variants.length).toBeGreaterThan(0.65);
  });

  it('gives visibly different roles different motif programs', () => {
    const signature = (type: BuildingType) =>
      resolveBuildingMotifs('temperateFrame', type, 'district:a', 'building:1').motifs.join('|');
    expect(new Set([
      signature('shop'),
      signature('smithy'),
      signature('farmstead'),
      signature('temple'),
      signature('keep'),
    ]).size).toBe(5);
  });
});
