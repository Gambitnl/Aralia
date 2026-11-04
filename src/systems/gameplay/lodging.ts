/** Guest-bed permission and payment rules shared by the inn UI, action handlers
 * and reducers. Blueprint rooms and the existing keeper schedule stay authoritative.
 * A paid reservation grants one party rest within a day, with food still separate. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/10/2026, 22:45:21
 * Dependents: components/World3D/GuestBedRestAction.tsx, components/World3D/World3DWrapper.tsx, components/Worldforge/TownBuildingInspector.tsx, components/layout/GameModals.tsx, hooks/actions/actionHandlers.ts, hooks/actions/handleLodging.ts, hooks/actions/handleResourceActions.ts, state/reducers/characterReducer.ts, state/reducers/worldReducer.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../types/state';
import { getPartyFundsGp, payPartyFunds } from '../economy/partyFunds';
import type { GuestBedReference, LodgingOffer, LodgingReservation, LodgingRestAdmission } from '../../types/rest';
import type { TownBuildingVisit } from '../worldforge/town/townBuildingVisit';
import type { GroundWorld } from '../worldforge/bridge/groundChunkLoader';
import type { LocalArtifact, RegionArtifact } from '../worldforge/artifacts';
import { inspectGroundWater } from '../worldforge/bridge/groundWaterSurfaceQuery';
import { normalizeDungeonExplorationPosition } from '../worldforge/dungeon/world/dungeonLifecycle';
import {projectSurfaceHostileOutcomes, surfaceHostileSourceScope, SURFACE_HOSTILE_CONTACT_RADIUS_M} from '../combat/worldScenario/surfaceHostileContinuity';

export const LODGING_COST_PER_MEMBER_GP = 0.5;
export const LODGING_DURATION_MS = 24 * 3600000;
export const LONG_REST_DURATION_MS = 8 * 3600000;

export function guestBedsForVisit(visit: TownBuildingVisit): GuestBedReference[] {
  if (visit.plan.type !== 'inn' && visit.plan.type !== 'tavern') return [];
  return visit.plan.floors.flatMap(floor => floor.furnishings.flatMap((piece, index) => {
    const room = floor.rooms.find(candidate => candidate.id === piece.roomId);
    // A family's assigned bedroom is never spare commercial accommodation.
    return piece.kind === 'bed' && room?.purpose === 'guest-room' && !room.forSlot
      ? [{ level: floor.level, index, roomId: room.id }] : [];
  }));
}

/** Keep actual beds and old bookings intact. New offers must not sell an
 * upstairs bed behind the legacy 277 mm risers that normal walking refuses.
 * A return flight clears this known structural refusal only; body clearance,
 * room privacy, doors and actual arrival still have their normal gates. */
export function guestBedStairIssue(visit: TownBuildingVisit, bed: GuestBedReference): string | null {
  for (let level = Math.min(0, bed.level); level < Math.max(0, bed.level); level++) {
    if (!visit.plan.stairs?.some(stair => stair.fromLevel === level && stair.layout?.kind === 'return')) {
      return 'No usable stair route reaches this guest room.';
    }
  }
  return null;
}

/** A separate commercial selection: never filter the canonical bed inventory
 * used to validate retained reservations, property and historical references. */
export function guestBedsWithStairAccess(visit: TownBuildingVisit): GuestBedReference[] {
  return guestBedsForVisit(visit).filter(bed => !guestBedStairIssue(visit, bed));
}

/** The blueprint numbers non-corridor rooms in display order. A source room ID
 * can have gaps, so adding one to that ID gives directions to the wrong label. */
export function guestBedDescription(visit: TownBuildingVisit, bed: GuestBedReference): string {
  const floor = visit.plan.floors.find(candidate => candidate.level === bed.level);
  const index = floor?.rooms.filter(room => !room.isCorridor).findIndex(room => room.id === bed.roomId) ?? -1;
  return `${index >= 0 ? `Room ${index + 1}` : 'Guest room'}, ${bed.level === 0 ? 'ground floor' : `floor ${bed.level}`}`;
}

