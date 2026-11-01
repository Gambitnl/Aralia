/** Frozen exterior-prop corrections belong to the reached building source.
 * Original prop/household data is retained; replay replaces exactly one stable
 * prop address. This first reader pins the nearby generated prop baseline:
 * changes outside the qualified yard remain independent; nearby source drift
 * needs a migration, never a silent property reroll.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/11/2026, 03:58:01
 * Dependents: components/World3D/World3DWrapper.tsx, state/reducers/townReducer.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/interior/buildingSource.ts, systems/worldforge/props/freshPropClearance.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GroundWorld } from '../bridge/groundChunkLoader';
import type { BuildingSourcesByBurg, ObservedBuildingSource, BuildingSourcePosition } from '../interior/buildingSource';
import { buildingPlanSignature, readObservedBuildingSource } from '../interior/buildingSource';
import { outsideLayoutRepairEnvelope } from '../interior/buildingLayoutRepair';
import { siteOrientationFromQuad } from '../bridge/sitePartTransform';
import { makeGroundWorldProbe, runPropPlacementGate } from '../bridge/propPlacementGate';
import { fnv1a } from '../seedPath';
import { propSourceId, type PropInstance } from './propSchema';
import { exteriorPropClearanceIssues, type ExteriorPropRepairContext } from './exteriorPropRepair';
import { woodpileShapeV1, capturedWoodpileMatchesV1 } from './generators/woodpileGeometry';
import { verifyRenderedPropSupport } from '@/components/World3D/groundPropSupport';
import type { RenderedGroundPropShape, RenderedGroundPropBounds } from '@/components/World3D/groundPropGeometry';

export interface ExteriorPropRevision {
  version: 1;
  recipe: 'woodpile-exterior-v1';
  worldSeed: number; burgId: number; plotId: number; cellId: number;
  sourceSignature: string; mountedSignature: string;
  baselineSignature: string;
  predecessors: string[];
  original: PropInstance; revised: PropInstance;
  neighbours: RenderedGroundPropBounds[];
  admittedAt: string; position: BuildingSourcePosition;
  bodyRadiusM: number; characterSignature: string;
  signature: string;
}

export function propDataSignature(value: unknown): string {
  return `prop-data-v1:${fnv1a(JSON.stringify(value)).toString(36)}`;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function nearbyBaseline(props: readonly PropInstance[], original: PropInstance) {
  return props.filter(p => Math.hypot(p.xM-original.xM,p.zM-original.zM)<=25);
}

/** All current doors/roads/building envelopes participate, not just the home
 * whose observation owns the receipt. Door approach direction uses the same
 * site frame as rendered front doors. Radius comes from the actual v1 model. */
export function exteriorRevisionContext(ground: GroundWorld, original: PropInstance,
  neighbours: readonly RenderedGroundPropBounds[], measuredRadiusM?: number): ExteriorPropRepairContext {
  // Existing retained woodpile receipts keep their exact v1 radius. Fresh
  // placement may supply a radius measured from another authored model.
  const radiusM = measuredRadiusM ?? Math.max(...woodpileShapeV1(original).triangles.flat().map(p => Math.hypot(p[0], p[2])));
  const exclusions: ExteriorPropRepairContext['exclusions'][number][] = ground.buildings.map(b => ({
    id: b.id, kind: 'building', points: b.cornersM, clearanceM: .5,
  }));
  exclusions.push(...exteriorRouteExclusions(ground));
  return { radiusM, extent: { minX: 0, minZ: 0, maxX: ground.extentMetersX, maxZ: ground.extentMetersZ }, exclusions,
    neighbours: neighbours.filter(n => n.sourceId !== propSourceId(original)).map(n => ({ id: n.sourceId, center: { x: n.xM, z: n.zM }, radiusM: n.radiusM })) };
}

/** One unchanged route policy for retained and fresh prop readers. */
export function exteriorRouteExclusions(ground: GroundWorld): ExteriorPropRepairContext['exclusions'][number][] {
  const exclusions: ExteriorPropRepairContext['exclusions'][number][]=[];
  ground.roads.forEach((r, i) => exclusions.push({ id: `road:${i}`, kind: 'route', points: r.points, clearanceM: r.widthM / 2 + .5 }));
  for (const b of ground.buildings) {
    if (b.frontDoorOffsetX === undefined || b.frontDoorOffsetZ === undefined) continue;
    const { rotationY, doorZSign } = siteOrientationFromQuad(b.cornersM);
    const door = { x: b.xM + b.frontDoorOffsetX, z: b.zM + b.frontDoorOffsetZ };
    exclusions.push({ id: `entry:${b.id}`, kind: 'route', points: [door,
      { x: door.x + doorZSign * Math.sin(rotationY) * 5, z: door.z + doorZSign * Math.cos(rotationY) * 5 }], clearanceM: .8 });
  }
  return exclusions;
}

