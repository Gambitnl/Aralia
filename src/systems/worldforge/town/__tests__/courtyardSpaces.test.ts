/**
 * Shared-courtyard tests prove that a court is a durable district receipt, not
 * merely an ensemble label attached to unrelated interior sheds.
 */
import { describe, expect, it } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { resolveCourtyardSpaces, type CourtyardWardInput } from '../courtyardSpaces';

const courtWard = (wealth: 'poor' | 'common' | 'wealthy' = 'common'): CourtyardWardInput => ({
  block: [[0, 0], [100, 0], [100, 100], [0, 100]],
  wealth,
  architectureDistrict: {
    index: 0,
    key: `district:${wealth}`,
    label: `${wealth} district`,
  },
  plots: [
    { kind: 'interior', polygon: [[15, 34], [35, 34], [35, 66], [15, 66]], ensemble: { blockKey: 'ward:0:courtyard' } },
    { kind: 'interior', polygon: [[65, 34], [85, 34], [85, 66], [65, 66]], ensemble: { blockKey: 'ward:0:courtyard' } },
  ],
});

describe('resolveCourtyardSpaces', () => {
  it('records one usable open court with the owning block and district identity', () => {
    const [court] = resolveCourtyardSpaces([courtWard()], rootSeedPath(71));

    expect(court).toMatchObject({
      id: 'ward:0:court',
      wardIndex: 0,
      blockKey: 'ward:0:courtyard',
      center: [50, 50],
      districtKey: 'district:common',
      wealth: 'common',
    });
    expect(court.radius).toBeGreaterThan(10);
    expect(['well', 'work-yard']).toContain(court.amenity);
    expect(court.courtyardSignature).toMatch(/^court-/);
  });

  it('is deterministic and narrows amenities by district wealth', () => {
    const wards = [courtWard('wealthy'), courtWard('poor')];
    wards[1].architectureDistrict = {
      index: 1, key: 'district:poor:1', label: 'poor district',
    };
    const first = resolveCourtyardSpaces(wards, rootSeedPath(91));
    const replay = resolveCourtyardSpaces(wards, rootSeedPath(91));

    expect(replay).toEqual(first);
    expect(['garden', 'well']).toContain(first[0].amenity);
    expect(['wash-yard', 'work-yard']).toContain(first[1].amenity);
    expect(first[0].districtKey).not.toBe(first[1].districtKey);
  });

  it('does not mislabel a lone shed or a center occupied by a building', () => {
    const lone = courtWard();
    lone.plots = lone.plots.slice(0, 1);
    const blocked = courtWard();
    blocked.plots.push({ kind: 'interior', polygon: [[45, 45], [55, 45], [55, 55], [45, 55]] });

    expect(resolveCourtyardSpaces([lone, blocked], rootSeedPath(5))).toEqual([]);
  });

  it('resolves distinct receipts for multiple indexed courts in one large block', () => {
    const ward = courtWard();
    ward.plots = [
      { kind: 'interior', courtyardIndex: 0, polygon: [[38, 35], [48, 35], [48, 43], [38, 43]], ensemble: { blockKey: 'ward:0:courtyard:0' } },
      { kind: 'interior', courtyardIndex: 0, polygon: [[38, 57], [48, 57], [48, 65], [38, 65]], ensemble: { blockKey: 'ward:0:courtyard:0' } },
      { kind: 'interior', courtyardIndex: 1, polygon: [[52, 35], [62, 35], [62, 43], [52, 43]], ensemble: { blockKey: 'ward:0:courtyard:1' } },
      { kind: 'interior', courtyardIndex: 1, polygon: [[52, 57], [62, 57], [62, 65], [52, 65]], ensemble: { blockKey: 'ward:0:courtyard:1' } },
    ];
    const courts = resolveCourtyardSpaces([ward], rootSeedPath(171));

    expect(courts).toHaveLength(2);
    expect(courts.map((court) => court.id)).toEqual(['ward:0:court:0', 'ward:0:court:1']);
    expect(new Set(courts.map((court) => court.blockKey)).size).toBe(2);
    expect(new Set(courts.map((court) => court.courtyardSignature)).size).toBe(2);
    expect(courts[0].center).not.toEqual(courts[1].center);
  });
});