/** Room-door operation uses the current paid party and exact guest bed
 * catalogue. A stale array index, family room or changed keeper grants nothing.
 * Leaving an occupied bedroom is handled separately by physical door reach. */
export function lodgingRoomDoorAccess(state:GameState,visit:TownBuildingVisit,businessId:string):ReadonlySet<string>{
  const stay=activeLodgingReservation(state,businessId),business=state.worldBusinesses?.[businessId];
  if(!stay||visit.plot.id!==stay.plotId||visit.plan.buildingId!==stay.plotId||!business||business.ownerId!==stay.keeperId||business.burgId!==stay.burgId||business.plotId!==stay.plotId
    ||business.locationId!==stay.locationId||stay.locationId!==state.currentLocationId
    ||stay.cellId!==state.playerCell?.cellId||!sameParty(state,stay.partyIds))return new Set();
  const beds=guestBedsForVisit(visit);
  return new Set(stay.beds.filter(bed=>beds.some(current=>current.level===bed.level&&current.roomId===bed.roomId&&current.index===bed.index))
    .map(bed=>bed.level+':'+bed.roomId));
}

export function lodgingKeeperOnDuty(visit: TownBuildingVisit, hour: number): boolean {
  // A room sale requires an actual source keeper. An unstaffed or retired inn
  // cannot consent through a fallback merchant or a merely visible floor plan.
  return Boolean(visit.household && visit.occupancy?.stationsByHour[((Math.floor(hour) % 24) + 24) % 24]
    ?.some(station => station.memberIndex === 0 && station.where === 'home' && station.activity === 'work'));
}

const sameParty = (state: GameState, ids: string[]) => state.party.length > 0
  && state.party.length === ids.length && new Set(ids).size === ids.length
  && state.party.every(member => Boolean(member.id) && ids.includes(member.id!));

export function activeLodgingReservation(state: GameState, businessId: string): LodgingReservation | undefined {
  const now = new Date(state.gameTime).getTime();
  return state.lodgingReservations?.find(stay => stay.businessId === businessId
    && stay.worldSeed === state.worldSeed && !stay.usedAt && Date.parse(stay.expiresAt) > now);
}

/** Validate a displayed quote against live party, ownership, stock of beds and time. */
export function lodgingOfferError(state: GameState, offer: LodgingOffer): string | null {
  const business = state.worldBusinesses?.[offer.businessId];
  const now = new Date(state.gameTime).getTime();
  const quotedAt = Date.parse(offer.quotedAt);
  if (!business || business.ownerId !== offer.keeperId || business.locationId !== offer.locationId
    || business.burgId !== offer.burgId || business.plotId !== offer.plotId) return 'The inn or its keeper has changed. Request a new offer.';
  if (state.worldSeed !== offer.worldSeed || state.currentLocationId !== offer.locationId
    || state.playerCell?.cellId !== offer.cellId || business.locationId !== state.currentLocationId) return 'You must be in the inn’s settlement to reserve its guest beds.';
  if (!sameParty(state, offer.partyIds) || !state.party.some(member => member.hp > 0)) return 'The party has changed or cannot arrange a stay. Request a new offer.';
  if (!Number.isFinite(now) || !Number.isFinite(quotedAt) || now < quotedAt || now - quotedAt > 5 * 60000) return 'This lodging offer has expired. Ask the keeper again.';
  if (!Number.isFinite(offer.costGp) || offer.costGp !== state.party.length * LODGING_COST_PER_MEMBER_GP
    || offer.beds.some(bed => ![bed.level, bed.index, bed.roomId].every(Number.isInteger) || bed.index < 0 || bed.roomId < 0)
    || offer.beds.length !== state.party.length || new Set(offer.beds.map(bed => `${bed.level}:${bed.index}`)).size !== offer.beds.length) return 'The room offer is incomplete. Ask the keeper again.';
  if (activeLodgingReservation(state, offer.businessId)) return 'You already have an unused reservation here.';
  if (!payPartyFunds(state, offer.costGp)) return `The stay costs ${offer.costGp} GP; you have ${getPartyFundsGp(state)} GP.`;
  return null;
}

