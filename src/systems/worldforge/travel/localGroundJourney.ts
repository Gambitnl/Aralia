/** Local expeditions use source terrain and the normal overland costs before changing ground windows. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 19:07:14
 * Dependents: components/Worldforge/AtlasDemo.tsx, components/Worldforge/LocalJourneyPreview.tsx, hooks/app/useAppAtlasEntry.ts, systems/worldforge/town/townMapPosition.ts
 * Imports: 29 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '../../../types/state';
import type { TravelMeta } from '../../../types/travelMeta';
import type { RegionArtifact } from '../artifacts';
import { artifactsForAtlasGroundDrilldown, groundFocusesForLocal, type AtlasGroundDrilldown } from '../leaf3d/atlasGroundDrilldown';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../bridge/legacySubmapBridge';
import { entry3DAnchorForCell } from '../local/gridAtlasBridge';
import { biomeIdForCell } from '../local/biomeForCell';
import { FEET_PER_FMG_PIXEL } from '../adapter/atlasArtifact';
import { generateRegion } from '../region/generateRegion';
import { makeSeedPath, rootSeedPath, rngFromPath } from '../seedPath';
import { landSpeedFactor, landDanger, navDC, climbFactorFor } from './routeTerrain';
import { planFastestRoute, type RoutePlan, type TravelGraph } from '../../travel/routePlanning';
import { partyExhaustionLevel, exhaustedSpeedMph } from '../../travel/forcedMarch';
import { getSeasonalTravelCostMultiplier } from '../../time/seasonContract';
import { deriveNavDrift } from '../../travel/navDrift';
import { bestPartyCheckTotal, rollTripEvent } from '../../travel/tripEvents';
import { rollTravelEncounter } from '../../travel/travelEncounter';
import { pickTravelEncounterMonsters } from '../../travel/travelEncounterMonsters';
import { daysOfFood, daysOfWater, tripDaysAndRemainder } from '../../travel/provisioning';
import { decideTravelProvision } from '../../travel/travelProvisionDecision';
import { calculateForcedMarchStatus } from '../../travel/TravelCalculations';
import { BIOMES } from '../../../data/biomes';
import { getAbilityModifierValue } from '../../../utils/character/statUtils';
import { restoreAtlasGroundDrilldown } from '../leaf3d/atlasGroundRestore';
import { localWithDeltas } from '../bridge/groundDeltas';
import { planLocalTownStreetRoute } from './localTownStreetRoute';

type Point = [number, number];
const FT_PER_M = 1 / 0.3048;
const STEP_FT = 500;
const PADDING_FT = 3000;

export interface LocalJourneyQuote {
  key: string;
  label: string;
  biomeId: string;
  route: RoutePlan;
  meta: TravelMeta;
  totalSeconds: number;
  encounterChance: number;
  allowed: boolean;
  refusal?: string;
  /** Present only when the complete route qualifies on real town streets. */
  routeKind?: 'town-streets';
}

