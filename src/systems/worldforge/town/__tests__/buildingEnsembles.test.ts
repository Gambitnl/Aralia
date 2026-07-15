/**
 * These tests prove street plots become coherent blocks before building work.
 *
 * Synthetic wards isolate party-wall detection, while production towns prove
 * typology selects detached or dense urban ensembles without losing any plot.
 */

import { describe, expect, it } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { resolveBuildingEnsembles } from '../buildingEnsembles';
import { generateTownPlan, type BuildingPlot, type TownWard } from '../townEngine';

const plot = (x0: number, x1: number, edge = 0): BuildingPlot => ({
  polygon: [[x0, 0], [x1, 0], [x1, 20], [x0, 20]],
  frontageEdge: edge,
  kind: 'frontage',
});

function ward(plots: BuildingPlot[]): TownWard {
  return {
    polygon: [[0, 0], [60, 0], [60, 60], [0, 60]],
    block: [[1, 1], [59, 1], [59, 59], [1, 59]],
    plots,
  };
}

describe('resolveBuildingEnsembles', () => {
  it('shares one row identity and marks only truly touching side walls', () => {
    const plots = [plot(0, 20), plot(20, 40), plot(43, 63)];
    const resolved = resolveBuildingEnsembles(
      [ward(plots)],
      [],
      'city',
      rootSeedPath(41),
    );

    expect(resolved.size).toBe(plots.length);
    const [first, second, third] = plots.map((candidate) => resolved.get(candidate)!);
    expect(first.kind).toBe('row');
    expect(new Set([first.blockKey, second.blockKey, third.blockKey]).size).toBe(1);
    expect(new Set([first.ensembleSignature, second.ensembleSignature, third.ensembleSignature]).size)
      .toBe(1);
    expect(new Set([first.eaveStoreys, second.eaveStoreys, third.eaveStoreys]).size).toBe(1);
    expect(new Set([first.partyWallOwner, second.partyWallOwner, third.partyWallOwner]).size)
      .toBe(1);
    expect(first.partyWallOwner).toMatch(/frontage-member$/);
    expect(first.partyWallRight).toBe(true);
    expect(second.partyWallLeft).toBe(true);
    expect(second.partyWallRight).toBe(false);
    expect(third.partyWallLeft).toBe(false);
    expect(first.lotProfile).toMatch(/envelope|return/);
    expect(second.lotProfile).toMatch(/envelope|left-return/);
    expect(first.lotSignature).toBeTruthy();
    expect(first.lotSignature).not.toBe(second.lotSignature);
  });

  it('uses detached buildings for hamlets and courtyard identity for infill', () => {
    const frontage = plot(0, 10);
    const interior: BuildingPlot = {
      polygon: [[20, 20], [30, 20], [30, 30], [20, 30]],
      frontageEdge: -1,
      kind: 'interior',
    };
    const resolved = resolveBuildingEnsembles(
      [ward([frontage, interior])],
      [],
      'hamlet',
      rootSeedPath(9),
    );

    expect(resolved.get(frontage)?.kind).toBe('detached');
    expect(resolved.get(frontage)?.partyWallLeft).toBe(false);
    expect(resolved.get(frontage)?.partyWallRight).toBe(false);
    expect(resolved.get(frontage)?.partyWallOwner).toBeUndefined();
    expect(resolved.get(frontage)?.parcelProfile).toMatch(/setback|side-yard/);
    expect(resolved.get(frontage)?.parcelSignature).toBeTruthy();
    expect(resolved.get(frontage)?.lotProfile).toBeUndefined();
    expect(resolved.get(frontage)?.lotSignature).toBeUndefined();
    expect(resolved.get(interior)?.kind).toBe('courtyard');
    expect(resolved.get(interior)?.partyWallOwner).toBeUndefined();
  });

  it('negotiates an exact compound only for a viable detached envelope', () => {
    const large = plot(0, 24);
    large.polygon = [[0, 0], [24, 0], [24, 24], [0, 24]];
    const detachedWard = ward([large]);
    detachedWard.architectureDistrict = {
      index: 0,
      key: 'district:orchard',
      label: 'Orchard Ward',
    };
    const resolved = resolveBuildingEnsembles(
      [detachedWard],
      [],
      'hamlet',
      rootSeedPath(91),
    ).get(large)!;

    expect(resolved.kind).toBe('detached');
    expect(resolved.parcelProfile).toBeTruthy();
    expect(resolved.lotProfile).toMatch(/envelope|return|court/);
    expect(resolved.lotSignature).toBeTruthy();
  });

  it('gives indexed courts distinct block identities inside one ward', () => {
    const first = { ...plot(10, 30), kind: 'interior' as const, courtyardIndex: 0 };
    const second = { ...plot(30, 50), kind: 'interior' as const, courtyardIndex: 1 };
    const resolved = resolveBuildingEnsembles(
      [ward([first, second])],
      [],
      'city',
      rootSeedPath(29),
    );

    expect(resolved.get(first)?.blockKey).toBe('ward:0:courtyard:0');
    expect(resolved.get(second)?.blockKey).toBe('ward:0:courtyard:1');
    expect(resolved.get(first)?.ensembleSignature)
      .not.toBe(resolved.get(second)?.ensembleSignature);
  });

  it('varies visible party-wall ownership between blocks without varying within one block', () => {
    const owners = new Set<string>();

    // Ownership is a block recipe, not a global convention. Sampling named
    // seeds proves both frontage neighbors can own masonry in different towns.
    for (let seed = 0; seed < 64; seed++) {
      const plots = [plot(0, 10), plot(10, 20)];
      const resolved = resolveBuildingEnsembles(
        [ward(plots)],
        [],
        'city',
        rootSeedPath(seed),
      );
      const pair = plots.map((candidate) => resolved.get(candidate)!);
      expect(pair[0].partyWallOwner).toBe(pair[1].partyWallOwner);
      owners.add(pair[0].partyWallOwner!);
    }

    expect(owners).toEqual(new Set([
      'earlier-frontage-member',
      'later-frontage-member',
    ]));
  });

  it('promotes the nearest built ward around a plaza to a market arcade', () => {
    const near = plot(0, 10);
    const far = plot(100, 110);
    const wards: TownWard[] = [
      ward([near]),
      {
        ...ward([far]),
        polygon: [[100, 100], [160, 100], [160, 160], [100, 160]],
      },
    ];
    const resolved = resolveBuildingEnsembles(
      wards,
      [{ kind: 'plaza', polygon: [[20, 20], [30, 20], [30, 30], [20, 30]], wardIndex: 0 }],
      'village',
      rootSeedPath(12),
    );

    expect(resolved.get(near)?.kind).toBe('market-arcade');
    expect(resolved.get(far)?.kind).toBe('detached');
  });
});