/** One atomic reducer update debits the posted price and records permission. */
export function reserveLodging(state: GameState, offer: LodgingOffer): Partial<GameState> {
  if (lodgingOfferError(state, offer)) return {};
  // Commit the same face-value payment with bed permission; no second debit
  // or coin consolidation runs when a quote is canceled, reopened or repeated.
  const payment = payPartyFunds(state, offer.costGp);
  if (!payment) return {};
  const now = new Date(state.gameTime);
  const reservation: LodgingReservation = {
    ...offer,
    id: `lodging:${offer.worldSeed}:${offer.businessId}:${now.getTime()}`,
    paidAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + LODGING_DURATION_MS).toISOString(),
  };
  return {
    ...payment,
    lodgingReservations: [...(state.lodgingReservations ?? []), reservation],
    lodgingOffer: null,
  };
}

export function lodgingRestError(state: GameState, admission: LodgingRestAdmission): string | null {
  const stay = state.lodgingReservations?.find(candidate => candidate.id === admission.reservationId);
  if (!stay || stay.usedAt) return 'This reservation is missing or has already been used.';
  const now = new Date(state.gameTime).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(Date.parse(stay.expiresAt)) || Date.parse(stay.expiresAt) < now + LONG_REST_DURATION_MS) return 'There is not enough time left in this reservation for an eight-hour rest.';
  if (stay.worldSeed !== state.worldSeed || stay.locationId !== state.currentLocationId
    || stay.cellId !== state.playerCell?.cellId || !sameParty(state, stay.partyIds)) return 'The reservation belongs to another place or party.';
  if (!stay.beds.some(bed => bed.level === admission.bed.level && bed.index === admission.bed.index && bed.roomId === admission.bed.roomId)) return 'This bed is not included in the reservation.';
  const current = state.playerGroundPos;
  const admitted = admission.position;
  if (!current || current.tileX !== admitted.tileX || current.tileY !== admitted.tileY
    || ![current.xM, current.zM, current.yM, admitted.xM, admitted.zM, admitted.yM].every(value => Number.isFinite(value))
    || Math.hypot(current.xM - admitted.xM, current.zM - admitted.zM, current.yM! - admitted.yM!) > 0.1) return 'Return to your reserved bed before resting.';
  return null;
}

export function consumeLodgingRest(state: GameState, admission: LodgingRestAdmission): Partial<GameState> {
  if (lodgingRestError(state, admission)) return {};
  return { lodgingReservations: state.lodgingReservations!.map(stay => stay.id === admission.reservationId
    ? { ...stay, usedAt: new Date(new Date(state.gameTime).getTime() + LONG_REST_DURATION_MS).toISOString() } : stay) };
}

/** The saved native address reconstructs the same plots used by Town Plan.
 * Switching to the 2D view cannot turn someone's property into a free camp.
 * Generated ground without a native address uses its existing cell/center anchor;
 * locations that have no ground position keep their established rest rules. */
async function restSourceFrame(state: GameState): Promise<{local: LocalArtifact; region: RegionArtifact} | {error: string} | null> {
  if (!state.playerGroundPos || state.worldSeed == null) return null;
  const [{restoreAtlasGroundDrilldown}, {getWorldforgeLocalForCell}] = await Promise.all([
    import('../worldforge/leaf3d/atlasGroundRestore'),
    import('../worldforge/bridge/legacySubmapBridge'),
  ]);
  const restored = state.atlasGroundAddress ? restoreAtlasGroundDrilldown(state.atlasGroundAddress, state.worldSeed, state.townSim, state.worldforgeTerrainRevision) : null;
  if (restored && restored.status !== 'ready') return {error: 'The resting place could not be verified. Return to your current location before resting.'};
  const anchorCell = state.entry3DAnchor?.cellId ?? state.playerCell?.cellId;
  if (!restored && (anchorCell == null || state.playerGroundPos.tileX !== anchorCell || state.playerGroundPos.tileY !== 0)) return {error: 'The resting place could not be verified. Return to your current location before resting.'};
  return restored?.status === 'ready' ? restored.drilldown
    : getWorldforgeLocalForCell(state.worldSeed, anchorCell!, {centerPx: state.entry3DAnchor?.centerPx, townLayouts: state.townSim, terrainRevision: state.worldforgeTerrainRevision});
}