/** The saved body's meters belong to its own window, never the newly selected Local. */
export function acceptedGroundPoint(state: GameState): Point | null {
  const body = state.playerGroundPos;
  const cell = state.playerCell?.cellId;
  if (!body || cell == null || body.tileX !== cell || body.tileY !== 0 ||
      !Number.isFinite(body.xM) || !Number.isFinite(body.zM)) return null;
  const receipt = state.atlasGroundAddress;
  if (receipt && (receipt.worldSeed !== state.worldSeed || receipt.atlasCellId !== cell)) return null;
  const bounds = receipt?.localBounds ?? getWorldforgeLocalForCell(state.worldSeed, cell, {
    centerPx: state.entry3DAnchor?.centerPx ?? entry3DAnchorForCell(getBridgeAtlas(state.worldSeed), cell).centerPx,
    townLayouts: state.townSim,
  }).local.bounds;
  if (body.xM < 0 || body.zM < 0 || body.xM * FT_PER_M > bounds.width || body.zM * FT_PER_M > bounds.height) return null;
  return [bounds.x + body.xM * FT_PER_M, bounds.y + body.zM * FT_PER_M];
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

type LocalTerrainBlockage = 'outside' | 'unsurveyed' | 'water' | 'river';

/** Keep route admission and its explanation on the same surveyed terrain and
 * crossing footprints. A mapped river corridor is not proof that the player's
 * rendered feet are underwater; Town and regional support can still disagree. */
function createLocalTerrainAdmission(regions: readonly RegionArtifact[], ownsPoint: (point: Point) => boolean) {
  const crossings = [...new Map(regions.flatMap(r => r.crossings ?? []).map(c => [c.id, c])).values()];
  const heightAt = (p: Point): number | null => {
    const r = regions.find(r => p[0] >= r.bounds.x && p[1] >= r.bounds.y && p[0] <= r.bounds.x + r.bounds.width && p[1] <= r.bounds.y + r.bounds.height);
    if (!r) return null;
    const h = r.heightfield;
    const x = Math.min(h.width - 1, Math.max(0, Math.round((p[0] - r.bounds.x) / h.resolutionFt)));
    const y = Math.min(h.height - 1, Math.max(0, Math.round((p[1] - r.bounds.y) / h.resolutionFt)));
    return h.samples[y * h.width + x];
  };
  const rivers = regions.flatMap(r => r.rivers);
  const blockageAt = (p: Point): LocalTerrainBlockage | null => {
    if (!ownsPoint(p)) return 'outside';
    const height = heightAt(p);
    if (height == null || !Number.isFinite(height)) return 'unsurveyed';
    if (height < 0.2) return 'water';
    for (const river of rivers) {
      for (let i = 1; i < river.centerline.length; i++) {
        // One water (2026-10-30): the river's own width on this segment.
        if (distanceToSegment(p, river.centerline[i - 1], river.centerline[i]) >= river.widthFtAt[i - 1] / 2 + 10) continue;
        const crossing = crossings.some(c => {
          if (c.riverId !== river.riverId) return false;
          const dx = p[0] - c.point[0], dy = p[1] - c.point[1];
          return Math.abs(dx * c.roadDirection[0] + dy * c.roadDirection[1]) <= c.spanFt / 2 + 20 &&
            Math.abs(dx * c.riverDirection[0] + dy * c.riverDirection[1]) <= c.widthFt / 2;
        });
        if (!crossing) return 'river';
      }
    }
    return null;
  };
  return { heightAt, blockageAt, crossings };
}

/** Explain a refused endpoint before any trip time, supplies or events commit.
 * This reports the existing map constraint; it never creates a crossing or
 * grants walking permission where the source route remains unqualified. */
export function localTerrainEndpointRefusal(
  point: Point, regions: readonly RegionArtifact[], endpoint: 'departure' | 'destination',
  ownsPoint: (point: Point) => boolean = () => true,
): string | null {
  const blockage = createLocalTerrainAdmission(regions, ownsPoint).blockageAt(point);
  if (!blockage) return null;
  if (blockage === 'river') return endpoint === 'departure'
    ? 'The local map places your departure inside a river corridor without a recorded crossing. This journey has not started.'
    : 'The selected destination lies in a mapped river corridor without a recorded crossing. Choose a land approach or a recorded crossing.';
  if (blockage === 'outside') return 'This route would leave the selected world area. Approach through world travel.';
  if (blockage === 'water') return endpoint === 'departure'
    ? 'The local map does not show a land departure at your current position. This journey has not started.'
    : 'The local map does not show a land arrival at the selected destination. Choose a land approach.';
  return endpoint === 'departure'
    ? 'The ground at your departure has not been surveyed for this route. This journey has not started.'
    : 'The ground at the selected destination has not been surveyed for this route. Choose another approach.';
}

/** A bounded regional graph. Water stays blocked except inside an authored crossing footprint. */
export function planLocalTerrainRoute(
  origin: Point, destination: Point, regions: readonly RegionArtifact[], speedMph: number,
  speedFactor: number, danger: number, seasonMultiplier: number,
  ownsPoint: (point: Point) => boolean = () => true,
): RoutePlan | null {
  const minX = Math.floor((Math.min(origin[0], destination[0]) - PADDING_FT) / STEP_FT) * STEP_FT;
  const minY = Math.floor((Math.min(origin[1], destination[1]) - PADDING_FT) / STEP_FT) * STEP_FT;
  const cols = Math.ceil((Math.max(origin[0], destination[0]) + PADDING_FT - minX) / STEP_FT) + 1;
  const rows = Math.ceil((Math.max(origin[1], destination[1]) + PADDING_FT - minY) / STEP_FT) + 1;
  if (cols * rows > 12000 || speedMph <= 0) return null;
  const points: Point[] = [origin, destination];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) points.push([minX + x * STEP_FT, minY + y * STEP_FT]);
  // Exact bridge/ford approaches keep a narrow crossing usable without widening
  // the river or pretending a coarse grid vertex happens to hit its deck.
  const bridgeEdges = new Map<number, number>();
  const { heightAt, blockageAt, crossings } = createLocalTerrainAdmission(regions, ownsPoint);
  for (const c of crossings) {
    const reach = c.spanFt / 2 + 150;
    const a = points.length;
    points.push([c.point[0] - c.roadDirection[0] * reach, c.point[1] - c.roadDirection[1] * reach]);
    const b = points.length;
    points.push([c.point[0] + c.roadDirection[0] * reach, c.point[1] + c.roadDirection[1] * reach]);
    bridgeEdges.set(a, b); bridgeEdges.set(b, a);
  }
  const dry = (p: Point): boolean => blockageAt(p) === null;
  const edgeCache = new Map<string, boolean>();
  const canWalk = (a: number, b: number): boolean => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const cached = edgeCache.get(key); if (cached !== undefined) return cached;
    const p = points[a], q = points[b], count = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 25));
    let safe = true;
    for (let i = 0; i <= count; i++) if (!dry([p[0] + (q[0] - p[0]) * i / count, p[1] + (q[1] - p[1]) * i / count])) { safe = false; break; }
    edgeCache.set(key, safe); return safe;
  };
  const gridEnd = 2 + cols * rows;
  const attachments = new Map<number, number[]>();
  for (const special of [0, 1, ...bridgeEdges.keys()]) {
    const near: number[] = [];
    for (let n = 2; n < gridEnd; n++) if (Math.hypot(points[n][0] - points[special][0], points[n][1] - points[special][1]) <= STEP_FT * 1.6 && canWalk(special, n)) near.push(n);
    attachments.set(special, near);
  }
  const graph: TravelGraph = {
    position: n => points[n], terrain: () => 'difficult', danger: () => danger,
    passable: n => dry(points[n]), speedFactor: () => speedFactor,
    climbFactor: (a, b) => climbFactorFor(((heightAt(points[b]) ?? 0) - (heightAt(points[a]) ?? 0)) * 100, null),
    neighbors: n => {
      const result = [...(attachments.get(n) ?? [])];
      if (n >= 2 && n < gridEnd) {
        const x = (n - 2) % cols, y = Math.floor((n - 2) / cols);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || x + dx < 0 || x + dx >= cols || y + dy < 0 || y + dy >= rows) continue;
          const q = n + dy * cols + dx; if (canWalk(n, q)) result.push(q);
        }
        for (const [special, near] of attachments) if (near.includes(n)) result.push(special);
      }
      const other = bridgeEdges.get(n); if (other != null && canWalk(n, other)) result.push(other);
      if (n === 0 && Math.hypot(origin[0] - destination[0], origin[1] - destination[1]) <= STEP_FT && canWalk(0, 1)) result.push(1);
      return result;
    },
  };
  if (!graph.passable(0) || !graph.passable(1)) return null;
  return planFastestRoute(graph, 0, 1, { milesPerUnit: 1 / 5280, speedMph, timeCostMultiplier: seasonMultiplier });
}

