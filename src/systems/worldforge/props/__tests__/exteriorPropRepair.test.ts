import { describe, expect, it } from 'vitest';
import { exteriorPropClearanceIssues, exteriorPropSourceId, proposeExteriorPropRepair,
  type ExteriorPropRepairContext } from '../exteriorPropRepair';
import type { PropInstance } from '../propSchema';
import observations from '../../interior/__tests__/fixtures/observedBuildingSources.json';
import playedYard from './fixtures/nellYardGeometry.json';
import { makeGridSurfaceProbe } from '../../terrain/surfaceProbe';
import { runPropPlacementGate } from '../../bridge/propPlacementGate';

const square = (x: number, z: number, half: number) => [
  { x: x - half, z: z - half }, { x: x + half, z: z - half },
  { x: x + half, z: z + half }, { x: x - half, z: z + half },
];
const prop: PropInstance = { defId: 'woodpile', xM: 50, zM: 50, rotationRad: 1.3,
  variation: { scale: 1.05, variant: 3 }, surface: { tiltRad: 0, tiltAxis: [1, 0], sinkM: 0, groundYM: 4 } };
const context = (): ExteriorPropRepairContext => ({ radiusM: 1,
  extent: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 }, neighbours: [],
  exclusions: [{ id: 'house', kind: 'building', points: square(50, 50, 3), clearanceM: .5 }] });

