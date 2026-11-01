// @vitest-environment node
/**
 * Worker core for staged 3D world entry. `runWorldGen` is the pure orchestration
 * the world-gen worker runs: resolve the local + region for a cell, assemble the
 * ground WITHOUT props (Stage A), then compute props (Stage B) — emitting each
 * stage as it completes. Runs under the `node` environment (no DOM), exactly
 * like the worker it backs.
 *
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */
import { describe, it, expect, vi } from 'vitest';
import * as groundLoader from '@/systems/worldforge/bridge/groundChunkLoader';
import { runWorldGen } from '../worldGenCore';
import { getBridgeAtlas, getWorldforgeLocalForCell, getBurgNamer } from '@/systems/worldforge/bridge/legacySubmapBridge';
import { generateTownRoster } from '@/systems/worldforge/roster/generateTownRoster';
import { canonicalTownSeedPath } from '@/systems/worldforge/town/canonicalTown';
import {
  canonicalArtifactTownForSite,
  makeGroundWorld,
} from '@/systems/worldforge/bridge/groundChunkLoader';
import { HISTORY_PART_TAG } from '@/systems/worldforge/bridge/interiorParts';
import { listSelectableTowns } from '@/systems/worldforge/local/startTowns';
import { propLandConstraint } from '@/systems/worldforge/props/propLandUse';
import { freshPropFootprint } from '@/systems/worldforge/props/prospectivePropPlacement';
import { createFreshPropClearance } from '@/systems/worldforge/props/freshPropClearance';
import { createPropGeometriesV1, disposePropGeometriesV1 } from '@/systems/worldforge/props/generators/propRenderRecipeV1';
import { findCellAtPoint } from '@/components/Worldforge/atlasSvg';
import { computeBurgMerchants } from '@/systems/worldforge/townsim/registerBurgMerchants';

/** Resolve a real { entryCellId, centerPx } for a seed's lowest-pop port. */
function portRequest(seed: number): { wfSeed: number; entryCellId: number; centerPx: [number, number]; hour: number } {
  const world = getBridgeAtlas(seed);
  const town = listSelectableTowns(world)
    .filter((t) => t.isPort)
    .sort((a, b) => a.population - b.population)[0];
  const burg = (world.pack.burgs as Array<{ x: number; y: number }>)[town.burgIndex];
  const cell = findCellAtPoint(world as never, burg.x, burg.y);
  return { wfSeed: seed, entryCellId: cell, centerPx: [burg.x, burg.y], hour: 12 };
}