const terrainCache = new Map<string, RegionArtifact[]>();
function journeyRegions(seed: number, cell: number, origin: Point, destination: Point): RegionArtifact[] {
  const key = `${seed}:${cell}:${origin.join(',')}:${destination.join(',')}`;
  const cached = terrainCache.get(key); if (cached) return cached;
  const atlas = getBridgeAtlas(seed), result: RegionArtifact[] = [];
  const loX = Math.min(origin[0], destination[0]) - PADDING_FT - STEP_FT;
  const hiX = Math.max(origin[0], destination[0]) + PADDING_FT + STEP_FT;
  const loY = Math.min(origin[1], destination[1]) - PADDING_FT - STEP_FT;
  const hiY = Math.max(origin[1], destination[1]) + PADDING_FT + STEP_FT;
  for (let y = loY; y <= hiY; y += 20000) for (let x = loX; x <= hiX; x += 20000) {
    result.push(generateRegion(atlas, cell, rootSeedPath(seed), { feetPerPixel: FEET_PER_FMG_PIXEL, resolutionFt: 100, world: atlas,
      windowCenterPx: [(x + 10000) / FEET_PER_FMG_PIXEL, (y + 10000) / FEET_PER_FMG_PIXEL], applySettlementFloor: false }));
  }
  if (terrainCache.size >= 4) terrainCache.delete(terrainCache.keys().next().value!);
  terrainCache.set(key, result); return result;
}