describe('retained exterior prop repair proposal', () => {
  it('moves an intruding pile outside the entire envelope without rerolling its appearance or original identity', () => {
    const ctx = context(), before = structuredClone({ prop, ctx });
    const result = proposeExteriorPropRepair(prop, ctx);
    expect(result.status).toBe('proposed');
    if (result.status !== 'proposed') throw new Error('missing proposal');
    expect(exteriorPropClearanceIssues({ x: result.proposed.xM, z: result.proposed.zM }, ctx)).toEqual([]);
    expect(result.sourceId).toBe('prop:woodpile:5000:5000:1300');
    expect(exteriorPropSourceId(result.proposed)).toBe(result.sourceId);
    expect(result.proposed.retainedSourceId).toBe(result.sourceId);
    expect(result.original).toEqual(prop);
    expect(result.proposed.variation).toEqual(prop.variation);
    expect(result.proposed.rotationRad).toBe(prop.rotationRad);
    expect(result.proposed.surface).toBeUndefined();
    expect({ prop, ctx }).toEqual(before);
    expect(proposeExteriorPropRepair(prop, ctx)).toEqual(result);
  });

  it('does not touch an already clear prop or its accepted surface fit', () => {
    const clear = { ...prop, xM: 70 };
    expect(proposeExteriorPropRepair(clear, context())).toEqual({ status: 'clear',
      sourceId: exteriorPropSourceId(clear), original: clear, issues: [] });
  });

  it('can search past a clear but unsupported first site only when explicitly requested', () => {
    const clear = { ...prop, xM: 70 }, ctx = context(), before = JSON.stringify(clear);
    const seatCandidate = (candidate: Readonly<PropInstance>) => candidate.xM >= 70.5
      ? { ...candidate, surface: { tiltRad: 0, tiltAxis: [1, 0] as [number, number], sinkM: 0, groundYM: 4 } }
      : undefined;
    expect(proposeExteriorPropRepair(clear, ctx, { seatCandidate }).status).toBe('clear');
    const retry = proposeExteriorPropRepair(clear, ctx, { seatCandidate, searchWhenClear: true });
    expect(retry.status).toBe('proposed');
    if (retry.status !== 'proposed') throw Error('missing supported candidate');
    expect(retry.proposed.xM).toBe(70.5); expect(retry.proposed.zM).toBe(50);
    expect(retry.original).toEqual(clear); expect(JSON.stringify(clear)).toBe(before);
  });

  it('keeps the exact exhaustive-search result when pruning contacts beyond the twelve-meter search', () => {
    const ctx=context();
    ctx.neighbours=[{id:'wide-nearby-prop',center:{x:81,z:50},radiusM:28},
      ...Array.from({length:300},(_,i)=>({id:'distant-'+i,center:{x:1000+i,z:1000},radiusM:1}))];
    ctx.exclusions=[...ctx.exclusions,{id:'long-crossing-route',kind:'route',points:[{x:48,z:-1000},{x:48,z:1000}],clearanceM:.5},
      {id:'far-building',kind:'building',points:square(1000,1000,2),clearanceM:.5}];
    let expected:{x:number;z:number}|undefined;
    outer:for(let step=1;step<=48;step++)for(let direction=0;direction<64;direction++){
      const angle=direction*Math.PI/32,point={x:prop.xM+Math.cos(angle)*step*.25,z:prop.zM+Math.sin(angle)*step*.25};
      if(!exteriorPropClearanceIssues(point,ctx).length){expected=point;break outer;}
    }
    const result=proposeExteriorPropRepair(prop,ctx);
    expect(expected).toBeDefined();expect(result.status).toBe('proposed');
    if(result.status!=='proposed')throw Error('missing candidate');
    expect({x:result.proposed.xM,z:result.proposed.zM}).toEqual(expected);
    expect(result.issues).toEqual(exteriorPropClearanceIssues({x:prop.xM,z:prop.zM},ctx));
  });

  it('checks the closing polygon edge, corners and scaled prop radius rather than center-only inclusion', () => {
    const ctx = context();
    expect(exteriorPropClearanceIssues({ x: 45.6, z: 50 }, ctx)).toContain('house');
    expect(exteriorPropClearanceIssues({ x: 54, z: 54 }, ctx)).toContain('house');
    expect(exteriorPropClearanceIssues({ x: 54.2, z: 54.2 }, ctx)).toEqual([]);
  });

  it('keeps door approaches and continuous route end caps clear', () => {
    const ctx = context();
    ctx.exclusions = [...ctx.exclusions, { id: 'door-route', kind: 'route', points: [{ x: 53, z: 50 }, { x: 65, z: 50 }], clearanceM: .8 }];
    expect(exteriorPropClearanceIssues({ x: 65.5, z: 50.5 }, ctx)).toContain('door-route');
    const result = proposeExteriorPropRepair(prop, ctx);
    expect(result.status).toBe('proposed');
    if (result.status === 'proposed') expect(exteriorPropClearanceIssues({ x: result.proposed.xM, z: result.proposed.zM }, ctx)).toEqual([]);
  });

  it('does not put a repaired prop inside another building, prop or window edge', () => {
    const ctx = context();
    ctx.exclusions = [...ctx.exclusions, { id: 'neighbour-home', kind: 'building', points: square(56, 50, 2), clearanceM: .5 }];
    ctx.neighbours = [...ctx.neighbours, { id: 'owned-cart', center: { x: 45.5, z: 50 }, radiusM: 2 }];
    expect(exteriorPropClearanceIssues({ x: 45.5, z: 50 }, ctx)).toContain('owned-cart');
    expect(exteriorPropClearanceIssues({ x: .5, z: 25 }, ctx)).toContain('window-edge');
    const result = proposeExteriorPropRepair(prop, ctx);
    expect(result.status).toBe('proposed');
    if (result.status === 'proposed') expect(exteriorPropClearanceIssues({ x: result.proposed.xM, z: result.proposed.zM }, ctx)).toEqual([]);
  });

  it('retains an unresolved prop when every bounded destination is occupied', () => {
    const ctx = context(); ctx.exclusions[0].points = square(50, 50, 25);
    const result = proposeExteriorPropRepair(prop, ctx);
    expect(result).toEqual({ status: 'unresolved', sourceId: exteriorPropSourceId(prop), original: prop, issues: ['house'] });
  });

  it.each([NaN, -1, 0])('refuses an unmeasured or invalid prop radius %s', radiusM => {
    const ctx = context(); ctx.radiusM = radiusM;
    expect(proposeExteriorPropRepair(prop, ctx).status).toBe('unresolved');
  });

  it('detects the actual played Nell pile inside the rotated retained cottage', () => {
    const site = observations.poorHome.site;
    const plan = observations.poorHome.plan;
    const c = Math.cos(site.rotationY), s = Math.sin(site.rotationY);
    const points = [[0, 0], [plan.widthFt, 0], [plan.widthFt, plan.depthFt], [0, plan.depthFt]].map(([x, y]) => {
      const dx = (x - plan.widthFt / 2) * .3048, dz = (y - plan.depthFt / 2) * .3048 * -site.doorZSign;
      return { x: site.xM + dx * c + dz * s, z: site.zM - dx * s + dz * c };
    });
    const played = { ...prop, xM: 472.358912923433, zM: 488.4628858281934, rotationRad: 5.610892274095856 };
    const ctx = context(); ctx.extent = { minX: 0, maxX: 1000, minZ: 0, maxZ: 1000 };
    // This diagnostic radius is explicit, not a claim of measured mesh bounds.
    ctx.exclusions = [{ id: 'nell-retained-home', kind: 'building', points, clearanceM: .5 }];
    expect(exteriorPropClearanceIssues({ x: played.xM, z: played.zM }, ctx)).toEqual(['nell-retained-home']);
    expect(proposeExteriorPropRepair(played, ctx).status).toBe('proposed');
  });

  it('replays all mounted Nell footprints, roads and the revised entry using actual six-log vertex bounds', () => {
    const ctx: ExteriorPropRepairContext = {
      radiusM: playedYard.radiusM, extent: playedYard.extent, neighbours: [],
      exclusions: playedYard.exclusions.map(x => ({ ...x, kind: x.kind as 'building' | 'route' })),
    };
    expect(ctx.exclusions.filter(x => x.kind === 'building')).toHaveLength(23);
    expect(ctx.exclusions.filter(x => x.kind === 'route')).toHaveLength(5);
    const before = JSON.stringify(playedYard);
    const retainedProp: PropInstance = { ...playedYard.prop, surface: {
      ...playedYard.prop.surface,
      tiltAxis: [playedYard.prop.surface.tiltAxis[0], playedYard.prop.surface.tiltAxis[1]],
    } };
    const result = proposeExteriorPropRepair(retainedProp, ctx);
    expect(result.status).toBe('proposed');
    if (result.status !== 'proposed') throw new Error('no footprint-clear candidate');
    expect(result.sourceId).toBe('prop:woodpile:47236:48846:5611');
    expect(exteriorPropClearanceIssues({ x: result.proposed.xM, z: result.proposed.zM }, ctx)).toEqual([]);
    expect(result.proposed.xM).toBeCloseTo(469.8213397867784, 9);
    expect(result.proposed.zM).toBeCloseTo(485.3708440147425, 9);
    expect(JSON.stringify(playedYard)).toBe(before);
    // A geometric candidate is deliberately not a seated/admitted scene.
    expect(result.proposed.surface).toBeUndefined();
  });

  it('does not mistake the first neighbour-clear native candidate for a terrain-seated repair', () => {
    const ctx: ExteriorPropRepairContext = { radiusM: playedYard.radiusM, extent: playedYard.extent,
      neighbours: playedYard.neighbours,
      exclusions: playedYard.exclusions.map(x => ({ ...x, kind: x.kind as 'building' | 'route' })),
    };
    const recorded: PropInstance = { ...playedYard.prop, surface: { ...playedYard.prop.surface,
      tiltAxis: [playedYard.prop.surface.tiltAxis[0], playedYard.prop.surface.tiltAxis[1]] } };
    const result = proposeExteriorPropRepair(recorded, ctx);
    expect(result.status).toBe('proposed');
    if (result.status !== 'proposed') throw new Error('missing geometric candidate');
    const before = JSON.stringify(result.proposed);
    const probe = makeGridSurfaceProbe({ ...playedYard.terrain, elevationsFt: new Float32Array(playedYard.terrain.elevationsFt) });
    const gate = runPropPlacementGate([result.proposed], probe, { surface: 'town', groundMutable: false });
    expect(gate.result?.report.passedCount).toBe(0);
    expect(gate.result?.report.failures).toHaveLength(1);
    expect(gate.result?.report.failures[0].finalScore.failures).toContain('floater');
    expect(gate.patchedSurface).toBeNull();
    expect(gate.props[0].retainedSourceId).toBe('prop:woodpile:47236:48846:5611');
    expect(JSON.stringify(result.proposed)).toBe(before);
  });

  it('continues the native search after terrain refusals without weakening the existing gate', () => {
    const ctx: ExteriorPropRepairContext = { radiusM: playedYard.radiusM, extent: playedYard.extent,
      neighbours: playedYard.neighbours,
      exclusions: playedYard.exclusions.map(x => ({ ...x, kind: x.kind as 'building' | 'route' })),
    };
    const recorded: PropInstance = { ...playedYard.prop, surface: { ...playedYard.prop.surface,
      tiltAxis: [playedYard.prop.surface.tiltAxis[0], playedYard.prop.surface.tiltAxis[1]] } };
    const probe = makeGridSurfaceProbe({ ...playedYard.terrain, elevationsFt: new Float32Array(playedYard.terrain.elevationsFt) });
    let attempts = 0;
    const result = proposeExteriorPropRepair(recorded, ctx, { seatCandidate(candidate) {
      attempts++;
      const gate = runPropPlacementGate([candidate], probe, { surface: 'town', groundMutable: false, report: () => {} });
      return gate.result?.report.passedCount === 1 && !gate.result.report.failures.length ? gate.props[0] : undefined;
    } });
    expect(attempts).toBeGreaterThan(1);
    expect(result.status).toBe('proposed');
    if (result.status !== 'proposed') throw new Error('no supported geometric candidate');
    expect(result.proposed.surface).toBeDefined();
    expect(result.proposed.retainedSourceId).toBe('prop:woodpile:47236:48846:5611');
    expect(exteriorPropClearanceIssues({ x: result.proposed.xM, z: result.proposed.zM }, ctx)).toEqual([]);
    const final = runPropPlacementGate([result.proposed], probe, { surface: 'town', groundMutable: false, report: () => {} });
    expect(final.result?.report.passedCount).toBe(1);
    expect(final.result?.report.failures).toEqual([]);
  });

  it('retains the original when every geometrically clear candidate is unsupported', () => {
    const result = proposeExteriorPropRepair(prop, context(), { seatCandidate: () => undefined });
    expect(result.status).toBe('unresolved'); expect(result.original).toEqual(prop);
  });

  it('refuses a support evaluator that mutates its supplied source', () => {
    const result = proposeExteriorPropRepair(prop, context(), { seatCandidate(candidate) {
      candidate.variation.scale = 4; return undefined;
    } });
    expect(result.issues).toEqual(['candidate-evaluator-mutated-input']); expect(result.original).toEqual(prop);
  });

  it('refuses a seated result that changes appearance or its selected destination', () => {
    const result = proposeExteriorPropRepair(prop, context(), { seatCandidate(candidate) {
      return { ...candidate, xM: candidate.xM + 1, surface: { groundYM: 0, sinkM: 0, tiltRad: 0, tiltAxis: [1, 0] } };
    } });
    expect(result.issues).toEqual(['candidate-evaluator-changed-source']); expect(result.status).toBe('unresolved');
  });
});