describe('runWorldGen (worker core)', () => {
  it('passes the same retained building sources to the prop stage without mutating them', async () => {
    const req = portRequest(42);
    // The reader's receipt validation has its own real-geometry tests. This
    // boundary test catches the native failure: Stage A received this registry
    // while Stage B omitted it and redrew the original prop.
    const buildingSources = {};
    const propSources = {};
    const before = JSON.stringify(buildingSources);
    const props = vi.spyOn(groundLoader, 'computeGroundProps');
    try {
      await runWorldGen({...req, buildingSources, propGenerationRevision: 1, propSources}, {emitStageA: () => {}, emitStageB: () => {}});
      expect(props).toHaveBeenCalledOnce();
      expect(props.mock.calls[0][3]?.buildingSources).toBe(buildingSources);
      expect(props.mock.calls[0][3]?.propSources).toBe(propSources);
      expect(props.mock.calls[0][3]?.propGenerationRevision).toBe(1);
      expect(props.mock.calls[0][3]?.anchorCellId).toBe(req.entryCellId);
      expect(JSON.stringify(buildingSources)).toBe(before);
    } finally {
      props.mockRestore();
    }
  }, 60000);

  it('emits Stage A (ground without props + local + region), then Stage B (props)', async () => {
    const baseReq = portRequest(42);
    const resolved = getWorldforgeLocalForCell(baseReq.wfSeed, baseReq.entryCellId, {
      centerPx: baseReq.centerPx,
    });
    const site = resolved.region!.townSites[0];
    const plan = canonicalArtifactTownForSite(baseReq.wfSeed, site).plan;
    const plot = plan.plots[0];
    const resident = generateTownRoster(plan, canonicalTownSeedPath(baseReq.wfSeed, site.burgId),
      {nameFor:getBurgNamer(baseReq.wfSeed, site.burgId)}).occupants.find(o=>o.householdMemberId)!;
    expect(resident).toBeDefined();
    // A legacy numeric slot deliberately differs from the present roster.
    // The exact home/name identity, not that slot, removes the live body.
    const townLife = {[site.burgId]:{villagers:{987654:{occupantId:987654,name:resident.name,
      homePlotId:resident.homePlotId,bornDay:-10000,diedDay:11}}}};
    const lifeBefore = JSON.stringify(townLife);
    const req = {
      ...baseReq,
      townLife,
      day:12,
      buildingEventLogs: {
        [site.burgId]: {
          [plot.id]: [{
            day: 12,
            kind: 'fire-damage' as const,
            payload: { incidentId: 'worker-proof-fire', severity: 3 as const },
          }],
        },
      },
    };

    let stageA: Parameters<Parameters<typeof runWorldGen>[1]['emitStageA']>[0] | null = null;
    let stageB: Parameters<Parameters<typeof runWorldGen>[1]['emitStageB']>[0] | null = null;
    const order: string[] = [];

    await runWorldGen(req, {
      emitProgress: (stage) => { order.push(`progress:${stage}`); },
      emitStageA: (a) => { stageA = a; order.push('A'); },
      emitStageB: (b) => { stageB = b; order.push('B'); },
    });

    // Progress fires as real work crosses each boundary, then A, then B:
    //  - 'town' after the land/region is resolved and before the town assembles;
    //  - Stage A when terrain + town are ready; Stage B when props are ready.
    expect(order).toEqual(['progress:town', 'A', 'B']);
    expect(stageA).not.toBeNull();
    expect(stageB).not.toBeNull();

    // Stage A carried a real terrain+town world with NO props yet, plus the
    // local + region the main thread needs for tile identity / registration.
    expect(stageA!.ground.props).toEqual([]);
    expect(stageA!.ground.buildings.length).toBeGreaterThan(0);
    expect(stageA!.local).toBeTruthy();
    expect(stageA!.region).toBeTruthy();
    expect(stageA!.ground.rosters.find(r=>r.burgId===site.burgId)!.occupants
      .some(o=>o.householdMemberId===resident.householdMemberId)).toBe(false);
    expect(stageA!.ground.buildings.flatMap(b=>b.occupants??[])
      .some(o=>o.burgId===site.burgId&&o.householdMemberId===resident.householdMemberId)).toBe(false);
    expect(JSON.stringify(townLife)).toBe(lifeBefore);

    // The compact save-side log crossed the worker request and reached the
    // exact burg/plot building, where replay produced tagged visual evidence.
    const damaged = stageA!.ground.buildings.find((building) =>
      building.id === `wf-plot-${site.burgId}-${plot.id}`);
    expect(damaged).toBeDefined();
    expect(damaged!.parts.some((part) =>
      part.tag === HISTORY_PART_TAG && part.historyKind === 'scorched-room')).toBe(true);

    // Stage B props equal a full main-thread build's props (name-fallback
    // invariant: the worker has no registered businesses, yet matches).
    const { local, region } = resolved;
    const full = makeGroundWorld(local, req.wfSeed, region, { hour: req.hour });
    expect(full.rosters.find(r=>r.burgId===site.burgId)!.occupants
      .some(o=>o.householdMemberId===resident.householdMemberId)).toBe(true);
    expect(stageB!).toEqual(full.props);
    expect(stageB!.length).toBeGreaterThan(0);
    expect(stageB!.every(prop=>!Object.hasOwn(prop,'affiliation'))).toBe(true);
    expect(stageA!.ground.buildings.every(building=>!Object.hasOwn(building,'propParcelM'))).toBe(true);
    expect(stageA!.ground.buildings.every(building=>!Object.hasOwn(building,'propUse'))).toBe(true);
  }, 30000);

  it('keeps saved business signs and stock through both worker stages', async () => {
    const baseReq = portRequest(42);
    const {local, region} = getWorldforgeLocalForCell(baseReq.wfSeed, baseReq.entryCellId, {centerPx:baseReq.centerPx});
    const site = region!.townSites[0];
    const {businesses} = computeBurgMerchants(baseReq.wfSeed, site.burgId, 12, {}, {});
    expect(businesses.length).toBeGreaterThan(0);
    const worldBusinesses = Object.fromEntries(businesses.map(business => [business.id, {
      ...business, name: `Saved ${business.name}`,
      stock: business.stock?.map((entry, index) => ({...entry, quantity:index === 0 ? 0 : entry.quantity})),
    }]));
    const saved = JSON.stringify(worldBusinesses);
    let stageA: Parameters<Parameters<typeof runWorldGen>[1]['emitStageA']>[0] | null = null;
    let stageB: Parameters<Parameters<typeof runWorldGen>[1]['emitStageB']>[0] | null = null;
    await runWorldGen({...baseReq, worldBusinesses}, {
      emitStageA: value => {stageA=value;}, emitStageB: value => {stageB=value;},
    });
    expect(stageA).not.toBeNull();
    const rendered = businesses.flatMap(business => {
      const building = stageA!.ground.buildings.find(candidate => candidate.id === `wf-plot-${business.burgId}-${business.plotId}`);
      return building ? [{business:worldBusinesses[business.id], building}] : [];
    });
    expect(rendered.length).toBeGreaterThan(0);
    // The registry represents an already-owned town, including empty shelves.
    // A fallback sign or stock-derived dressing must not replace that save.
    for (const {business, building} of rendered) expect(building.name).toBe(business.name);
    const full = makeGroundWorld(local, baseReq.wfSeed, region, {hour:baseReq.hour, worldBusinesses});
    expect(stageB).toEqual(full.props);
    expect(JSON.stringify(worldBusinesses)).toBe(saved);
  }, 60000);
});


