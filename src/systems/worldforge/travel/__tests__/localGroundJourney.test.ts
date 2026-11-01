import { describe, expect, it, vi, afterEach } from 'vitest';
import type { RegionArtifact, LocalArtifact } from '../../artifacts';
import { planLocalTerrainRoute, acceptedGroundPoint, prepareLocalJourneyBattlefield, localTerrainEndpointRefusal, quoteLocalGroundJourney } from '../localGroundJourney';
import { createMockGameState } from '../../../../utils/core/factories';
import { buildAtlasGroundDrilldown, groundFocusesForLocal, restorableGroundFocusesForLocal } from '../../leaf3d/atlasGroundDrilldown';
import * as groundBridge from '../../bridge/groundChunkLoader';
import * as groundMotion from '../../bridge/groundAgentMotion';
import * as theme from '../../../combat/worldScenario/travelAmbushBattlefield';
afterEach(() => vi.restoreAllMocks());

// Authored terrain fixtures isolate route admission. They are never installed in a saved world.
function region(river = false, bridge = false): RegionArtifact {
  return {
    bounds: { x: -5000, y: -5000, width: 10000, height: 10000 },
    heightfield: { width: 101, height: 101, resolutionFt: 100, samples: new Float32Array(10201).fill(0.4) },
    rivers: river ? [{ riverId: 7, centerline: [[0, -5000], [0, 5000]], widthFt: 200, widthFtAt: [200, 200], slopeAt: [0.001, 0.001] }] : [],
    crossings: bridge ? [{ id: 'bridge-7', kind: 'bridge', riverId: 7, roadRouteId: 2, point: [0, 1000], roadDirection: [1, 0], riverDirection: [0, 1], spanFt: 240, widthFt: 60 }] : [],
  } as unknown as RegionArtifact;
}
const plan = (r: RegionArtifact, season = 1) => planLocalTerrainRoute([-1500, 0], [1500, 0], [r], 3, 1, 0.2, season);

describe('source-ground local journey routes', () => {
  it('rejects a restorable legacy wall endpoint before offering a new journey', () => {
    const local = { seedPath: 'wf:7/cell:42/local:1500-2500', bounds: { x: 1000, y: 2000, width: 1000, height: 1000 }, features: [],
      townPlan: { burgId: 2, plots: [], streets: [{ centerline: [[1100, 2500], [1900, 2500]] }] },
    } as unknown as LocalArtifact;
    const legacy = restorableGroundFocusesForLocal(local).find(f => f.label.includes('western road approach'))!;
    const receipt = buildAtlasGroundDrilldown({ worldSeed: 7, atlasCellId: 42, region: region(), local, focus: legacy });
    expect(() => quoteLocalGroundJourney(createMockGameState(), receipt)).toThrow('not a town entrance');
  });
  it('retains exact accepted endpoints and charges physical distance and seasonal time', () => {
    const route = plan(region())!;
    expect(route.points[0]).toEqual([-1500, 0]);
    expect(route.points.at(-1)).toEqual([1500, 0]);
    expect(route.miles).toBeCloseTo(3000 / 5280);
    expect(route.minutes).toBeCloseTo(route.miles / 3 * 60);
    expect(plan(region(), 1.5)!.minutes).toBeCloseTo(route.minutes * 1.5);
  });
  it('refuses a river without inventing a crossing', () => {
    expect(plan(region(true))).toBeNull();
  });
  it('takes the actual narrow bridge instead of widening it or crossing anywhere', () => {
    const route = plan(region(true, true))!;
    expect(route).not.toBeNull();
    expect(route.miles).toBeGreaterThan(3000 / 5280);
    expect(route.points.some(p => p[1] === 1000)).toBe(true);
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i];
      if (a[0] * b[0] < 0) expect(Math.abs((a[1] + b[1]) / 2 - 1000)).toBeLessThanOrEqual(30);
    }
  });
  it('refuses submerged endpoints and paths outside the owning cell', () => {
    const submerged = region(); submerged.heightfield.samples.fill(0.1);
    expect(plan(submerged)).toBeNull();
    expect(planLocalTerrainRoute([-1500, 0], [1500, 0], [region()], 3, 1, 0.2, 1, p => p[0] < 0)).toBeNull();
  });
  it('cannot use an unaccepted or foreign body as the departure point', () => {
    expect(acceptedGroundPoint(createMockGameState({ playerGroundPos: null }))).toBeNull();
    expect(acceptedGroundPoint(createMockGameState({ playerCell: { cellId: 7, localeCoords: null }, playerGroundPos: { tileX: 8, tileY: 0, xM: 1, zM: 2, yM: 0 } }))).toBeNull();
  });
  it('explains the mapped river departure without claiming the rendered body is submerged', () => {
    const source = region(true);
    expect(localTerrainEndpointRefusal([0, 0], [source], 'departure')).toBe(
      'The local map places your departure inside a river corridor without a recorded crossing. This journey has not started.',
    );
    expect(planLocalTerrainRoute([0, 0], [-1500, 0], [source], 3, 1, 0.2, 1)).toBeNull();
    expect(localTerrainEndpointRefusal([-1500, 0], [source], 'departure')).toBeNull();
    expect(localTerrainEndpointRefusal([0, 0], [source], 'destination')).toContain('selected destination');
  });
  it('keeps the exact crossing usable and refuses points beyond its actual width', () => {
    const source = region(true, true);
    expect(localTerrainEndpointRefusal([0, 1000], [source], 'departure')).toBeNull();
    expect(localTerrainEndpointRefusal([0, 1000], [source], 'destination')).toBeNull();
    expect(localTerrainEndpointRefusal([0, 1040], [source], 'departure')).toContain('without a recorded crossing');
  });
  it('distinguishes missing land, missing survey and owning-area limits at the refused endpoint', () => {
    const source = region();
    source.heightfield.samples.fill(0.1);
    expect(localTerrainEndpointRefusal([0, 0], [source], 'departure')).toContain('does not show a land departure');
    expect(localTerrainEndpointRefusal([0, 0], [source], 'destination')).toContain('does not show a land arrival');
    expect(localTerrainEndpointRefusal([20000, 0], [source], 'departure')).toContain('has not been surveyed');
    expect(localTerrainEndpointRefusal([0, 0], [source], 'departure', () => false)).toContain('leave the selected world area');
  });
});