function validateRevision(receipt: ExteriorPropRevision, source: ObservedBuildingSource, ground: GroundWorld,
  baseline: readonly PropInstance[]): void {
  const { signature, ...body } = receipt;
  const finite = (v: unknown): boolean => typeof v === 'number' ? Number.isFinite(v)
    : !v || typeof v !== 'object' || Object.values(v).every(finite);
  if (!finite(receipt) || receipt.version !== 1 || receipt.recipe !== 'woodpile-exterior-v1'
    || signature !== propDataSignature(body) || !Number.isFinite(Date.parse(receipt.admittedAt))
    || receipt.worldSeed !== source.worldSeed || receipt.burgId !== source.burgId || receipt.plotId !== source.plotId
    || receipt.cellId !== source.cellId || receipt.sourceSignature !== source.planSignature
    || receipt.characterSignature.length === 0 || !Number.isFinite(receipt.bodyRadiusM) || !(receipt.bodyRadiusM >= .1)
    || receipt.position.tileX !== source.cellId || receipt.position.tileY !== 0
    || !outsideLayoutRepairEnvelope(source.plan, source.site, receipt.position)) throw Error('Invalid exterior prop revision source');
  const resolved = readObservedBuildingSource({ worldSeed: source.worldSeed, burgId: source.burgId, source }, source.plotId, JSON.parse(source.historySignature) ?? undefined);
  const mounted = ground.buildings.find(b => b.id === `wf-plot-${source.burgId}-${source.plotId}`);
  if (!mounted || receipt.mountedSignature !== buildingPlanSignature(resolved.plan)
    || !mounted.blueprintSignature) throw Error('Exterior prop building source changed');
  if (receipt.baselineSignature !== propDataSignature(nearbyBaseline(baseline,receipt.original))) throw Error('Exterior prop baseline changed; a source migration is required');
  const id = propSourceId(receipt.original), originals = baseline.filter(p => propSourceId(p) === id);
  if (originals.length !== 1 || !same(originals[0], receipt.original) || receipt.original.defId !== 'woodpile'
    || receipt.revised.retainedSourceId !== id || propSourceId(receipt.revised) !== id) throw Error('Exterior prop identity changed');
  const old = copy(receipt.original), revised = copy(receipt.revised);
  delete old.surface; delete old.retainedSourceId; delete revised.surface; delete revised.retainedSourceId;
  delete old.retainedRenderRecipe; delete revised.retainedRenderRecipe;
  revised.xM = old.xM; revised.zM = old.zM;
  if (!same(old, revised) || !receipt.revised.surface || receipt.revised.surface.tiltRad !== 0
    || receipt.revised.retainedRenderRecipe !== 'woodpile-v1') throw Error('Exterior prop appearance or possessions changed');
  if (Math.hypot(receipt.revised.xM-receipt.original.xM,receipt.revised.zM-receipt.original.zM)>12)
    throw Error('Exterior prop leaves its qualified yard');
  const ownDistance=Math.hypot(receipt.revised.xM-source.site.xM,receipt.revised.zM-source.site.zM);
  if(ground.buildings.some(b=>b.id!==mounted.id&&Math.hypot(receipt.revised.xM-b.xM,receipt.revised.zM-b.zM)<ownDistance-1e-6))
    throw Error('Exterior prop destination belongs to a different building approach');
  const ctx = exteriorRevisionContext(ground, receipt.original, receipt.neighbours);
  if (!exteriorPropClearanceIssues({ x: receipt.original.xM, z: receipt.original.zM }, ctx).includes(mounted.id)
    || exteriorPropClearanceIssues({ x: receipt.revised.xM, z: receipt.revised.zM }, ctx).length)
    throw Error('Exterior prop has no clear supported exterior destination');
  for (const n of receipt.neighbours) {
    const current = baseline.filter(p => propSourceId(p) === n.sourceId);
    if (current.length !== 1 || current[0].defId !== n.defId || current[0].xM !== n.xM || current[0].zM !== n.zM
      || current[0].rotationRad !== n.rotationRad || current[0].variation.scale !== n.scale || current[0].variation.variant !== n.variant
      || !(n.radiusM > 0)) throw Error('Exterior prop neighbour source changed');
  }
  for (const p of [receipt.original, receipt.revised]) if (Math.hypot(p.xM - receipt.position.xM, p.zM - receipt.position.zM)
    <= ctx.radiusM + receipt.bodyRadiusM + .25) throw Error('Exterior prop correction overlaps the accepted body');
  const probe = makeGroundWorldProbe(ground);
  if (!probe) throw Error('Exterior prop support is unknown');
  const gate = runPropPlacementGate([receipt.revised], probe, { surface: 'town', groundMutable: false, report: () => {} });
  if (gate.result?.report.passedCount !== 1 || gate.result.report.failures.length
    || Math.abs(gate.props[0].surface!.groundYM - receipt.revised.surface.groundYM) > 1e-5
    || !verifyRenderedPropSupport(receipt.revised, woodpileShapeV1(receipt.original), probe).passed)
    throw Error('Exterior prop destination is not supported');
}