describe('prospective yard through the real worker core', () => {
  it.each([42, 77, 12345])('retains and replays measured exterior placements for seed %s', async seed => {
    const req = portRequest(seed);
    let ground: groundLoader.GroundWorld | undefined;
    let source: groundLoader.GroundWorld['propSource'];
    let props: groundLoader.GroundWorld['props'] | undefined;
    await runWorldGen({ ...req, propGenerationRevision: 2 }, {
      emitStageA: value => { ground = value.ground; },
      emitStageB: (value, baseline) => { props = value; source = baseline; },
    });
    expect(source).toBeDefined(); expect(source).toBe(ground!.propSource);
    expect(ground!.buildings.length).toBeGreaterThan(0);
    expect(ground!.buildings.every(building=>building.propUse?.role !== undefined)).toBe(true);
    expect(source!.report.considered).toBeGreaterThan(0);
    expect(source!.report.kept).toBeGreaterThan(0);
    expect(source!.props).toEqual(props);
    const saved = JSON.stringify(source);
    const { local, region } = getWorldforgeLocalForCell(seed, req.entryCellId, { centerPx: req.centerPx });
    const full = makeGroundWorld(local, seed, region, { hour: req.hour, anchorCellId: req.entryCellId,
      propGenerationRevision: 2, propSources: { [source!.key]: JSON.parse(saved) } });
    expect(full.props).toEqual(props); expect(JSON.stringify(full.propSource)).toBe(saved);
    const actualClearance=createFreshPropClearance(ground!);
    expect(actualClearance.fallbackBuildings).toEqual([]);
    const geometryLibrary=createPropGeometriesV1();
    try{for (const prop of props!) {
      const hull=freshPropFootprint(prop,geometryLibrary);
      expect(actualClearance.issuesFor(hull)).toEqual([]);
      const land=propLandConstraint(ground!,prop);
      expect(land.issue).toBeUndefined();
      expect(land.containsHull(hull)).toBe(true);
    }}finally{disposePropGeometriesV1(geometryLibrary);}
    console.info('[fresh-yard-survey]', JSON.stringify({ seed, cell: req.entryCellId, buildings: ground!.buildings.length,
      uses:ground!.buildings.reduce<Record<string,number>>((counts,building)=>{const role=building.propUse!.role;counts[role]=(counts[role]??0)+1;return counts;},{}),
      wealthy:ground!.buildings.filter(building=>building.propUse!.wealthy).length,
      affiliations:props!.reduce<Record<string,number>>((counts,prop)=>{const kind=prop.affiliation?.kind??'unaffiliated';counts[kind]=(counts[kind]??0)+1;return counts;},{}),
      declineReasons:source!.report.declined.reduce<Record<string,number>>((counts,row)=>{counts[row.reason]=(counts[row.reason]??0)+1;return counts;},{}),
      ...source!.report, declined: source!.report.declined.reduce<Record<string, number>>((counts, row) => {
        counts[row.defId] = (counts[row.defId] ?? 0) + 1; return counts;
      }, {}) }));
  }, 120000);
});

describe('saved town layout through the worker request', () => {
  it('builds the selected earlier town instead of the latest default without changing life data', async () => {
    const req = portRequest(12345);
    const {region} = getWorldforgeLocalForCell(req.wfSeed, req.entryCellId, {centerPx:req.centerPx});
    const site = region!.townSites!.find(site=>site.burgId === listSelectableTowns(getBridgeAtlas(req.wfSeed))
      .filter(t=>t.isPort).sort((a,b)=>a.population-b.population)[0].burgIndex)!;
    expect(site).toBeDefined();
    const life = {[site.burgId]:{layoutRevision:1 as const,villagers:{}}};
    const before = JSON.stringify(life);
    const expected = canonicalArtifactTownForSite(req.wfSeed,site,1).plan;
    let emitted: Parameters<Parameters<typeof runWorldGen>[1]['emitStageA']>[0] | undefined;
    await runWorldGen({...req,townLife:life},{emitStageA:value=>{emitted=value},emitStageB:()=>{}});
    const actual = emitted!.ground.townPlans!.find(town=>town.burgId===site.burgId)!.plan;
    expect(actual).toEqual(expected);
    expect(emitted!.local.townPlan).toEqual(expected);
    expect(emitted!.ground.buildings.filter(building=>building.id.startsWith('wf-plot-'+site.burgId+'-'))
      .map(building=>building.id).sort()).toEqual(expected.plots.map(plot=>'wf-plot-'+site.burgId+'-'+plot.id).sort());
    expect(JSON.stringify(life)).toBe(before);
  },60000);
});