export function quoteLocalGroundJourney(state: GameState, drilldown: AtlasGroundDrilldown): LocalJourneyQuote {
  artifactsForAtlasGroundDrilldown(drilldown);
  // A valid historical save address does not make a wall endpoint a new entrance.
  if (!groundFocusesForLocal(drilldown.local).some(focus => focus.kind === drilldown.focus.kind
    && focus.id === drilldown.focus.id && focus.label === drilldown.focus.label
    && focus.xFt === drilldown.focus.xFt && focus.yFt === drilldown.focus.yFt)) {
    throw new Error('This former road arrival is not a town entrance. Choose an authored gate on the local map.');
  }
  if (drilldown.worldSeed !== state.worldSeed || drilldown.atlasCellId !== state.playerCell?.cellId ||
      state.currentLocationId !== `cell_${drilldown.atlasCellId}`) throw new Error('Travel to this area on the world map before choosing a local destination.');
  if (!state.party.length || state.party.some(pc => pc.hp <= 0)) throw new Error('The party must be able to travel before setting out.');
  const origin = acceptedGroundPoint(state);
  if (!origin) throw new Error('Return to your current ground position before planning a local journey.');
  const destination: Point = [drilldown.focus.xFt, drilldown.focus.yFt];
  if (Math.hypot(origin[0] - destination[0], origin[1] - destination[1]) > 60000) throw new Error('This destination is beyond the local route planner. Approach it through world travel.');
  const biomeId = biomeIdForCell(state.worldSeed, drilldown.atlasCellId);
  if (!biomeId || !BIOMES[biomeId]?.passable) throw new Error('No passable land route is known here.');
  const atlas = getBridgeAtlas(state.worldSeed);
  const biomeIndex = (atlas.pack.cells as unknown as { biome: ArrayLike<number> }).biome[drilldown.atlasCellId];
  const biomeName = atlas.biomesData.name[biomeIndex];
  const speed = exhaustedSpeedMph(3, partyExhaustionLevel(state.party));
  const restored = state.atlasGroundAddress ? restoreAtlasGroundDrilldown(state.atlasGroundAddress, state.worldSeed, state.townSim) : null;
  if (restored && restored.status !== 'ready') throw new Error('Your saved departure terrain could not be restored. Return to your current position first.');
  const originRegion = restored?.status === 'ready' ? restored.drilldown.region : getWorldforgeLocalForCell(state.worldSeed, drilldown.atlasCellId, { centerPx: state.entry3DAnchor?.centerPx ?? entry3DAnchorForCell(atlas, drilldown.atlasCellId).centerPx , townLayouts: state.townSim}).region;
  // The accepted Local's padded land remains authoritative where it exists.
  // The rest of the corridor is surveyed without creating new settlement pads.
  const sourceRegions = [...(originRegion ? [originRegion] : []), drilldown.region,
    ...journeyRegions(state.worldSeed, drilldown.atlasCellId, origin, destination)];
  const ownsPoint = (p: Point) => atlas.pack.cells.q?.find(p[0] / FEET_PER_FMG_PIXEL, p[1] / FEET_PER_FMG_PIXEL)?.[2] === drilldown.atlasCellId;
  const departureRefusal = localTerrainEndpointRefusal(origin, sourceRegions, 'departure', ownsPoint);
  if (departureRefusal) throw new Error(departureRefusal);
  const arrivalRefusal = localTerrainEndpointRefusal(destination, sourceRegions, 'destination', ownsPoint);
  if (arrivalRefusal) throw new Error(arrivalRefusal);
  const admission = createLocalTerrainAdmission(sourceRegions, ownsPoint);
  const streetPlan = drilldown.local.townPlan
    ? localWithDeltas(drilldown.local, drilldown.local.townPlan, state.worldforgeDeltas ?? []).townPlan : undefined;
  const townRoute = planLocalTownStreetRoute(origin, destination, streetPlan, speed, biomeName,
    getSeasonalTravelCostMultiplier(state.gameTime), point => admission.blockageAt(point) === null, admission.heightAt);
  // A named town or gate is not enough. Only a connected, continuously public
  // street route earns the existing maintained-road costs and navigation rule.
  // Otherwise retain the same surveyed-country planner and seeded outcomes.
  const planned = townRoute ?? planLocalTerrainRoute(origin, destination, sourceRegions, speed,
    landSpeedFactor(biomeName, null), landDanger(biomeName, null), getSeasonalTravelCostMultiplier(state.gameTime),
    ownsPoint);
  if (!planned) throw new Error('No walkable route reaches this focus through the surveyed terrain and crossings. Choose another approach.');
  // Regional graph vertices are not Atlas identities. Keep the actual owning
  // cell on every route point handed to travel encounters and source extraction.
  const route = { ...planned, cells: planned.miles < 1 / 5280 ? [drilldown.atlasCellId] : planned.cells.map(() => drilldown.atlasCellId) };
  const day = state.gameTime.toISOString().slice(0, 10);
  const path = makeSeedPath(state.worldSeed, `local-journey:${drilldown.atlasCellId}:${origin.map(Math.round).join(',')}:${destination.map(Math.round).join(',')}:${day}`);
  const survival = Math.max(...state.party.map(pc => getAbilityModifierValue(pc.finalAbilityScores?.Wisdom ?? pc.abilityScores?.Wisdom ?? 10) +
    (pc.skills?.some(s => s.id === 'survival') ? pc.proficiencyBonus ?? 2 : 0)));
  const navDrift = deriveNavDrift(() => ({ dc: navDC(biomeName, townRoute ? 'road' : null), cause: townRoute ? 'road' : 'wilds' }), route.cells, route.points, survival, rngFromPath(`${path}/navigation`));
  const tripRng = rngFromPath(`${path}/event`);
  const tripEvent = rollTripEvent(route.cells, () => biomeId, skill => bestPartyCheckTotal(state.party, skill, tripRng), tripRng);
  const seconds = Math.round(route.minutes * 60);
  const totalSeconds = seconds + (navDrift?.extraSeconds ?? 0) + (tripEvent?.extraSeconds ?? 0);
  const { days, remainderMinutes } = tripDaysAndRemainder(totalSeconds / 60, state.travelMinutesRemainder);
  const decision = decideTravelProvision({ foodDays: daysOfFood(state.inventory), waterDays: daysOfWater(state.inventory), partySize: state.party.length, tripDays: days, mode: 'full' });
  // One local leg stays one Atlas-cell exposure. Regional routing vertices must
  // not multiply an ordinary walk into dozens of independent ambush rolls.
  const encounterRoute = { ...route, cells: route.cells.length < 2 ? route.cells : [drilldown.atlasCellId, drilldown.atlasCellId], points: [origin, destination] };
  const dangerRoll = rollTravelEncounter(encounterRoute, path);
  const forced = calculateForcedMarchStatus(totalSeconds / 3600);
  const meta: TravelMeta = { seconds, navDrift, tripEvent,
    destinationCell: { cellId: drilldown.atlasCellId, anchor: { cellId: drilldown.atlasCellId, centerPx: [destination[0] / FEET_PER_FMG_PIXEL, destination[1] / FEET_PER_FMG_PIXEL] }, name: drilldown.focus.label },
    provision: { rationsToSpend: decision.rationsToSpend, waterToSpend: decision.waterToSpend, remainderMinutes },
    ...(forced.isForcedMarch && forced.constitutionSaveDC > 0 ? { forcedMarch: { hours: totalSeconds / 3600, saveDC: forced.constitutionSaveDC } } : {}),
    ...(dangerRoll.encounter ? { encounterMessage: 'Danger interrupts your journey.', encounter: { kind: 'land-route-ambush' as const, monsters: pickTravelEncounterMonsters(route, path), routeCells: route.cells } } : {}),
  };
  const key = JSON.stringify([path, origin, destination, state.party.map(p => [p.id, p.hp, p.conditions]), state.inventory, state.travelMinutesRemainder, meta,
    ...(townRoute ? ['town-streets', route.points] : [])]);
  return { key, label: drilldown.focus.label, biomeId, route, meta, totalSeconds, encounterChance: dangerRoll.chance,
    ...(townRoute ? {routeKind: 'town-streets' as const} : {}),
    allowed: decision.status.inRange, refusal: decision.status.inRange ? undefined : 'Carry enough food and water before setting out.' };
}