/** Freezing is a checked proposal, not a save write. The reducer repeats live
 * world/history/character/position checks; the worker repeats geometry/support
 * on replay. Original observation, furniture and manifests remain untouched. */
export function freezeExteriorPropRevision(input: {
  source: ObservedBuildingSource; ground: GroundWorld; original: PropInstance; revised: PropInstance;
  captured: RenderedGroundPropShape; neighbours: RenderedGroundPropBounds[];
  admittedAt: string; position: BuildingSourcePosition; bodyRadiusM: number; characterSignature: string;
  predecessors?: string[];
}): ExteriorPropRevision {
  if (!capturedWoodpileMatchesV1(input.original, input.captured)) throw Error('Rendered woodpile no longer matches its retained recipe');
  const { source, ground } = input;
  const body: Omit<ExteriorPropRevision, 'signature'> = { version: 1, recipe: 'woodpile-exterior-v1',
    worldSeed: source.worldSeed, burgId: source.burgId, plotId: source.plotId, cellId: source.cellId,
    sourceSignature: source.planSignature, mountedSignature: ground.buildings.find(b => b.id === `wf-plot-${source.burgId}-${source.plotId}`)?.blueprintSignature ?? '',
    baselineSignature: propDataSignature(nearbyBaseline(ground.props,input.original)), predecessors: [...(input.predecessors ?? [])], original: copy(input.original),
    revised: { ...copy(input.revised), retainedRenderRecipe: 'woodpile-v1' }, neighbours: copy(input.neighbours),
    admittedAt: input.admittedAt, position: copy(input.position), bodyRadiusM: input.bodyRadiusM, characterSignature: input.characterSignature };
  const receipt = { ...body, signature: propDataSignature(body) };
  validateRevision(receipt, source, ground, ground.props);
  if (ground.buildings.find(b => b.id === `wf-plot-${source.burgId}-${source.plotId}`)?.blueprintSignature !== receipt.mountedSignature)
    throw Error('Mounted exterior prop building source changed during admission');
  return receipt;
}

export function exteriorRevisionChain(ground: GroundWorld, sources?: BuildingSourcesByBurg) {
  const receipts = Object.values(sources ?? {}).flatMap(town => Object.values(town)
    .filter(source => ground.buildings.some(b => b.id === `wf-plot-${source.burgId}-${source.plotId}`)).flatMap(source =>
      Object.values(source.exteriorPropRevisions ?? {}).map(receipt => ({ source, receipt }))));
  receipts.sort((a, b) => a.receipt.predecessors.length - b.receipt.predecessors.length || a.receipt.signature.localeCompare(b.receipt.signature));
  const applied: string[] = [];
  for (const { receipt } of receipts) {
    if (!same(receipt.predecessors, applied)) throw Error('Exterior prop revision chain changed');
    applied.push(receipt.signature);
  }
  return receipts;
}

/** Used only to preflight a later admission against the same original baseline.
 * Existing revisions are reversed on a copy; the live world is never rewound. */
export function exteriorPropBaseline(ground: GroundWorld, sources: BuildingSourcesByBurg): PropInstance[] {
  const out = [...ground.props];
  for (const { receipt } of exteriorRevisionChain(ground, sources).reverse()) {
    const matches = out.map((p, i) => ({ p, i })).filter(({ p }) => propSourceId(p) === propSourceId(receipt.original));
    if (matches.length !== 1 || !same(matches[0].p, receipt.revised)) throw Error('Mounted exterior prop revision changed');
    out[matches[0].i] = copy(receipt.original);
  }
  return out;
}

/** Never fall back to a fresh prop when an accepted source fails validation. */
export function replayExteriorPropRevisions(ground: GroundWorld, baseline: PropInstance[], sources?: BuildingSourcesByBurg): PropInstance[] {
  const receipts = exteriorRevisionChain(ground, sources);
  if (!receipts.length) return baseline;
  const out = [...baseline], used = new Set<string>();
  for (const { source, receipt } of receipts) {
    validateRevision(receipt, source, ground, out);
    const id = propSourceId(receipt.original);
    if (used.has(id)) throw Error('Duplicate retained exterior prop source');
    used.add(id);
    out[out.findIndex(p => propSourceId(p) === id)] = copy(receipt.revised);
  }
  return out;
}
