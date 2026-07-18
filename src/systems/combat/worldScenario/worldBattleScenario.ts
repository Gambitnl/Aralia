// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:57:40
 * Dependents: components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx, systems/combat/worldScenario/travelAmbushBattlefield.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns one real WorldForge location into a reproducible combat-map
 * scenario and explains what survived the projection.
 *
 * WorldForge remains authoritative: callers assemble a GroundWorld through the
 * normal World -> Region -> Local -> Ground pipeline, then this adapter cuts the
 * five-foot tactical patch used by the existing combat engine. The visual test
 * harness consumes the returned diagnostics so missing bridges such as roads or
 * targetable object facts are visible instead of being disguised by extra art.
 *
 * Called by: PreviewBattleMapScenarioLab.tsx after the off-thread world builder
 * Depends on: groundChunkLoader's production terrain-patch extractor
 */
import type {
  BattleMapBiome,
  BattleMapData,
  BattleMapDecoration,
  BattleMapEncounterContext,
  CombatEnemySnapshotEntry,
  BattleMapSettlementHostility,
  BattleMapTerrain,
} from "@/types/combat";
import {
  extractLocalTerrainPatch,
  type GroundOccupantProjectionInput,
  type GroundWorld,
} from "@/systems/worldforge/bridge/groundChunkLoader";
import { GROUND_METERS_PER_CELL } from "@/systems/worldforge/bridge/groundWorldAdapter";
import {
  PROPS_BY_ID,
  propFootprintRadiusM,
} from "@/systems/worldforge/bridge/groundProps";
import { allGroundAgentsAt } from "@/systems/worldforge/bridge/groundAgentMotion";
import { projectSettlementDefendingForce } from "./settlementDefenderProjection";
import {
  createVisualHarnessHostileStateInput,
  createVisualHarnessWantedWatchInput,
  resolveSettlementEncounterHostility,
  type SettlementEncounterHostilityInput,
} from "./settlementEncounterHostility";
import { projectLiveSettlementEncounter } from "./liveSettlementEncounter";
import {
  projectOpeningThreatBattlefield,
  projectResolvedOpeningThreatReturnBattlefield,
} from "./openingThreatBattlefield";
import { resolveOpeningThreatSceneAfterCombat } from "./openingThreatOutcome";

// ============================================================================
// Reproducible Scenario Recipes
// ============================================================================
// These recipes name useful, real places in seed 42. The first isolates natural
// feature composition; the second stresses buildings, roads, and catalog props.
// New recipes should identify a generated place, never paint an arena by hand.
// ============================================================================

export interface WorldBattleScenarioPreset {
  id: string;
  label: string;
  encounterFrame: string;
  description: string;
  worldSeed: number;
  entryCellId: number;
  centerPx?: readonly [number, number];
  /** Fractional world clock used for source residents and visual reproducibility. */
  hour?: number;
  theme: BattleMapBiome;
  dimensions: { width: number; height: number };
  /** How the tactical crop chooses its exact location inside the generated ground window. */
  anchorMode?:
    "ground-center" | "nearest-road" | "nearest-crossing" | "nearest-gatehouse";
  /** Machine-readable encounter framing expected from the selected world fact. */
  encounterKind?: BattleMapEncounterContext["kind"];
  /** Deterministic non-world fixture available only when the visual harness opts in. */
  visualHostilityFixture?:
    "wanted-watch-confrontation" | "hostile-state-standing";
  /** Explicit model-roster substitute used only to render a hostile opening in the lab. */
  visualOpeningThreatFixture?: ReadonlyArray<{
    name: string;
    quantity: number;
    cr: string;
  }>;
  /** Lab-only proof that redraws this opening from its first saved receipt. */
  visualReplayOpeningReceipt?: boolean;
  /** Lab-only mixed downed/withdrawn result used to inspect a return visit. */
  visualOpeningResolutionFixture?: "mixed-party-victory";
  sourceRouteQuery: string;
}

export const WORLD_BATTLE_SCENARIO_PRESETS: readonly WorldBattleScenarioPreset[] =
  [
    {
      id: "wilderness-road-ambush",
      label: "Road Ambush",
      encounterFrame: "Route interception",
      description:
        "A real atlas trail through an unbuilt wilderness cell, proving source geometry, route clearance, and tactical movement agree without town-street noise.",
      worldSeed: 42,
      entryCellId: 373,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      anchorMode: "nearest-road",
      encounterKind: "road-ambush",
      sourceRouteQuery: "phase=world3d&ground=1&dcell=373&wfseed=42",
    },
    {
      id: "river-bridge-crossing",
      label: "River Crossing",
      encounterFrame: "Bridge interception",
      description:
        "A real atlas highway crossing a broad river, proving one Region crossing receipt drives the Ground bridge deck, tactical passability, and bank-aware deployment.",
      worldSeed: 42,
      entryCellId: 853,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      anchorMode: "nearest-crossing",
      encounterKind: "river-crossing",
      sourceRouteQuery: "phase=world3d&ground=1&dcell=853&wfseed=42",
    },
    {
      id: "river-ford-crossing",
      label: "Stream Ford",
      encounterFrame: "Ford interception",
      description:
        "A real atlas trail fording a narrow stream, proving a ford crossing receipt drives stepping-stone paint, wade-cost tiles, and bank-aware deployment without a bridge deck.",
      worldSeed: 42,
      entryCellId: 587,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      anchorMode: "nearest-crossing",
      encounterKind: "river-crossing",
      sourceRouteQuery: "phase=world3d&ground=1&dcell=587&wfseed=42",
    },
    {
      id: "boreal-woodland",
      label: "Boreal Woodland",
      encounterFrame: "Wilderness patrol",
      description:
        "A cell-native taiga location for judging real tree, bush, and boulder groupings without settlement noise.",
      worldSeed: 42,
      entryCellId: 476,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      sourceRouteQuery: "phase=world3d&ground=1&dcell=476&wfseed=42",
    },
    {
      id: "hillside-overlook",
      label: "Hillside",
      encounterFrame: "High-ground skirmish",
      description:
        "A steep roadless taiga flank (atlas slope 36), proving source elevation drives the whole relief story: contours, hillshade, sun-cast slope shadows, and high-ground tactical reads.",
      worldSeed: 42,
      entryCellId: 1419,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      sourceRouteQuery: "phase=world3d&ground=1&dcell=1419&wfseed=42",
    },
    {
      id: "legium-hostile-opening",
      label: "Hostile Opening",
      encounterFrame: "Saved contact replay",
      description:
        "A hostile opening at Legium's exact generated start location. The roster remains an explicitly labeled model fixture; the lab authors one WorldForge scene receipt, then redraws the visible contact from its saved bodies, activity site, trace ages, and world-meter positions.",
      worldSeed: 42,
      entryCellId: 829,
      centerPx: [641.2, 149.42],
      hour: 17.25,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      anchorMode: "ground-center",
      encounterKind: "opening-standoff",
      visualOpeningThreatFixture: [
        { name: "Goblin", quantity: 3, cr: "1/4" },
        { name: "Wolf", quantity: 1, cr: "1/4" },
      ],
      visualReplayOpeningReceipt: true,
      sourceRouteQuery: "phase=world3d&ground=1&gx=16&gy=4&wfseed=42",
    },
    {
      id: "legium-hostile-opening-aftermath",
      label: "Opening Aftermath",
      encounterFrame: "Resolved site return",
      description:
        "The same exact Legium opening after a deterministic party victory. One goblin and the wolf are downed, two goblins withdrew, and the abandoned activity site retains combat-authored ground disturbance instead of resetting the contact scene.",
      worldSeed: 42,
      entryCellId: 829,
      centerPx: [641.2, 149.42],
      hour: 17.25,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      anchorMode: "ground-center",
      encounterKind: "opening-standoff",
      visualOpeningThreatFixture: [
        { name: "Goblin", quantity: 3, cr: "1/4" },
        { name: "Wolf", quantity: 1, cr: "1/4" },
      ],
      visualReplayOpeningReceipt: true,
      visualOpeningResolutionFixture: "mixed-party-victory",
      sourceRouteQuery: "phase=world3d&ground=1&gx=16&gy=4&wfseed=42",
    },
    {
      id: "legium-settlement-edge",
      label: "Settlement Edge",
      encounterFrame: "Gate approach",
      description:
        "Legium at the nearest real gatehouse during the evening commute, with a labeled wanted-party fixture proving source structures, residents, and Turino regiment facts drive the same playable encounter.",
      worldSeed: 42,
      entryCellId: 829,
      centerPx: [641.2, 149.42],
      hour: 17.25,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      anchorMode: "nearest-gatehouse",
      encounterKind: "settlement-edge",
      visualHostilityFixture: "wanted-watch-confrontation",
      sourceRouteQuery: "phase=world3d&ground=1&gx=16&gy=4&wfseed=42",
    },
    {
      id: "legium-watch-interception",
      label: "Live Watch",
      encounterFrame: "Player-position arrest",
      description:
        "Legium at the exact live crop center, proving the production watch frame keeps the party in place while a source Turino patrol intercepts from the town side.",
      worldSeed: 42,
      entryCellId: 829,
      centerPx: [641.2, 149.42],
      hour: 17.25,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      anchorMode: "ground-center",
      encounterKind: "settlement-watch",
      visualHostilityFixture: "wanted-watch-confrontation",
      sourceRouteQuery: "phase=world3d&ground=1&gx=16&gy=4&wfseed=42",
    },
    {
      id: "legium-state-patrol",
      label: "State Patrol",
      encounterFrame: "Political interception",
      description:
        "Legium at the exact live crop center, proving a hostile Turino standing can emit a deterministic world event and deploy the real stationed regiment without being mislabeled as a crime response.",
      worldSeed: 42,
      entryCellId: 829,
      centerPx: [641.2, 149.42],
      hour: 17.25,
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      anchorMode: "ground-center",
      encounterKind: "settlement-state-patrol",
      visualHostilityFixture: "hostile-state-standing",
      sourceRouteQuery: "phase=world3d&ground=1&gx=16&gy=4&wfseed=42",
    },
    {
      id: "legium-town-skirmish",
      label: "Legium",
      encounterFrame: "Town skirmish",
      description:
        "The default generated ground settlement, stressing buildings, interiors, road runs, and placed cover props.",
      worldSeed: 42,
      entryCellId: 829,
      centerPx: [641.2, 149.42],
      theme: "forest",
      dimensions: { width: 80, height: 60 },
      sourceRouteQuery: "phase=world3d&ground=1&gx=16&gy=4&wfseed=42",
    },
  ] as const;