/** Read the water surfaces already drawn by the world; do not flatten a river,
 * raise the body, or turn its submerged channel floor into a safe campsite. */
export function submergedRestError(ground: GroundWorld, point: {xM: number; zM: number; yM?: number}): string | null {
  if (![point.xM, point.zM, point.yM].every(Number.isFinite)) return 'Your footing must be verified in the world before resting here.';
  const water = inspectGroundWater(ground, point.xM, point.zM);
  if (water.status === 'unavailable') return 'The water at your resting place could not be verified. Reach verified dry, supported ground before resting.';
  const waterY = water.surfaceY;
  return waterY !== undefined && waterY > point.yM! + 0.05
    ? 'You are below the water surface. Reach dry, supported ground before taking an ordinary rest.' : null;
}

// Keep only two deterministic source queries. A changed plot/history gets a new
// key; reviewing a dialog does not rebuild the world on every render or tick.
const restGroundCache = new Map<string, GroundWorld>();
function restGroundKey(state: GameState): string {
  const history = Object.fromEntries(Object.entries(state.townSim ?? {})
    .filter(([, town]) => Object.keys(town.buildingEvents ?? {}).length)
    .map(([id, town]) => [id, town.buildingEvents]));
  // A changed saved layout or observed foundation must not reuse another
  // world's footing or property verdict. Ordinary life/clock updates do not
  // change these geometry fingerprints or rebuild terrain on every dialog.
  const sources = Object.fromEntries(Object.entries(state.townSim ?? {}).map(([id, town]) => [id, {
    layoutRevision: town.layoutRevision,
    buildings: Object.fromEntries(Object.entries(town.buildingSources ?? {}).map(([plotId, source]) => [plotId,
      [source.planSignature, source.furnishingRepair?.recipe, source.circulationRepair?.planSignature, source.householdRevision?.planSignature]])),
  }]));
  const frame = state.atlasGroundAddress ?? state.entry3DAnchor ?? {cellId: state.playerCell?.cellId};
  return JSON.stringify([state.worldSeed, state.worldforgeTerrainRevision, frame, state.worldforgeDeltas ?? [], history, sources]);
}
/** The loader publishes its already-built source, using the state captured for
 * that generation. Opening a rest in the same world needs no second world build. */
export function rememberRestGround(state: GameState, ground: GroundWorld): void {
  const key = restGroundKey(state);
  if (restGroundCache.size >= 2 && !restGroundCache.has(key)) restGroundCache.delete(restGroundCache.keys().next().value!);
  restGroundCache.set(key, ground);
}
/** Use the same immediate contact threshold as ordinary combat admission.
 * Missing template data cannot make a living source threat safe to sleep beside.
 * Replay saved death/movement first so the cached generation never resurrects it. */
function groundRestEnvironmentError(state: GameState, ground: GroundWorld): string | null {
  const waterError = submergedRestError(ground, state.playerGroundPos!);
  if (waterError) return waterError;
  let hostiles: GroundWorld['hostiles'];
  try {
    hostiles = projectSurfaceHostileOutcomes(ground.hostiles ?? [], state.worldforgeEncounterReceipts ?? [],
      state.worldSeed!, state.playerCell?.cellId ?? state.playerGroundPos!.tileX, surfaceHostileSourceScope(state));
  } catch {
    return 'Nearby danger could not be verified, so resting here is unavailable.';
  }
  const point = state.playerGroundPos!;
  const threat = hostiles.find(body => Math.hypot(point.xM - body.xM, point.zM - body.zM) < SURFACE_HOSTILE_CONTACT_RADIUS_M);
  return threat ? threat.name + ' is too close for an ordinary rest or wait. Move out of immediate danger first.' : null;
}