describe('local journey combat source', () => {
  it('extracts at the retained focus from the same Local and Region, including arrival time and deltas', async () => {
    const sourceRegion = { ...region(), seedPath: 'wf:7/cell:42' };
    const local = { seedPath: 'wf:7/cell:42/local:1500-2500', bounds: { x: 1000, y: 2000, width: 1000, height: 1000 }, features: [] } as unknown as LocalArtifact;
    const drilldown = buildAtlasGroundDrilldown({ worldSeed: 7, atlasCellId: 42, region: sourceRegion, local, focus: groundFocusesForLocal(local)[0] });
    const ground = { source: 'retained-ground' };
    const loader = vi.spyOn(groundBridge, 'createGroundChunkLoader').mockReturnValue({ ground } as unknown as ReturnType<typeof groundBridge.createGroundChunkLoader>);
    const extracted = {} as ReturnType<typeof groundBridge.extractLocalTerrainPatch>;
    const extract = vi.spyOn(groundBridge, 'extractLocalTerrainPatch').mockReturnValue(extracted);
    vi.spyOn(groundMotion, 'allGroundAgentsAt').mockReturnValue([]);
    vi.spyOn(theme, 'battleMapThemeForGround').mockReturnValue('forest');
    const state = createMockGameState({ worldSeed: 7, gameTime: new Date('2026-01-01T10:00:00Z') });
    const result = await prepareLocalJourneyBattlefield(drilldown, state, 5400);
    expect(loader.mock.calls[0][0]).toBe(local); expect(loader.mock.calls[0][2]).toBe(sourceRegion);
    expect(loader.mock.calls[0][3]).toEqual(expect.objectContaining({ anchorCellId: 42, hour: 11.5, deltas: state.worldforgeDeltas }));
    expect(extract).toHaveBeenCalledWith(ground, 152.4, 152.4, 'forest', 7, { width: 80, height: 60, occupants: [] });
    expect(result.extractedBattleMap).toBe(extracted);
    expect(result.extractedBattleMap.provenance).toEqual(expect.objectContaining({ anchorCellId: 42, anchorWorldMeters: { x: 152.4, z: 152.4 }, generationPath: expect.arrayContaining([local.seedPath]) }));
    await expect(prepareLocalJourneyBattlefield({ ...drilldown, localSeedPath: 'foreign' }, state, 5400)).rejects.toThrow('no longer matches');
  });
});