export type WorldBattleParityStatus = "pass" | "warning" | "gap";

export interface WorldBattleParityCheck {
  id: string;
  label: string;
  status: WorldBattleParityStatus;
  detail: string;
}

export interface WorldBattleSourceFacts {
  naturalFeatures: number;
  placedProps: number;
  /** Source feature anchors whose nearest five-foot cell lies in this crop. */
  naturalFeaturesInCrop: number;
  /** Source prop footprints that touch at least one five-foot cell in this crop. */
  placedPropsInCrop: number;
  roadRuns: number;
  regionalRoadRuns: number;
  townStreetRuns: number;
  riverRuns: number;
  crossings: number;
  bridges: number;
  fords: number;
  buildings: number;
  buildingsInCrop: number;
  gatehouses: number;
  gatehousesInCrop: number;
  towns: number;
  hostiles: number;
  occupants: number;
  occupantsInCrop: number;
  movingOccupantsInCrop: number;
}

export interface WorldBattleTacticalFacts {
  tiles: number;
  blockedTiles: number;
  coverTiles: number;
  decoratedTiles: number;
  targetableObjects: number;
  targetableFeatures: number;
  targetableProps: number;
  incompleteTargetFacts: number;
  worldOccupants: number;
  occupiedOccupantCells: number;
  movingOccupants: number;
  occupantsOnBlockedTiles: number;
  roadTiles: number;
  regionalRoadTiles: number;
  townStreetTiles: number;
  passableRoadTiles: number;
  crossingTiles: number;
  bridgeTiles: number;
  fordTiles: number;
  passableCrossingTiles: number;
  encounterContext: BattleMapEncounterContext["kind"] | null;
  terrain: Record<BattleMapTerrain, number>;
  decorations: Partial<Record<Exclude<BattleMapDecoration, null>, number>>;
}

export interface WorldBattleScenarioDiagnostics {
  source: WorldBattleSourceFacts;
  tactical: WorldBattleTacticalFacts;
  defense: WorldBattleDefenseFacts;
  parity: WorldBattleParityCheck[];
}

export interface WorldBattleDefenseFacts {
  stateName: string | null;
  stateFullName: string | null;
  stateAlert: number | null;
  stationedRegiments: number;
  stationedTroops: number;
  selectedRegiment: string | null;
  selectedRegimentTroops: number;
  tacticalActors: number;
  tacticalUnits: string[];
  excludedUnits: string[];
  hostility: {
    verdict: BattleMapSettlementHostility["verdict"] | "none";
    rule: BattleMapSettlementHostility["rule"] | "none";
    triggerKind: BattleMapSettlementHostility["trigger"]["kind"];
    triggerSource: BattleMapSettlementHostility["trigger"]["source"];
    triggerSummary: string;
    relationKind: BattleMapSettlementHostility["relation"]["kind"];
    relationSummary: string;
    detail: string;
    inputKind: "visual-harness-fixture" | "live-player-state" | "none";
  };
}

export interface WorldBattleScenario {
  key: string;
  preset: WorldBattleScenarioPreset;
  locationLabel: string;
  mapData: BattleMapData;
  diagnostics: WorldBattleScenarioDiagnostics;
}

export interface WorldBattleScenarioOptions {
  /** Live callers can provide the current confrontation and player relation. */
  settlementHostility?: SettlementEncounterHostilityInput;
  /** Developer-only switch that enables the preset's deterministic player-state fixture. */
  useVisualHostilityFixture?: boolean;
}

// ============================================================================
// Projection Diagnostics
// ============================================================================
// Counting both sides of the bridge turns the lab into a parity instrument. A
// green rendered map is insufficient when roads or object facts vanished on the
// way to combat; these checks state those gaps in the page itself.
// ============================================================================

const emptyTerrainCounts = (): Record<BattleMapTerrain, number> => ({
  grass: 0,
  rock: 0,
  water: 0,
  difficult: 0,
  wall: 0,
  floor: 0,
  sand: 0,
  mud: 0,
});

/** Convert the typed relation receipt into a compact inspector sentence. */
function hostilityRelationSummary(
  hostility: BattleMapSettlementHostility | undefined,
): string {
  const relation = hostility?.relation;
  if (!relation) return "No settlement force requires a hostility relation.";
  if (relation.kind === "none") return relation.detail;
  if (relation.kind === "wanted-in-location") {
    const count = relation.witnessedCrimeIds.length;
    return `${count} witnessed ${count === 1 ? "crime" : "crimes"} in ${relation.locationId}`;
  }
  return `${relation.tier} standing ${relation.publicStanding} for ${relation.factionId} (hostile at ${relation.hostileThreshold} or lower)`;
}