export async function restEnvironmentError(state: GameState): Promise<string | null> {
  // A dungeon retains the outside body's return pose. It is not the party's
  // current campsite and cannot authorize recovery on an uncleared source floor.
  const insideExpedition = Object.values(state.dungeonExpeditions ?? {}).some(record => {
    const visit = normalizeDungeonExplorationPosition(record.progress.activeVisit);
    if (!visit) return false;
    return record.visitPhase === 'active' && visit.returnContext.worldSeed === state.worldSeed
      && visit.returnContext.cellId === state.playerCell?.cellId;
  });
  if (insideExpedition) return 'Resting inside this expedition is not available yet. Return through its entrance before resting outside.';
  if (!state.playerGroundPos || state.worldSeed == null) return null;
  const retained = restGroundCache.get(restGroundKey(state));
  if (retained) return groundRestEnvironmentError(state, retained);
  const source = await restSourceFrame(state);
  if (!source) return null;
  if ('error' in source) return source.error;
  const buildingEventLogs = Object.fromEntries(Object.entries(state.townSim ?? {}).map(([id, town]) => [id, town.buildingEvents ?? {}]));
  const key = restGroundKey(state);
  let ground = restGroundCache.get(key);
  if (!ground) {
    const {makeGroundWorld} = await import('../worldforge/bridge/groundChunkLoader');
    ground = makeGroundWorld(source.local, state.worldSeed!, source.region, {skipProps: true,
      anchorCellId: state.playerCell?.cellId, deltas: state.worldforgeDeltas ?? [], buildingEventLogs,
      townLife: state.townSim,
      buildingSources: Object.fromEntries(Object.entries(state.townSim ?? {}).map(([id, town]) => [id, town.buildingSources ?? {}]))});
    if (restGroundCache.size >= 2) restGroundCache.delete(restGroundCache.keys().next().value!);
    restGroundCache.set(key, ground);
  }
  return groundRestEnvironmentError(state, ground);
}

export async function propertyRestError(state: GameState): Promise<string | null> {
  const environmentError = await restEnvironmentError(state);
  if (environmentError) return environmentError;
  if (!state.playerGroundPos || state.worldSeed == null) return null;
  const source = await restSourceFrame(state);
  if (!source) return null;
  if ('error' in source) return source.error;
  const {local, region} = source;
  const [{canonicalArtifactTownForSiteFromAtlas}, {getBridgeAtlas}, {pointInPolygon}, {localWithDeltas}] = await Promise.all([
    import('../worldforge/town/canonicalTown'), import('../worldforge/bridge/legacySubmapBridge'),
    import('../worldforge/submap/submapEngine'), import('../worldforge/bridge/groundDeltas'),
  ]);
  const point: [number, number] = [local.bounds.x + state.playerGroundPos.xM / 0.3048,
    local.bounds.y + state.playerGroundPos.zM / 0.3048];
  for (const site of region.townSites ?? []) {
    const base = canonicalArtifactTownForSiteFromAtlas(getBridgeAtlas(state.worldSeed), state.worldSeed, site, state.townSim?.[site.burgId]?.layoutRevision).plan;
    const plan = state.worldforgeDeltas?.length ? (localWithDeltas(local, base, state.worldforgeDeltas).townPlan ?? base) : base;
    const plot = plan.plots.find(candidate => pointInPolygon(point, candidate.footprint));
    if (!plot) continue;
    const owner = state.worldBusinesses?.[`biz_burg_${site.burgId}_plot_${plot.id}`]?.ownerId;
    if (owner === 'player') return null;
    return 'This is occupied property. Use a reserved guest bed at an inn, or leave the property to make camp. Examining a bed does not grant permission.';
  }
  return null;
}
