/** Save exactly the building the player physically inspected before any layout
 * upgrade. TownSim owns this retained evidence alongside its event/door state.
 * A legacy capture is explicitly an observation, never a claim to recover the
 * world's historical original. Capturing grants no goods, access or movement.
 * Readers share this foundation and replay compatible condition history.
 * Structural changes still require migration; capture never freezes town life.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/11/2026, 01:29:05
 * Dependents: components/World3D/World3DWrapper.tsx, components/World3D/worldGenCore.ts, components/Worldforge/TownBuildingInspector.tsx, components/Worldforge/townBuildingVisit.ts, state/actionTypes.ts, state/reducers/townReducer.ts, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/interiorParts.ts, systems/worldforge/interior/generateInterior.ts, systems/worldforge/interior/householdLayoutRevision.ts, systems/worldforge/props/exteriorPropRevision.ts, systems/worldforge/town/buildingPlotInput.ts, systems/worldforge/town/historicalTownLayout.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/types.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {fnv1a, rootSeedPath, childSeedPath, streamPath, type SeedPath} from '../seedPath';
import type {BlueprintPlan, BuildingEventHistory} from './blueprintTypes';
import type {ContainerManifest} from './manifests';
import {applyFurnitureLayoutMoves, outsideLayoutRepairEnvelope, FURNITURE_REPAIR_RECIPE, type FurnitureLayoutRepair} from './buildingLayoutRepair';
import {GUEST_CIRCULATION_RECIPE, guestCirculationReferencesAgree, guestCirculationDoorMoves, type GuestCirculationRepair} from './guestCirculation';
import type {Household} from '../town/household';
import type {ExteriorPropRevision} from '../props/exteriorPropRevision';
import {validateHouseholdLayoutRevision, type HouseholdLayoutRevision} from './householdLayoutRevision';
import {applyHistory, buildingHistoryEventCount, buildingHistoryEventDigest,
  structuralBuildingHistoryEvents} from './buildingEventHistory';

export interface BuildingSourcePosition {
  tileX: number; tileY: number; xM: number; zM: number; yM: number;
}

export interface ObservedBuildingSource {
  version: 1;
  provenance: 'observed';
  worldSeed: number;
  burgId: number;
  plotId: number;
  cellId: number;
  observedAt: string;
  position: BuildingSourcePosition;
  site: {xM: number; zM: number; surfaceY: number; rotationY: number; doorZSign: number};
  planSignature: string;
  historySignature: string;
  plan: BlueprintPlan;
  household?: Household;
  workplaceOnly: boolean;
  manifests: ContainerManifest[];
  /** Explicit correction over the immutable observation; never recapture it. */
  furnishingRepair?: FurnitureLayoutRepair;
  /** Frozen reference-preserving room revision, separate from the observation. */
  circulationRepair?: GuestCirculationRepair;
  /** Frozen household program with explicit original property/room/door joins. */
  householdRevision?: HouseholdLayoutRevision;
  /** Explicit exterior corrections retain original object identity and source. */
  exteriorPropRevisions?: Record<string, ExteriorPropRevision>;
}

/** Full world identity travels beside the record. Seed paths intentionally
 * truncate world seeds to 32 bits and cannot alone distinguish saved worlds. */
export interface BuildingSourceContext {
  worldSeed: number;
  burgId: number;
  source: ObservedBuildingSource;
}
export type BuildingSourcesByBurg = Record<number, Record<number, ObservedBuildingSource>>;

export type ResolvedBuildingSource = Pick<ObservedBuildingSource, 'plan' | 'household' | 'workplaceOnly' | 'manifests'>;

/** Structural outcomes stay in their original journal until a reference-safe
 * migration admits the changed geometry; compaction must not reroll them. */
export function buildingSourceNeedsStructuralMigration(source: ObservedBuildingSource, history?: BuildingEventHistory): boolean {
  const previous = JSON.parse(source.historySignature) as BuildingEventHistory | null;
  return JSON.stringify(structuralBuildingHistoryEvents(history)) !== JSON.stringify(structuralBuildingHistoryEvents(previous ?? undefined));
}

/** Same exact JSON contract in the worker and interaction producer. This is a
 * drift detector, not an authorization token or a cryptographic attestation. */
export function buildingPlanSignature(plan: BlueprintPlan): string {
  return `blueprint-v1:${fnv1a(JSON.stringify(plan)).toString(36)}`;
}

function finiteJson(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object') return true;
  return Object.values(value).every(finiteJson);
}

/** Only a physically reached, same-plan producer supplies mountedSignature.
 * Refuse mixed compiled sources instead of calling a fresh reconstruction old.
 * The JSON copy prevents later generator/preview mutation from rewriting saves. */
export function captureObservedBuildingSource(
  input: Omit<ObservedBuildingSource, 'version' | 'provenance' | 'planSignature'>,
  mountedSignature: string | undefined,
): ObservedBuildingSource {
  const planSignature = buildingPlanSignature(input.plan);
  if (!mountedSignature || mountedSignature !== planSignature) throw new Error('The rendered building source has changed. Inspect it again after reloading.');
  if (![input.worldSeed, input.burgId, input.plotId, input.cellId].every(Number.isSafeInteger)
    || input.burgId < 0 || input.plotId < 0 || input.cellId < 0 || input.plan.buildingId !== input.plotId
    || !Number.isFinite(Date.parse(input.observedAt)) || !finiteJson(input)) throw new Error('Invalid observed building source.');
  return JSON.parse(JSON.stringify({version: 1, provenance: 'observed', ...input, planSignature}));
}