/** Count source footprints independently of the target registry they should produce. */
function sourceFootprintTouchesCrop(
  x: number,
  z: number,
  mapData: BattleMapData,
  footprintRadiusM = 0,
): boolean {
  const anchor = mapData.provenance?.anchorWorldMeters;
  if (!anchor) return false;
  const centerX = Math.floor(mapData.dimensions.width / 2);
  const centerY = Math.floor(mapData.dimensions.height / 2);
  const exactX = centerX + (x - anchor.x) / GROUND_METERS_PER_CELL;
  const exactY = centerY + (z - anchor.z) / GROUND_METERS_PER_CELL;
  const footprintCells = footprintRadiusM / GROUND_METERS_PER_CELL;
  return (
    exactX >= -0.5 - footprintCells &&
    exactX <= mapData.dimensions.width - 0.5 + footprintCells &&
    exactY >= -0.5 - footprintCells &&
    exactY <= mapData.dimensions.height - 0.5 + footprintCells
  );
}

/** Detect a source polygon whose footprint overlaps the exact referee bounds. */
function sourcePolygonTouchesCrop(
  points: readonly { x: number; z: number }[],
  mapData: BattleMapData,
): boolean {
  const anchor = mapData.provenance?.anchorWorldMeters;
  if (!anchor || points.length === 0) return false;
  const centerX = Math.floor(mapData.dimensions.width / 2);
  const centerY = Math.floor(mapData.dimensions.height / 2);
  const crop = {
    minX: anchor.x + (-centerX - 0.5) * GROUND_METERS_PER_CELL,
    maxX:
      anchor.x +
      (mapData.dimensions.width - centerX - 0.5) * GROUND_METERS_PER_CELL,
    minZ: anchor.z + (-centerY - 0.5) * GROUND_METERS_PER_CELL,
    maxZ:
      anchor.z +
      (mapData.dimensions.height - centerY - 0.5) * GROUND_METERS_PER_CELL,
  };
  const bounds = points.reduce(
    (result, point) => ({
      minX: Math.min(result.minX, point.x),
      maxX: Math.max(result.maxX, point.x),
      minZ: Math.min(result.minZ, point.z),
      maxZ: Math.max(result.maxZ, point.z),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  );
  return (
    bounds.maxX >= crop.minX &&
    bounds.minX <= crop.maxX &&
    bounds.maxZ >= crop.minZ &&
    bounds.minZ <= crop.maxZ
  );
}

export function summarizeWorldBattleScenario(
  ground: GroundWorld,
  mapData: BattleMapData,
  sourceOccupants: readonly GroundOccupantProjectionInput[] = ground.occupants,
): WorldBattleScenarioDiagnostics {
  const terrain = emptyTerrainCounts();
  const decorations: WorldBattleTacticalFacts["decorations"] = {};
  let blockedTiles = 0;
  let coverTiles = 0;
  let decoratedTiles = 0;
  let roadTiles = 0;
  let regionalRoadTiles = 0;
  let townStreetTiles = 0;
  let passableRoadTiles = 0;
  let crossingTiles = 0;
  let bridgeTiles = 0;
  let fordTiles = 0;
  let passableCrossingTiles = 0;

  // Read the referee grid once and retain its tactical vocabulary exactly.
  for (const tile of mapData.tiles.values()) {
    terrain[tile.terrain] += 1;
    if (tile.blocksMovement) blockedTiles += 1;
    if (tile.providesCover) coverTiles += 1;
    if (tile.surface?.kind === "road") {
      roadTiles += 1;
      if (tile.surface.sourceRole === "regional-route") regionalRoadTiles += 1;
      if (tile.surface.sourceRole === "town-street") townStreetTiles += 1;
      if (!tile.blocksMovement && tile.movementCost > 0) passableRoadTiles += 1;
    }
    if (tile.crossing) {
      crossingTiles += 1;
      if (tile.crossing.kind === "bridge") bridgeTiles += 1;
      if (tile.crossing.kind === "ford") fordTiles += 1;
      if (!tile.blocksMovement && tile.movementCost > 0)
        passableCrossingTiles += 1;
    }
    if (tile.decoration) {
      decoratedTiles += 1;
      decorations[tile.decoration] = (decorations[tile.decoration] ?? 0) + 1;
    }
  }

  const sourceCrossings = ground.crossings ?? [];
  const naturalFeaturesInCrop = ground.features.filter((feature) =>
    sourceFootprintTouchesCrop(feature.xM, feature.zM, mapData),
  ).length;
  const placedPropsInCrop = ground.props.filter((prop) => {
    const definition = PROPS_BY_ID.get(prop.defId);
    const footprintRadiusM = definition ? propFootprintRadiusM(definition) : 0;
    return sourceFootprintTouchesCrop(
      prop.xM,
      prop.zM,
      mapData,
      footprintRadiusM,
    );
  }).length;
  const buildingsInCrop = ground.buildings.filter((building) =>
    sourcePolygonTouchesCrop(building.cornersM, mapData),
  ).length;
  const gatehousesInCrop = ground.gatehouses.filter((gatehouse) =>
    sourceFootprintTouchesCrop(
      gatehouse.xM,
      gatehouse.zM,
      mapData,
      gatehouse.gapHalfM,
    ),
  ).length;
  const occupantsInCrop = sourceOccupants.filter((occupant) =>
    sourceFootprintTouchesCrop(occupant.xM, occupant.zM, mapData),
  );
  const targetableObjects = mapData.targetableObjects ?? [];
  const targetableFeatures = targetableObjects.filter(
    (object) => object.source?.kind === "worldforge-feature",
  ).length;
  const targetableProps = targetableObjects.filter(
    (object) => object.source?.kind === "worldforge-prop",
  ).length;
  const incompleteTargetFacts = targetableObjects.filter(
    (object) =>
      object.isWornOrCarried == null ||
      object.isMagical == null ||
      object.isFixedToSurface == null ||
      (object.isFixedToSurface === false && object.weightPounds == null),
  ).length;
  const worldOccupants = mapData.worldOccupants ?? [];
  const occupiedOccupantCells = new Set(
    worldOccupants.map(
      (occupant) => `${occupant.position.x}-${occupant.position.y}`,
    ),
  ).size;
  const occupantsOnBlockedTiles = worldOccupants.filter(
    (occupant) =>
      mapData.tiles.get(`${occupant.position.x}-${occupant.position.y}`)
        ?.blocksMovement,
  ).length;
  const settlementContext =
    mapData.encounterContext?.kind === "settlement-edge" ||
    mapData.encounterContext?.kind === "settlement-watch" ||
    mapData.encounterContext?.kind === "settlement-state-patrol"
      ? mapData.encounterContext
      : undefined;
  const defendingForce = settlementContext?.defendingForce;
  const settlementDefense = settlementContext
    ? ground.settlementDefenses?.find(
        (candidate) => candidate.burgId === settlementContext.sourceBurgId,
      )
    : undefined;
  const source: WorldBattleSourceFacts = {
    naturalFeatures: ground.features.length,
    placedProps: ground.props.length,
    naturalFeaturesInCrop,
    placedPropsInCrop,
    roadRuns: ground.roads.length,
    regionalRoadRuns: ground.roads.filter(
      (road) => road.sourceKind === "region-road",
    ).length,
    townStreetRuns: ground.roads.filter(
      (road) => road.sourceKind === "town-street",
    ).length,
    riverRuns: ground.rivers.length,
    crossings: sourceCrossings.length,
    bridges: sourceCrossings.filter((crossing) => crossing.kind === "bridge")
      .length,
    fords: sourceCrossings.filter((crossing) => crossing.kind === "ford")
      .length,
    buildings: ground.buildings.length,
    buildingsInCrop,
    gatehouses: ground.gatehouses.length,
    gatehousesInCrop,
    towns: ground.towns.length,
    hostiles: ground.hostiles.length,
    occupants: sourceOccupants.length,
    occupantsInCrop: occupantsInCrop.length,
    movingOccupantsInCrop: occupantsInCrop.filter((occupant) => occupant.moving)
      .length,
  };
  const tactical: WorldBattleTacticalFacts = {
    tiles: mapData.tiles.size,
    blockedTiles,
    coverTiles,
    decoratedTiles,
    targetableObjects: targetableObjects.length,
    targetableFeatures,
    targetableProps,
    incompleteTargetFacts,
    worldOccupants: worldOccupants.length,
    occupiedOccupantCells,
    movingOccupants: worldOccupants.filter((occupant) => occupant.moving)
      .length,
    occupantsOnBlockedTiles,
    roadTiles,
    regionalRoadTiles,
    townStreetTiles,
    passableRoadTiles,
    crossingTiles,
    bridgeTiles,
    fordTiles,
    passableCrossingTiles,
    encounterContext: mapData.encounterContext?.kind ?? null,
    terrain,
    decorations,
  };
  const defense: WorldBattleDefenseFacts = {
    stateName: settlementDefense?.stateName ?? null,
    stateFullName: settlementDefense?.stateFullName ?? null,
    stateAlert: settlementDefense?.stateAlert ?? null,
    stationedRegiments: settlementDefense?.stationedRegiments.length ?? 0,
    stationedTroops:
      settlementDefense?.stationedRegiments.reduce(
        (total, regiment) => total + regiment.totalTroops,
        0,
      ) ?? 0,
    selectedRegiment: defendingForce?.source.regimentName ?? null,
    selectedRegimentTroops: defendingForce?.source.regimentTroops ?? 0,
    tacticalActors: defendingForce?.projection.tacticalActors ?? 0,
    tacticalUnits:
      defendingForce?.projection.units.map((unit) => {
        const role = unit.roleLabel.toLowerCase();
        const readableRole =
          unit.tacticalActors === 1 || role === "infantry" ? role : `${role}s`;
        return `${unit.tacticalActors} ${readableRole}`;
      }) ?? [],
    excludedUnits:
      defendingForce?.projection.excludedUnits.map(
        (unit) =>
          `${unit.sourceTroops.toLocaleString()} ${unit.sourceUnitType}`,
      ) ?? [],
    hostility: {
      verdict: defendingForce?.projection.hostility.verdict ?? "none",
      rule: defendingForce?.projection.hostility.rule ?? "none",
      triggerKind: defendingForce?.projection.hostility.trigger.kind ?? "none",
      triggerSource:
        defendingForce?.projection.hostility.trigger.source ?? "none",
      triggerSummary:
        defendingForce?.projection.hostility.trigger.summary ??
        "No settlement force requires a confrontation trigger.",
      relationKind:
        defendingForce?.projection.hostility.relation.kind ?? "none",
      relationSummary: hostilityRelationSummary(
        defendingForce?.projection.hostility,
      ),
      detail:
        defendingForce?.projection.hostility.detail ??
        "No settlement force requires a hostility decision.",
      inputKind:
        defendingForce?.projection.hostility.trigger.source === "visual-harness"
          ? "visual-harness-fixture"
          : defendingForce?.projection.hostility.trigger.source === "none" ||
              !defendingForce
            ? "none"
            : "live-player-state",
    },
  };

  const sourceObjectsInCrop =
    source.naturalFeaturesInCrop + source.placedPropsInCrop;
  const projectedSourceObjects =
    tactical.targetableFeatures + tactical.targetableProps;
  const hasProjectedStructures = terrain.floor > 0 || terrain.wall > 0;

  // Every warning is an actionable bridge question, not a generic quality
  // score. A source fact can be absent (pass/not applicable), represented, or
  // visibly missing from the tactical vocabulary.
  // Keep the narrowed site outside array callbacks. This also gives every
  // opening-site diagnostic one authoritative value instead of repeatedly
  // traversing the broad encounter-context union.
  const openingActivitySite =
    mapData.encounterContext?.kind === "opening-standoff"
      ? mapData.encounterContext.activitySite
      : undefined;
  const openingBodyStates =
    mapData.encounterContext?.kind === "opening-standoff"
      ? mapData.encounterContext.sourceEntities
          .map((entity) => entity.bodyState)
          .filter((bodyState) => bodyState !== undefined)
      : [];
  const openingBodyPostures = new Set(
    openingBodyStates.map((bodyState) => bodyState.posture),
  );
  const openingBodyFacingIsValid = openingBodyStates.every(
    (bodyState) =>
      Math.abs(
        Math.hypot(bodyState.facingDirection.x, bodyState.facingDirection.z) -
          1,
      ) < 1e-6,
  );
  const openingTerrainImprints =
    mapData.encounterContext?.kind === "opening-standoff"
      ? (mapData.encounterContext.terrainImprints ?? [])
      : [];
  const openingTerrainKinds = new Set(
    openingTerrainImprints.map((imprint) => imprint.kind),
  );
  const openingResolution =
    mapData.encounterContext?.kind === "opening-standoff"
      ? mapData.encounterContext.sceneResolution
      : undefined;
  const parity: WorldBattleParityCheck[] = [
    {
      id: "world-lineage",
      label: "World lineage retained",
      status: mapData.provenance?.kind === "worldforge" ? "pass" : "gap",
      detail:
        mapData.provenance?.kind === "worldforge"
          ? `World ${mapData.provenance.worldSeed}${mapData.provenance.anchorCellId == null ? "" : `, cell ${mapData.provenance.anchorCellId}`} is attached to the tactical map.`
          : "The tactical map lost its WorldForge origin.",
    },
    {
      id: "natural-features",
      label: "Natural features projected",
      status:
        source.naturalFeaturesInCrop === 0
          ? "warning"
          : decoratedTiles > 0
            ? "pass"
            : "gap",
      detail:
        source.naturalFeaturesInCrop === 0
          ? "This tactical crop has no source-world natural feature anchors to evaluate."
          : `${decoratedTiles.toLocaleString()} tactical cells inherit trees, bushes, or boulders from ${source.naturalFeaturesInCrop.toLocaleString()} source anchors in the crop.`,
    },
    {
      id: "structures",
      label: "Structures projected",
      status:
        source.buildingsInCrop === 0 || hasProjectedStructures ? "pass" : "gap",
      detail:
        source.buildingsInCrop === 0
          ? "No source building footprint touches this tactical crop."
          : hasProjectedStructures
            ? `${source.buildingsInCrop.toLocaleString()} source building footprints produce floor and wall referee cells.`
            : `${source.buildingsInCrop.toLocaleString()} source buildings touch the crop, but no tactical floor or wall cells were produced.`,
    },
    {
      id: "road-semantics",
      label: "Roads have tactical meaning",
      status:
        source.roadRuns === 0 || (roadTiles > 0 && passableRoadTiles > 0)
          ? "pass"
          : "gap",
      detail:
        source.roadRuns === 0
          ? "No road crosses this source location."
          : roadTiles > 0 && passableRoadTiles > 0
            ? `${roadTiles.toLocaleString()} referee cells retain source road runs; ${passableRoadTiles.toLocaleString()} are currently traversable.`
            : `${source.roadRuns.toLocaleString()} source road runs are present, but none reach the tactical crop as traversable surface facts.`,
    },
    {
      id: "encounter-framing",
      label: "Encounter framing uses source facts",
      status:
        source.roadRuns === 0 &&
        source.crossings === 0 &&
        source.gatehousesInCrop === 0
          ? "pass"
          : mapData.encounterContext?.source === "worldforge-road" ||
              mapData.encounterContext?.source === "worldforge-crossing" ||
              mapData.encounterContext?.source === "worldforge-settlement" ||
              mapData.encounterContext?.source === "worldforge-opening"
            ? "pass"
            : "warning",
      detail:
        source.roadRuns === 0 &&
        source.crossings === 0 &&
        source.gatehousesInCrop === 0
          ? "This location has no route, crossing, or settlement gate requiring source-aware deployment."
          : mapData.encounterContext?.kind === "road-ambush"
            ? `The ${mapData.encounterContext.sourceRoadRole} heading drives a traveling party column and concealed flanks.`
            : mapData.encounterContext?.kind === "river-crossing"
              ? `The ${mapData.encounterContext.crossingKind} heading divides deployment between the near and far banks.`
              : mapData.encounterContext?.kind === "settlement-edge"
                ? `Gate ${mapData.encounterContext.sourceGatehouseId} places the party outside and defenders inside ${mapData.encounterContext.defendingForce?.source.burgName ?? `burg ${mapData.encounterContext.sourceBurgId}`}'s real boundary.`
                : mapData.encounterContext?.kind === "settlement-watch"
                  ? `The party remains on its live crop anchor while ${mapData.encounterContext.defendingForce?.source.burgName ?? `burg ${mapData.encounterContext.sourceBurgId}`} defenders intercept from the settlement side.`
                  : mapData.encounterContext?.kind === "settlement-state-patrol"
                    ? `${mapData.encounterContext.sourceFactionId} authorizes a political patrol interception from ${mapData.encounterContext.defendingForce?.source.burgName ?? `burg ${mapData.encounterContext.sourceBurgId}`} toward the party's live crop anchor.`
                    : mapData.encounterContext?.kind === "opening-standoff"
                      ? `Opening scene ${mapData.encounterContext.sourceSceneReceiptId} preserves the party anchor, ${mapData.encounterContext.sourceEntities.length} exact enemy positions, the authored threat approach, and ${mapData.encounterContext.activitySite ? `persistent ${mapData.encounterContext.activitySite.kind}` : "no activity site"}.`
                      : "Source routes reach the referee grid, but this scenario does not yet provide a source-derived deployment frame.",
    },
    {
      id: "opening-threat-spatial-authority",
      label: "Opening enemy positions are source-authored",
      status:
        mapData.encounterContext?.kind === "opening-standoff" &&
        mapData.encounterContext.sourceSceneReceiptId &&
        mapData.encounterContext.sourceEntities.length > 0
          ? "pass"
          : mapData.encounterContext?.kind === "opening-standoff"
            ? "gap"
            : "pass",
      detail:
        mapData.encounterContext?.kind === "opening-standoff"
          ? `${mapData.encounterContext.sourceEntities.length} saved scene entities retain exact world-meter and tactical positions, social roles, and a shared approach direction.`
          : "This scenario is not a model-authored hostile opening.",
    },
    {
      id: "opening-threat-activity-site",
      label: "Opening monsters occupy a persistent physical site",
      status:
        mapData.encounterContext?.kind === "opening-standoff"
          ? openingActivitySite &&
            mapData.targetableObjects?.some(
              (object) =>
                object.id === openingActivitySite.id &&
                object.source?.kind === "worldforge-monster-site",
            )
            ? "pass"
            : "gap"
          : "pass",
      detail:
        mapData.encounterContext?.kind === "opening-standoff"
          ? openingActivitySite
            ? `${openingActivitySite.label} persists at ${openingActivitySite.worldGroundMeters.x.toFixed(1)}, ${openingActivitySite.worldGroundMeters.z.toFixed(1)} world meters with ${openingActivitySite.contents.length} physical evidence facts.`
            : "The contact scene has bodies and traces but no persisted place those monsters occupied."
          : "This scenario is not a model-authored hostile opening.",
    },
    {
      id: "opening-threat-body-state",
      label: "Opening monsters have source-authored bodies",
      status:
        mapData.encounterContext?.kind === "opening-standoff"
          ? openingBodyStates.length ===
              mapData.encounterContext.sourceEntities.length &&
            openingBodyPostures.size >= Math.min(3, openingBodyStates.length) &&
            openingBodyFacingIsValid
            ? "pass"
            : "gap"
          : "pass",
      detail:
        mapData.encounterContext?.kind === "opening-standoff"
          ? `${openingBodyStates.length}/${mapData.encounterContext.sourceEntities.length} bodies preserve posture, carried load, and normalized facing; ${openingBodyPostures.size} distinct map-scale postures are authored.`
          : "This scenario is not a model-authored hostile opening.",
    },
    {
      id: "opening-threat-terrain-memory",
      label: "Opening occupation changes the source ground",
      status:
        mapData.encounterContext?.kind === "opening-standoff"
          ? openingTerrainImprints.length >= 4 &&
            openingTerrainKinds.has("flattened-ground") &&
            openingTerrainKinds.has("trampled-run") &&
            openingTerrainKinds.has("drag-furrow") &&
            openingTerrainKinds.has("refuse-scatter") &&
            openingTerrainImprints.every(
              (imprint) =>
                imprint.activitySiteId === openingActivitySite?.id &&
                Math.abs(
                  Math.hypot(imprint.direction.x, imprint.direction.y) - 1,
                ) < 1e-6,
            )
            ? "pass"
            : "gap"
          : "pass",
      detail:
        mapData.encounterContext?.kind === "opening-standoff"
          ? `${openingTerrainImprints.length} saved imprints connect ${openingActivitySite?.label ?? "the missing site"} to traffic, dragged salvage, flattened ground, and refuse.`
          : "This scenario is not a model-authored hostile opening.",
    },
    {
      id: "opening-threat-outcome-continuity",
      label: "Opening combat changes the saved world scene",
      status:
        mapData.encounterContext?.kind === "opening-standoff"
          ? mapData.encounterContext.sceneContinuity === "resolved-return" &&
            openingResolution &&
            openingResolution.entityOutcomes.length > 0 &&
            openingResolution.entityOutcomes.filter(
              (outcome) => outcome.status !== "withdrew",
            ).length === mapData.encounterContext.sourceEntities.length &&
            openingResolution.combatDisturbance.sourceEntityIds.length ===
              openingResolution.entityOutcomes.length &&
            openingResolution.activitySiteCondition === "abandoned-disturbed"
            ? "pass"
            : "gap"
          : "pass",
      detail:
        mapData.encounterContext?.kind === "opening-standoff"
          ? openingResolution
            ? `${openingResolution.entityOutcomes.filter((outcome) => outcome.status === "downed").length} downed, ${openingResolution.entityOutcomes.filter((outcome) => outcome.status === "withdrew").length} withdrew, ${mapData.encounterContext.sourceEntities.length} physical bodies remain at a ${openingResolution.activitySiteCondition} site.`
            : "The contact scene has no combat-authored result; a return visit would still reconstruct the original group and site."
          : "This scenario is not a model-authored hostile opening.",
    },
    {
      id: "opening-threat-precontact-history",
      label: "Opening monsters have world history before contact",
      // The current scene is authoritative, but inventing an earlier hunt or
      // patrol route would be false. Keep that absence prominent in the lab.
      status:
        mapData.encounterContext?.kind === "opening-standoff" ? "gap" : "pass",
      detail:
        mapData.encounterContext?.kind === "opening-standoff"
          ? "The scene receipt begins at contact. It does not yet preserve where this group came from, what it hunted, or how long its traces have existed."
          : "This scenario is not a model-authored hostile opening.",
    },
    {
      id: "river-semantics",
      label: "Rivers reach the referee",
      status: source.riverRuns === 0 || terrain.water > 0 ? "pass" : "gap",
      detail:
        source.riverRuns === 0
          ? "No river crosses this source location."
          : terrain.water > 0
            ? `${source.riverRuns.toLocaleString()} river runs correspond with ${terrain.water.toLocaleString()} water cells.`
            : `${source.riverRuns.toLocaleString()} source river runs exist, but the tactical crop has no water cells.`,
    },
    {
      id: "crossing-semantics",
      label: "Crossings remain traversable",
      status:
        source.crossings === 0
          ? "pass"
          : crossingTiles > 0 && passableCrossingTiles === crossingTiles
            ? "pass"
            : "gap",
      detail:
        source.crossings === 0
          ? "No source bridge or ford crosses this location."
          : crossingTiles > 0 && passableCrossingTiles === crossingTiles
            ? `${source.crossings.toLocaleString()} source crossing receipts produce ${crossingTiles.toLocaleString()} traversable referee cells without erasing the water terrain.`
            : `${source.crossings.toLocaleString()} source crossing receipts exist, but the tactical crop has ${passableCrossingTiles.toLocaleString()} traversable crossing cells.`,
    },
    {
      id: "object-targeting",
      label: "World objects are spell-targetable",
      status:
        sourceObjectsInCrop === 0
          ? "pass"
          : projectedSourceObjects === 0
            ? "gap"
            : projectedSourceObjects < sourceObjectsInCrop ||
                tactical.incompleteTargetFacts > 0
              ? "warning"
              : "pass",
      detail:
        sourceObjectsInCrop === 0
          ? "No source object anchors fall inside this tactical crop."
          : projectedSourceObjects === 0
            ? `${sourceObjectsInCrop.toLocaleString()} source object anchors exist in the crop, but none publish spell-target facts.`
            : tactical.incompleteTargetFacts > 0
              ? `${projectedSourceObjects.toLocaleString()} source objects publish tactical targets; ${tactical.incompleteTargetFacts.toLocaleString()} catalog props still lack explicit mobility or weight facts.`
              : projectedSourceObjects < sourceObjectsInCrop
                ? `${projectedSourceObjects.toLocaleString()} of ${sourceObjectsInCrop.toLocaleString()} source anchors publish targets; inspect route, structure, and edge precedence for the remainder.`
                : `${projectedSourceObjects.toLocaleString()} source objects publish provenance-bearing target facts for spells.`,
    },
    {
      id: "occupant-projection",
      label: "Named occupants retain location",
      status:
        source.occupantsInCrop === 0
          ? "warning"
          : tactical.worldOccupants !== source.occupantsInCrop
            ? "gap"
            : tactical.occupantsOnBlockedTiles > 0
              ? "warning"
              : "pass",
      detail:
        source.occupantsInCrop === 0
          ? "No named resident falls inside this tactical crop at the selected world clock."
          : tactical.worldOccupants !== source.occupantsInCrop
            ? `${source.occupantsInCrop.toLocaleString()} source residents are in the crop, but only ${tactical.worldOccupants.toLocaleString()} retain tactical identities.`
            : tactical.occupantsOnBlockedTiles > 0
              ? `${tactical.worldOccupants.toLocaleString()} residents retain identity across ${tactical.occupiedOccupantCells.toLocaleString()} cells, but ${tactical.occupantsOnBlockedTiles.toLocaleString()} snapped onto blocked referee cells.`
              : `${tactical.worldOccupants.toLocaleString()} residents retain identity across ${tactical.occupiedOccupantCells.toLocaleString()} cells; ${tactical.movingOccupants.toLocaleString()} were commuting at the encounter clock.`,
    },
    {
      id: "occupant-combat-semantics",
      label: "Neutral occupant combat policy",
      status: tactical.worldOccupants > 0 ? "warning" : "pass",
      detail:
        tactical.worldOccupants > 0
          ? "Residents are reserved ambient facts, not initiative actors or creature targets; fleeing, harm, and allegiance still need an explicit neutral-actor policy."
          : "No resident in this crop requires neutral combat semantics.",
    },
    {
      id: "settlement-defender-source",
      label: "Settlement defenders retain regiment source",
      status:
        settlementContext == null ? "pass" : defendingForce ? "pass" : "gap",
      detail:
        settlementContext == null
          ? "This scenario does not require a settlement defending force."
          : defendingForce
            ? `${defendingForce.projection.tacticalActors} tactical defenders descend from ${defendingForce.source.regimentName}, a ${defendingForce.source.regimentTroops.toLocaleString()}-troop ${defendingForce.source.stateName} regiment.`
            : "A settlement gate frames this encounter, but no stationed land regiment supplies its defenders.",
    },
    {
      id: "settlement-defender-unit-bridges",
      label: "Military roles have tactical bridges",
      status:
        defendingForce == null ||
        defendingForce.projection.excludedUnits.length === 0
          ? "pass"
          : "warning",
      detail:
        defendingForce == null
          ? "No source regiment requires military-role projection."
          : defendingForce.projection.excludedUnits.length === 0
            ? "Every selected source military role maps to a combat-ready bestiary actor."
            : `${defendingForce.projection.excludedUnits.map((unit) => `${unit.sourceTroops.toLocaleString()} ${unit.sourceUnitType}`).join(" and ")} remain source facts but are not represented in a static gate patrol.`,
    },
    {
      id: "faction-hostility",
      label: "Combat hostility has explicit authority",
      status: "pass",
      detail:
        defendingForce == null
          ? "No projected faction force requires a hostility decision."
          : defendingForce.projection.hostility.verdict === "hostile"
            ? `${defendingForce.projection.hostility.trigger.kind} plus ${defendingForce.projection.hostility.relation.kind} evidence authorizes the enemy roster.`
            : `${defendingForce.source.stateFullName}'s regiment remains non-combat context because the hostility rule returned withhold-combat.`,
    },
    {
      id: "faction-hostility-live-input",
      label: "Hostility reads live player state",
      status:
        defendingForce?.projection.hostility.trigger.source === "visual-harness"
          ? "gap"
          : "pass",
      detail:
        defendingForce?.projection.hostility.trigger.source === "visual-harness"
          ? "The deterministic wanted-party fixture proves the semantic bridge, but the production fight-in-place caller does not yet supply its live crime or faction-standing state."
          : defendingForce
            ? "The hostility receipt does not depend on a visual-harness fixture."
            : "No projected faction force requires live player-state hostility input.",
    },
  ];

  return { source, tactical, defense, parity };
}

// ============================================================================
// WorldForge -> Tactical Scenario Adapter
// ============================================================================
// The caller supplies a fully assembled GroundWorld, usually from the existing
// worker. This keeps world generation off the main thread while making this
// final projection deterministic, synchronous, and straightforward to test.
// ============================================================================

type ScenarioAnchor = {
  x: number;
  z: number;
  road?: {
    sourceIndex: number;
    sourceRole: Extract<
      BattleMapEncounterContext,
      { kind: "road-ambush" }
    >["sourceRoadRole"];
    direction: { x: number; z: number };
  };
  crossing?: {
    id: string;
    kind: Extract<
      BattleMapEncounterContext,
      { kind: "river-crossing" }
    >["crossingKind"];
    roadSourceIndex?: number;
    riverSourceIndex?: number;
    direction: { x: number; z: number };
  };
  settlement?: {
    burgId: number;
    gatehouseId: string;
    /** Unit heading from the exterior side of the gate toward town center. */
    inwardDirection: { x: number; z: number };
  };
};

const roadSourceRole = (
  road: GroundWorld["roads"][number],
): Extract<
  BattleMapEncounterContext,
  { kind: "road-ambush" }
>["sourceRoadRole"] =>
  road.sourceKind === "region-road"
    ? "regional-route"
    : road.sourceKind === "town-street"
      ? "town-street"
      : "unclassified";

/** Pick a real source location for the crop; road scenarios never synthesize a route. */
function scenarioAnchor(
  preset: WorldBattleScenarioPreset,
  ground: GroundWorld,
): ScenarioAnchor {
  const center = { x: ground.extentMetersX / 2, z: ground.extentMetersZ / 2 };
  if (preset.anchorMode === "nearest-gatehouse") {
    const gatehouse = [...ground.gatehouses].sort(
      (a, b) =>
        (a.xM - center.x) ** 2 +
        (a.zM - center.z) ** 2 -
        ((b.xM - center.x) ** 2 + (b.zM - center.z) ** 2),
    )[0];
    const town = gatehouse
      ? ground.towns.find((candidate) => candidate.burgId === gatehouse.burgId)
      : undefined;
    if (!gatehouse || !town) return center;
    const inwardLength = Math.hypot(
      town.xM - gatehouse.xM,
      town.zM - gatehouse.zM,
    );
    if (inwardLength <= 1e-9) return center;
    return {
      x: gatehouse.xM,
      z: gatehouse.zM,
      settlement: {
        burgId: gatehouse.burgId,
        gatehouseId: [
          "gatehouse",
          gatehouse.burgId,
          Math.round(gatehouse.xM * 100),
          Math.round(gatehouse.zM * 100),
        ].join(":"),
        inwardDirection: {
          x: (town.xM - gatehouse.xM) / inwardLength,
          z: (town.zM - gatehouse.zM) / inwardLength,
        },
      },
    };
  }
  if (preset.anchorMode === "nearest-crossing") {
    const crossings = ground.crossings ?? [];
    // Prefer a physical bridge when a window happens to contain both crossing
    // forms; the first harness fixture should exercise the Ground deck path.
    const candidates = crossings.some((crossing) => crossing.kind === "bridge")
      ? crossings.filter((crossing) => crossing.kind === "bridge")
      : crossings;
    const crossing = [...candidates].sort(
      (a, b) =>
        (a.xM - center.x) ** 2 +
        (a.zM - center.z) ** 2 -
        ((b.xM - center.x) ** 2 + (b.zM - center.z) ** 2),
    )[0];
    if (!crossing) return center;
    return {
      x: crossing.xM,
      z: crossing.zM,
      crossing: {
        id: crossing.id,
        kind: crossing.kind,
        roadSourceIndex: crossing.roadSourceIndex,
        riverSourceIndex: crossing.riverSourceIndex,
        direction: crossing.roadDirection,
      },
    };
  }
  if (preset.anchorMode !== "nearest-road") return center;

  // A route ambush belongs on the regional approach, not in a dense town-road
  // mesh. The crop clearance keeps the whole referee board outside a town's
  // coarse envelope when the source route provides such a point.
  const indexedRoads = ground.roads.map((road, sourceIndex) => ({
    road,
    sourceIndex,
  }));
  const regionalRoads = indexedRoads.filter(
    ({ road }) => road.sourceKind === "region-road",
  );
  const roads = regionalRoads.length > 0 ? regionalRoads : indexedRoads;
  const patchClearanceM =
    Math.hypot(
      (preset.dimensions.width * GROUND_METERS_PER_CELL) / 2,
      (preset.dimensions.height * GROUND_METERS_PER_CELL) / 2,
    ) + 12;
  const clearsSettlements = (candidate: { x: number; z: number }): boolean =>
    ground.towns.every(
      (town) =>
        Math.hypot(candidate.x - town.xM, candidate.z - town.zM) >
        town.halfM + patchClearanceM,
    );

  let nearest: ScenarioAnchor = center;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  let fallback: ScenarioAnchor = center;
  let fallbackDistanceSq = Number.POSITIVE_INFINITY;
  for (const { road, sourceIndex } of roads) {
    for (let index = 1; index < road.points.length; index += 1) {
      const start = road.points[index - 1];
      const end = road.points[index];
      const segmentLengthM = Math.hypot(end.x - start.x, end.z - start.z);
      if (segmentLengthM <= 1e-9) continue;
      const direction = {
        x: (end.x - start.x) / segmentLengthM,
        z: (end.z - start.z) / segmentLengthM,
      };
      const sampleCount = Math.max(1, Math.ceil(segmentLengthM / 8));
      for (let sample = 0; sample <= sampleCount; sample += 1) {
        const t = sample / sampleCount;
        const candidate: ScenarioAnchor = {
          x: start.x + (end.x - start.x) * t,
          z: start.z + (end.z - start.z) * t,
          road: {
            sourceIndex,
            sourceRole: roadSourceRole(road),
            direction,
          },
        };
        const distanceSq =
          (candidate.x - center.x) ** 2 + (candidate.z - center.z) ** 2;
        if (distanceSq < fallbackDistanceSq) {
          fallback = candidate;
          fallbackDistanceSq = distanceSq;
        }
        if (clearsSettlements(candidate) && distanceSq < nearestDistanceSq) {
          nearest = candidate;
          nearestDistanceSq = distanceSq;
        }
      }
    }
  }
  return Number.isFinite(nearestDistanceSq) ? nearest : fallback;
}

/** Translate source route heading into a referee-grid deployment contract. */
function scenarioEncounterContext(
  preset: WorldBattleScenarioPreset,
  anchor: ScenarioAnchor,
  mapData: BattleMapData,
  ground: GroundWorld,
  options: WorldBattleScenarioOptions,
): BattleMapEncounterContext | undefined {
  const center = {
    x: Math.floor(mapData.dimensions.width / 2),
    y: Math.floor(mapData.dimensions.height / 2),
  };
  const centerTile = mapData.tiles.get(`${center.x}-${center.y}`);

  if (
    preset.encounterKind === "settlement-watch" ||
    preset.encounterKind === "settlement-state-patrol"
  ) {
    const sourceDefense = ground.settlementDefenses?.[0];
    const fixtureInput =
      sourceDefense && options.useVisualHostilityFixture
        ? preset.visualHostilityFixture === "wanted-watch-confrontation"
          ? createVisualHarnessWantedWatchInput(
              sourceDefense,
              `visual-harness:${preset.id}`,
            )
          : preset.visualHostilityFixture === "hostile-state-standing"
            ? createVisualHarnessHostileStateInput(
                sourceDefense,
                `visual-harness:${preset.id}`,
              )
            : undefined
        : undefined;
    const hostilityInput = options.settlementHostility ?? fixtureInput;
    if (!hostilityInput) return undefined;

    // This deterministic recipe exercises the same production projection used
    // by the mounted GroundWorld provider. The crime/standing record remains
    // explicitly labeled as a visual fixture; only production framing is shared.
    const projection = projectLiveSettlementEncounter(
      ground,
      mapData,
      { x: anchor.x, z: anchor.z },
      hostilityInput,
    );
    return projection.mapData.encounterContext?.kind === preset.encounterKind
      ? projection.mapData.encounterContext
      : undefined;
  }

  if (preset.encounterKind === "settlement-edge" && anchor.settlement) {
    const anchorTile =
      centerTile && !centerTile.blocksMovement
        ? centerTile
        : [...mapData.tiles.values()]
            .filter((tile) => !tile.blocksMovement)
            .sort(
              (a, b) =>
                Math.hypot(
                  a.coordinates.x - center.x,
                  a.coordinates.y - center.y,
                ) -
                Math.hypot(
                  b.coordinates.x - center.x,
                  b.coordinates.y - center.y,
                ),
            )[0];
    if (!anchorTile) return undefined;
    const sourceDefense = ground.settlementDefenses?.find(
      (candidate) => candidate.burgId === anchor.settlement?.burgId,
    );
    const fixtureInput =
      sourceDefense &&
      options.useVisualHostilityFixture &&
      preset.visualHostilityFixture === "wanted-watch-confrontation"
        ? createVisualHarnessWantedWatchInput(
            sourceDefense,
            `visual-harness:${preset.id}`,
          )
        : undefined;
    const hostilityInput = options.settlementHostility ?? fixtureInput;
    const defendingForce = sourceDefense
      ? projectSettlementDefendingForce(
          sourceDefense,
          resolveSettlementEncounterHostility(sourceDefense, hostilityInput),
        )
      : undefined;

    return {
      kind: "settlement-edge",
      source: "worldforge-settlement",
      sourceBurgId: anchor.settlement.burgId,
      sourceGatehouseId: anchor.settlement.gatehouseId,
      anchorTile: anchorTile.coordinates,
      routeDirection: {
        x: anchor.settlement.inwardDirection.x,
        y: anchor.settlement.inwardDirection.z,
      },
      deployment: {
        player: "outside-approach",
        enemy: "inside-gate",
      },
      ...(defendingForce ? { defendingForce } : {}),
    };
  }

  if (preset.encounterKind === "river-crossing" && anchor.crossing) {
    const matchingCrossingTiles = [...mapData.tiles.values()].filter(
      (tile) =>
        !tile.blocksMovement &&
        tile.crossing?.sourceCrossingId === anchor.crossing?.id,
    );
    const anchorTile =
      centerTile?.crossing?.sourceCrossingId === anchor.crossing.id &&
      !centerTile.blocksMovement
        ? centerTile
        : matchingCrossingTiles.sort(
            (a, b) =>
              Math.hypot(
                a.coordinates.x - center.x,
                a.coordinates.y - center.y,
              ) -
              Math.hypot(
                b.coordinates.x - center.x,
                b.coordinates.y - center.y,
              ),
          )[0];
    if (!anchorTile) return undefined;

    return {
      kind: "river-crossing",
      source: "worldforge-crossing",
      sourceCrossingId: anchor.crossing.id,
      crossingKind: anchor.crossing.kind,
      anchorTile: anchorTile.coordinates,
      routeDirection: {
        x: anchor.crossing.direction.x,
        y: anchor.crossing.direction.z,
      },
      deployment: {
        player: "near-bank",
        enemy: "far-bank",
      },
    };
  }

  if (preset.encounterKind !== "road-ambush" || !anchor.road) return undefined;
  const matchingRoadTiles = [...mapData.tiles.values()].filter(
    (tile) =>
      !tile.blocksMovement &&
      tile.surface?.source === "worldforge-road" &&
      tile.surface.sourceIndex === anchor.road?.sourceIndex,
  );
  const anchorTile =
    centerTile?.surface?.sourceIndex === anchor.road.sourceIndex &&
    !centerTile.blocksMovement
      ? centerTile
      : matchingRoadTiles.sort(
          (a, b) =>
            Math.hypot(a.coordinates.x - center.x, a.coordinates.y - center.y) -
            Math.hypot(b.coordinates.x - center.x, b.coordinates.y - center.y),
        )[0];

  // A clipped source relation may leave no legal route tile. Omitting the
  // context is deliberate: parity exposes the missing projection instead of
  // silently placing combatants on unrelated terrain.
  if (!anchorTile) return undefined;

  return {
    kind: "road-ambush",
    source: "worldforge-road",
    sourceRoadRole: anchor.road.sourceRole,
    sourceRoadIndex: anchor.road.sourceIndex,
    anchorTile: anchorTile.coordinates,
    routeDirection: { x: anchor.road.direction.x, y: anchor.road.direction.z },
    deployment: {
      player: "traveling-column",
      enemy: "concealed-flanks",
    },
  };
}

export function createWorldBattleScenarioFromGround(
  preset: WorldBattleScenarioPreset,
  ground: GroundWorld,
  options: WorldBattleScenarioOptions = {},
): WorldBattleScenario {
  const anchor = scenarioAnchor(preset, ground);
  const anchorX = anchor.x;
  const anchorZ = anchor.z;
  const locationLabel = ground.towns[0]?.name ?? preset.label;
  const liveOccupants = allGroundAgentsAt(ground, preset.hour ?? 12);
  // Real worlds carry town plans and resolve live positions. Lightweight tests
  // and old serialized worlds may only carry the static schedule-derived sites.
  const sourceOccupants: readonly GroundOccupantProjectionInput[] =
    liveOccupants.length > 0 ? liveOccupants : ground.occupants;

  // Use the same production extractor as fight-in-place combat. The adapter
  // adds provenance after extraction because the lower-level bridge remains a
  // renderer-neutral WorldForge primitive shared by 2D and 3D consumers.
  const extracted = extractLocalTerrainPatch(
    ground,
    anchorX,
    anchorZ,
    preset.theme,
    preset.worldSeed,
    {
      ...preset.dimensions,
      occupants: sourceOccupants,
    },
  );
  let mapData: BattleMapData = {
    ...extracted,
    provenance: {
      kind: "worldforge",
      worldSeed: preset.worldSeed,
      anchorCellId: preset.entryCellId,
      scenarioId: preset.id,
      locationLabel,
      anchorWorldMeters: { x: anchorX, z: anchorZ },
      generationPath: ["World", "Region", "Local", "Ground", "Tactical patch"],
    },
  };
  if (preset.encounterKind === "opening-standoff") {
    // The lab exercises the production opening projector with a deterministic
    // receipt. Only the roster is a visual fixture; terrain and source identity
    // still come from this exact WorldForge build.
    const openingSource = {
      kind: "worldforge-opening-location" as const,
      receiptId: `opening:${preset.worldSeed}:cell:${preset.entryCellId}`,
      worldSeed: preset.worldSeed,
      cellId: preset.entryCellId,
      ...(preset.centerPx ? { centerPx: preset.centerPx } : {}),
      locationLabel,
    };
    const projection = projectOpeningThreatBattlefield(
      mapData,
      openingSource,
      preset.visualOpeningThreatFixture ?? [],
    );
    if (projection.status !== "ready") {
      throw new Error(projection.detail);
    }
    let currentOpeningProjection = projection;
    if (preset.visualReplayOpeningReceipt) {
      // Re-enter through the production replay path using the frozen v2 receipt.
      // A failure here means the visual harness has caught source drift rather
      // than quietly presenting the first authored frame as continuity proof.
      const replay = projectOpeningThreatBattlefield(
        mapData,
        openingSource,
        preset.visualOpeningThreatFixture ?? [],
        projection.receipt,
      );
      if (replay.status !== "ready") throw new Error(replay.detail);
      currentOpeningProjection = replay;
    }

    if (preset.visualOpeningResolutionFixture) {
      const activeContext = currentOpeningProjection.mapData.encounterContext;
      if (activeContext?.kind !== "opening-standoff") {
        throw new Error(
          "Opening aftermath fixture did not receive a source opening context.",
        );
      }

      // This deterministic outcome uses the same source identities and cells
      // that the production CombatView would report. The lead creature and the
      // beast are downed while the middle pair withdraw, forcing the visual
      // proof to preserve species-specific bodies instead of two lookalike
      // humanoid tokens. A return view still cannot redraw the complete roster.
      const lastEntityIndex = activeContext.sourceEntities.length - 1;
      const finalEnemyState: CombatEnemySnapshotEntry[] =
        activeContext.sourceEntities.map((entity, index) => {
          const { position, ...worldSource } = entity;
          return {
            id: `aftermath-fixture:${entity.entityId}`,
            currentHP: index === 0 || index === lastEntityIndex ? 0 : 1,
            position: { ...position },
            worldSource,
          };
        });
      const resolution = resolveOpeningThreatSceneAfterCombat(
        currentOpeningProjection.receipt,
        currentOpeningProjection.mapData,
        finalEnemyState,
        "victory",
        Math.round((preset.hour ?? 12) * 60 * 60 * 1000),
      );
      if (resolution.status !== "ready") throw new Error(resolution.detail);
      const returned = projectResolvedOpeningThreatReturnBattlefield(
        mapData,
        openingSource,
        preset.visualOpeningThreatFixture ?? [],
        resolution.receipt,
      );
      if (returned.status !== "ready") throw new Error(returned.detail);
      mapData = returned.mapData;
    } else {
      mapData = currentOpeningProjection.mapData;
    }
  } else {
    mapData.encounterContext = scenarioEncounterContext(
      preset,
      anchor,
      mapData,
      ground,
      options,
    );
  }

  return {
    key: `${preset.id}:${preset.worldSeed}:${preset.entryCellId}`,
    preset,
    locationLabel,
    mapData,
    diagnostics: summarizeWorldBattleScenario(ground, mapData, sourceOccupants),
  };
}