/** Off-road interception frames the exact retained Local at arrival, never its nearest road. */
export async function prepareLocalJourneyBattlefield(drilldown: AtlasGroundDrilldown, state: GameState, arrivalSeconds: number) {
  const { region, local } = artifactsForAtlasGroundDrilldown(drilldown);
  const [{ createGroundChunkLoader, extractLocalTerrainPatch }, { groundStartForFocus }, { battleMapThemeForGround }, { allGroundAgentsAt }] = await Promise.all([
    import('../bridge/groundChunkLoader'), import('../leaf3d/atlasGroundDrilldown'),
    import('../../combat/worldScenario/travelAmbushBattlefield'), import('../bridge/groundAgentMotion'),
  ]);
  const arrival = new Date(state.gameTime.getTime() + arrivalSeconds * 1000);
  const hour = arrival.getUTCHours() + arrival.getUTCMinutes() / 60;
  const { ground } = createGroundChunkLoader(local, state.worldSeed, region, { anchorCellId: drilldown.atlasCellId, hour, deltas: state.worldforgeDeltas });
  const [x, z] = groundStartForFocus(local, drilldown.focus);
  const map = extractLocalTerrainPatch(ground, x, z, battleMapThemeForGround(ground), state.worldSeed,
    { width: 80, height: 60, occupants: allGroundAgentsAt(ground, hour) });
  map.provenance = { kind: 'worldforge', worldSeed: state.worldSeed, anchorCellId: drilldown.atlasCellId,
    scenarioId: `local-journey:${drilldown.localSeedPath}`, locationLabel: drilldown.focus.label,
    anchorWorldMeters: { x, z }, generationPath: ['World', drilldown.regionSeedPath, drilldown.localSeedPath, 'Ground', 'Local journey arrival', 'Tactical patch'] };
  return { extractedBattleMap: map };
}