/** The reducer checks current world/cell/history/feet again. Captures cannot
 * overwrite an established record, even when a newer generator disagrees. A
 * future migration must be a separate reviewed transaction, not recapture. */
export function observedBuildingSourceIsCurrent(source: ObservedBuildingSource, context: {
  worldSeed: number; cellId: number | undefined;
  position: (Omit<BuildingSourcePosition, 'yM'> & {yM?: number}) | null | undefined;
  historySignature: string; existing?: ObservedBuildingSource;
}): boolean {
  const position = context.position;
  if (context.existing || !position || position.yM === undefined || source.version !== 1 || source.provenance !== 'observed'
    || source.worldSeed !== context.worldSeed || source.cellId !== context.cellId
    || source.plan.buildingId !== source.plotId || source.planSignature !== buildingPlanSignature(source.plan)
    || source.historySignature !== context.historySignature || !finiteJson(source)) return false;
  return source.position.tileX === position.tileX && source.position.tileY === position.tileY
    && Math.hypot(source.position.xM - position.xM, source.position.zM - position.zM,
      source.position.yM - position.yM) <= .05;
}

/** Resolve one retained foundation without calling a newer generator. Saved
 * condition events still replay through their existing owner, exactly once.
 * A new structural mass cannot silently repartition rooms or retarget goods:
 * its saved event remains intact and requires a compatible layout migration.
 * The caller surfaces that refusal; there is no fresh-generation fallback. */
export function readObservedBuildingSource(context: BuildingSourceContext, plotId: number,
  history?: BuildingEventHistory, townSeed?: SeedPath): ResolvedBuildingSource {
  const source = context.source;
  const expectedSeed = streamPath(childSeedPath(rootSeedPath(context.worldSeed), `burg:${context.burgId}`), 'town');
  if (source.version !== 1 || source.provenance !== 'observed' || source.worldSeed !== context.worldSeed
    || source.burgId !== context.burgId || source.plotId !== plotId || source.plan.buildingId !== plotId
    || (townSeed !== undefined && townSeed !== expectedSeed) || !finiteJson(source)
    || buildingPlanSignature(source.plan) !== source.planSignature) throw new Error('The retained building source does not match this place.');
  if (source.household && source.plan.household && source.household.homeId !== source.plan.household.homeId) {
    throw new Error('The retained household no longer matches its building source.');
  }
  // Manifests remain attached to their original floor/index and owner. A bad
  // saved join must never become contents for whichever new chest is nearby.
  for (const manifest of source.manifests) {
    const piece = source.plan.floors.find(f => f.level === manifest.level)?.furnishings[manifest.furnishingIndex];
    if (!piece || piece.kind !== manifest.kind
      || (source.plan.household && manifest.ownerHomeId !== source.plan.household.homeId)) {
      throw new Error('The retained building contents no longer match their original furnishing.');
    }
  }
  const previous = JSON.parse(source.historySignature) as BuildingEventHistory | null;
  const oldHistory = previous ?? undefined;
  const oldCount = buildingHistoryEventCount(oldHistory), count = buildingHistoryEventCount(history);
  const oldDigest = buildingHistoryEventDigest(oldHistory), digest = buildingHistoryEventDigest(history);
  if (count < oldCount || (count === oldCount && digest !== oldDigest)) {
    throw new Error('The retained building history has been replaced or removed.');
  }
  if (buildingSourceNeedsStructuralMigration(source, history)) {
    throw new Error('A structural building change needs a compatible retained-source migration.');
  }
  const copy = JSON.parse(JSON.stringify(source)) as ObservedBuildingSource;
  if (copy.furnishingRepair && (copy.furnishingRepair.version !== 1
    || copy.furnishingRepair.recipe !== FURNITURE_REPAIR_RECIPE
    || !Number.isFinite(Date.parse(copy.furnishingRepair.admittedAt)))) throw new Error('Invalid recorded furniture layout repair.');
  let foundation = copy.furnishingRepair ? applyFurnitureLayoutMoves(copy.plan, copy.furnishingRepair.moves) : copy.plan;
  if (copy.circulationRepair) {
    const revision = copy.circulationRepair;
    if (revision.version !== 1 || revision.recipe !== GUEST_CIRCULATION_RECIPE
      || !Number.isFinite(Date.parse(revision.admittedAt))
      || revision.sourceSignature !== buildingPlanSignature(foundation)
      || revision.planSignature !== buildingPlanSignature(revision.plan)
      || JSON.stringify(revision.doorMoves) !== JSON.stringify(guestCirculationDoorMoves(foundation, revision.plan))
      || !guestCirculationReferencesAgree(foundation, revision.plan)) throw new Error('The recorded guest layout no longer matches its original references.');
    // The admitted result is frozen. Future generator/roof changes cannot
    // silently rebuild the player's recorded rooms or history attachments.
    foundation = revision.plan;
  }
  let manifests=copy.manifests;
  if(copy.householdRevision){
    if(!copy.household||copy.circulationRepair)throw new Error('Incompatible recorded household layout.');
    if(copy.householdRevision.position.tileX!==copy.position.tileX||copy.householdRevision.position.tileY!==copy.position.tileY
      ||!outsideLayoutRepairEnvelope(foundation,copy.site,copy.householdRevision.position))throw new Error('Invalid recorded household layout admission position.');
    validateHouseholdLayoutRevision(foundation,copy.household,manifests,copy.householdRevision);
    foundation=copy.householdRevision.plan;
    manifests=copy.householdRevision.references.manifests;
  }
  return {
    plan: digest === oldDigest ? foundation : applyHistory(foundation, history ?? []),
    household: copy.household, workplaceOnly: copy.workplaceOnly, manifests,
  };
}
