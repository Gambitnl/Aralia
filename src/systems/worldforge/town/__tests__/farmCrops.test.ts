/**
 * This file proves a farmstead's crop is an identity and not a decoration: one
 * farm grows exactly one crop, it grows the same one every time the town is
 * generated, two farms in one town can grow different things, and the field a
 * farm works carries what that farm grows.
 */
import { describe, it, expect } from 'vitest';
import { makeSeedPath } from '../../seedPath';
import {
  assignFarmCrops,
  cropForFarmstead,
  FARM_CROPS,
  type CropFarmstead,
  type CropParcel,
  type Pt,
} from '../farmCrops';

const SEED = makeSeedPath(4711, 'cell:12-3', 'burg:7');

/** A square parcel of side `s` centered on (cx, cy). */
function square(cx: number, cy: number, s = 40): Pt[] {
  const h = s / 2;
  return [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]];
}

function farms(n: number): CropFarmstead[] {
  const out: CropFarmstead[] = [];
  for (let i = 0; i < n; i++) out.push({ id: `f${i}`, x: i * 100, y: 0 });
  return out;
}

describe('cropForFarmstead', () => {
  it('gives a farmstead one crop from the vocabulary, the same one every time', () => {
    const crop = cropForFarmstead(SEED, 'f3');
    expect(FARM_CROPS).toContain(crop);
    expect(cropForFarmstead(SEED, 'f3')).toBe(crop);
  });

  it('is the town seed that decides, not the run', () => {
    const other = makeSeedPath(4711, 'cell:12-3', 'burg:8');
    const a = FARM_CROPS.map(() => 0);
    let differs = false;
    for (let i = 0; i < 40; i++) {
      if (cropForFarmstead(SEED, `f${i}`) !== cropForFarmstead(other, `f${i}`)) differs = true;
      a[FARM_CROPS.indexOf(cropForFarmstead(SEED, `f${i}`))]++;
    }
    expect(differs).toBe(true);
    // Every crop in the vocabulary is reachable across one town's farms.
    expect(a.every((n) => n > 0)).toBe(true);
  });

  it('keeps a farm on its crop when its neighbours change', () => {
    const before = cropForFarmstead(SEED, 'f9');
    // Nothing about the call depends on how many other farmsteads exist.
    expect(cropForFarmstead(SEED, 'f9')).toBe(before);
    expect(cropForFarmstead(SEED, 'f10')).not.toBe(undefined);
    expect(cropForFarmstead(SEED, 'f9')).toBe(before);
  });
});

describe('assignFarmCrops', () => {
  const parcels: CropParcel[] = [
    { polygon: square(0, 0), kind: 'farm' },
    { polygon: square(100, 0), kind: 'farm' },
    { polygon: square(200, 0), kind: 'pasture' },
    { polygon: square(300, 0), kind: 'farm' },
  ];

  it('gives every farmstead exactly one crop', () => {
    const { cropByFarmstead } = assignFarmCrops(SEED, farms(6), parcels);
    expect(cropByFarmstead.size).toBe(6);
    for (const crop of cropByFarmstead.values()) expect(FARM_CROPS).toContain(crop);
  });

  it('carries a farmstead crop onto the nearest farm parcel, never a pasture', () => {
    const { cropByFarmstead, cropByParcel } = assignFarmCrops(SEED, farms(2), parcels);
    expect(cropByParcel.get(0)).toBe(cropByFarmstead.get('f0'));
    expect(cropByParcel.get(1)).toBe(cropByFarmstead.get('f1'));
    expect(cropByParcel.has(2)).toBe(false); // pasture
    expect(cropByParcel.has(3)).toBe(false); // no farmstead works it
  });

  it('is stable for one seed path, whatever order the farmsteads arrive in', () => {
    const all = farms(5);
    const a = assignFarmCrops(SEED, all, parcels);
    const b = assignFarmCrops(SEED, [...all].reverse(), parcels);
    expect([...b.cropByFarmstead.entries()].sort()).toEqual([...a.cropByFarmstead.entries()].sort());
    expect([...b.cropByParcel.entries()].sort()).toEqual([...a.cropByParcel.entries()].sort());
  });

  it('lets two farmsteads in one town grow different crops', () => {
    const { cropByFarmstead } = assignFarmCrops(SEED, farms(20), parcels);
    expect(new Set(cropByFarmstead.values()).size).toBeGreaterThan(1);
  });

  it('leaves a town with no farm parcels holding no cropped field', () => {
    const { cropByFarmstead, cropByParcel } = assignFarmCrops(
      SEED,
      farms(3),
      [{ polygon: square(0, 0), kind: 'scrub' }],
    );
    expect(cropByFarmstead.size).toBe(3);
    expect(cropByParcel.size).toBe(0);
  });
});