describe('generateTownPlan ensemble production', () => {
  const footprint: [number, number][] = [[0, 0], [160, 0], [170, 120], [80, 170], [0, 130]];

  it('stamps every generated plot and retains exact replay determinism', () => {
    const first = generateTownPlan(footprint, rootSeedPath(725), { population: 12_000 });
    const replay = generateTownPlan(footprint, rootSeedPath(725), { population: 12_000 });
    const ensembles = first.plots.map((candidate) => candidate.ensemble);

    expect(ensembles.length).toBeGreaterThan(0);
    expect(ensembles.every(Boolean)).toBe(true);
    expect(ensembles.some((ensemble) => ensemble?.kind === 'row')).toBe(true);
    expect(ensembles.some((ensemble) => ensemble?.kind === 'market-arcade')).toBe(true);
    // The collision pass must preserve intentional edge contact; otherwise
    // row identity survives but every alternate neighbor is silently deleted.
    expect(ensembles.some((ensemble) =>
      ensemble?.partyWallLeft || ensemble?.partyWallRight)).toBe(true);
    expect(replay.plots.map((candidate) => candidate.ensemble)).toEqual(ensembles);
  });

  it('keeps a hamlet detached even when frontage plots happen to be adjacent', () => {
    const hamlet = generateTownPlan(footprint, rootSeedPath(19), { population: 50 });
    expect(hamlet.plots.length).toBeGreaterThan(0);
    expect(hamlet.plots
      .filter((candidate) => candidate.kind !== 'interior')
      .every((candidate) => candidate.ensemble?.kind === 'detached')).toBe(true);
    expect(hamlet.plots
      .filter((candidate) => candidate.kind !== 'interior')
      .every((candidate) => candidate.ensemble?.parcelProfile)).toBe(true);
  });
});
