// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 00:29:15
 * Dependents: components/DesignPreview/steps/PreviewBattleMapScenarioLab.tsx
 * Imports: 2 files
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
  BattleMapTerrain,
} from '@/types/combat';
import {
  extractLocalTerrainPatch,
  type GroundWorld,
} from '@/systems/worldforge/bridge/groundChunkLoader';

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
  theme: BattleMapBiome;
  dimensions: { width: number; height: number };
  /** How the tactical crop chooses its exact location inside the generated ground window. */
  anchorMode?: 'ground-center' | 'nearest-road' | 'nearest-crossing';
  /** Machine-readable encounter framing expected from the selected world fact. */
  encounterKind?: BattleMapEncounterContext['kind'];
  sourceRouteQuery: string;
}

export const WORLD_BATTLE_SCENARIO_PRESETS: readonly WorldBattleScenarioPreset[] = [
  {
    id: 'wilderness-road-ambush',
    label: 'Road Ambush',
    encounterFrame: 'Route interception',
    description: 'A real atlas trail through an unbuilt wilderness cell, proving source geometry, route clearance, and tactical movement agree without town-street noise.',
    worldSeed: 42,
    entryCellId: 373,
    theme: 'forest',
    dimensions: { width: 80, height: 60 },
    anchorMode: 'nearest-road',
    encounterKind: 'road-ambush',
    sourceRouteQuery: 'phase=world3d&ground=1&dcell=373&wfseed=42',
  },
  {
    id: 'river-bridge-crossing',
    label: 'River Crossing',
    encounterFrame: 'Bridge interception',
    description: 'A real atlas highway crossing a broad river, proving one Region crossing receipt drives the Ground bridge deck, tactical passability, and bank-aware deployment.',
    worldSeed: 42,
    entryCellId: 853,
    theme: 'forest',
    dimensions: { width: 80, height: 60 },
    anchorMode: 'nearest-crossing',
    encounterKind: 'river-crossing',
    sourceRouteQuery: 'phase=world3d&ground=1&dcell=853&wfseed=42',
  },
  {
    id: 'boreal-woodland',
    label: 'Boreal Woodland',
    encounterFrame: 'Wilderness patrol',
    description: 'A cell-native taiga location for judging real tree, bush, and boulder groupings without settlement noise.',
    worldSeed: 42,
    entryCellId: 476,
    theme: 'forest',
    dimensions: { width: 80, height: 60 },
    sourceRouteQuery: 'phase=world3d&ground=1&dcell=476&wfseed=42',
  },
  {
    id: 'legium-town-skirmish',
    label: 'Legium',
    encounterFrame: 'Town skirmish',
    description: 'The default generated ground settlement, stressing buildings, interiors, road runs, and placed cover props.',
    worldSeed: 42,
    entryCellId: 829,
    centerPx: [641.2, 149.42],
    theme: 'forest',
    dimensions: { width: 80, height: 60 },
    sourceRouteQuery: 'phase=world3d&ground=1&gx=16&gy=4&wfseed=42',
  },
] as const;

export type WorldBattleParityStatus = 'pass' | 'warning' | 'gap';

export interface WorldBattleParityCheck {
  id: string;
  label: string;
  status: WorldBattleParityStatus;
  detail: string;
}

export interface WorldBattleSourceFacts {
  naturalFeatures: number;
  placedProps: number;
  roadRuns: number;
  regionalRoadRuns: number;
  townStreetRuns: number;
  riverRuns: number;
  crossings: number;
  bridges: number;
  fords: number;
  buildings: number;
  towns: number;
  hostiles: number;
}

export interface WorldBattleTacticalFacts {
  tiles: number;
  blockedTiles: number;
  coverTiles: number;
  decoratedTiles: number;
  targetableObjects: number;
  roadTiles: number;
  regionalRoadTiles: number;
  townStreetTiles: number;
  passableRoadTiles: number;
  crossingTiles: number;
  bridgeTiles: number;
  fordTiles: number;
  passableCrossingTiles: number;
  encounterContext: BattleMapEncounterContext['kind'] | null;
  terrain: Record<BattleMapTerrain, number>;
  decorations: Partial<Record<Exclude<BattleMapDecoration, null>, number>>;
}

export interface WorldBattleScenarioDiagnostics {
  source: WorldBattleSourceFacts;
  tactical: WorldBattleTacticalFacts;
  parity: WorldBattleParityCheck[];
}

export interface WorldBattleScenario {
  key: string;
  preset: WorldBattleScenarioPreset;
  locationLabel: string;
  mapData: BattleMapData;
  diagnostics: WorldBattleScenarioDiagnostics;
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

export function summarizeWorldBattleScenario(
  ground: GroundWorld,
  mapData: BattleMapData,
): WorldBattleScenarioDiagnostics {
  const terrain = emptyTerrainCounts();
  const decorations: WorldBattleTacticalFacts['decorations'] = {};
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
    if (tile.surface?.kind === 'road') {
      roadTiles += 1;
      if (tile.surface.sourceRole === 'regional-route') regionalRoadTiles += 1;
      if (tile.surface.sourceRole === 'town-street') townStreetTiles += 1;
      if (!tile.blocksMovement && tile.movementCost > 0) passableRoadTiles += 1;
    }
    if (tile.crossing) {
      crossingTiles += 1;
      if (tile.crossing.kind === 'bridge') bridgeTiles += 1;
      if (tile.crossing.kind === 'ford') fordTiles += 1;
      if (!tile.blocksMovement && tile.movementCost > 0) passableCrossingTiles += 1;
    }
    if (tile.decoration) {
      decoratedTiles += 1;
      decorations[tile.decoration] = (decorations[tile.decoration] ?? 0) + 1;
    }
  }

  const sourceCrossings = ground.crossings ?? [];
  const source: WorldBattleSourceFacts = {
    naturalFeatures: ground.features.length,
    placedProps: ground.props.length,
    roadRuns: ground.roads.length,
    regionalRoadRuns: ground.roads.filter((road) => road.sourceKind === 'region-road').length,
    townStreetRuns: ground.roads.filter((road) => road.sourceKind === 'town-street').length,
    riverRuns: ground.rivers.length,
    crossings: sourceCrossings.length,
    bridges: sourceCrossings.filter((crossing) => crossing.kind === 'bridge').length,
    fords: sourceCrossings.filter((crossing) => crossing.kind === 'ford').length,
    buildings: ground.buildings.length,
    towns: ground.towns.length,
    hostiles: ground.hostiles.length,
  };
  const tactical: WorldBattleTacticalFacts = {
    tiles: mapData.tiles.size,
    blockedTiles,
    coverTiles,
    decoratedTiles,
    targetableObjects: mapData.targetableObjects?.length ?? 0,
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

  const hasSourceObjects = source.naturalFeatures > 0 || source.placedProps > 0;
  const hasProjectedStructures = terrain.floor > 0 || terrain.wall > 0;

  // Every warning is an actionable bridge question, not a generic quality
  // score. A source fact can be absent (pass/not applicable), represented, or
  // visibly missing from the tactical vocabulary.
  const parity: WorldBattleParityCheck[] = [
    {
      id: 'world-lineage',
      label: 'World lineage retained',
      status: mapData.provenance?.kind === 'worldforge' ? 'pass' : 'gap',
      detail: mapData.provenance?.kind === 'worldforge'
        ? `World ${mapData.provenance.worldSeed}${mapData.provenance.anchorCellId == null ? '' : `, cell ${mapData.provenance.anchorCellId}`} is attached to the tactical map.`
        : 'The tactical map lost its WorldForge origin.',
    },
    {
      id: 'natural-features',
      label: 'Natural features projected',
      status: source.naturalFeatures === 0
        ? 'warning'
        : decoratedTiles > 0 ? 'pass' : 'gap',
      detail: source.naturalFeatures === 0
        ? 'This location has no source-world natural features to evaluate.'
        : `${decoratedTiles.toLocaleString()} tactical cells inherit trees, bushes, or boulders from ${source.naturalFeatures.toLocaleString()} world features.`,
    },
    {
      id: 'structures',
      label: 'Structures projected',
      status: source.buildings === 0 || hasProjectedStructures ? 'pass' : 'gap',
      detail: source.buildings === 0
        ? 'No buildings are present in this source location.'
        : hasProjectedStructures
          ? `${source.buildings.toLocaleString()} source buildings produce floor and wall referee cells.`
          : `${source.buildings.toLocaleString()} source buildings exist, but no tactical floor or wall cells were produced.`,
    },
    {
      id: 'road-semantics',
      label: 'Roads have tactical meaning',
      status: source.roadRuns === 0 || (roadTiles > 0 && passableRoadTiles > 0) ? 'pass' : 'gap',
      detail: source.roadRuns === 0
        ? 'No road crosses this source location.'
        : roadTiles > 0 && passableRoadTiles > 0
          ? `${roadTiles.toLocaleString()} referee cells retain source road runs; ${passableRoadTiles.toLocaleString()} are currently traversable.`
          : `${source.roadRuns.toLocaleString()} source road runs are present, but none reach the tactical crop as traversable surface facts.`,
    },
    {
      id: 'encounter-framing',
      label: 'Encounter framing uses source facts',
      status: source.roadRuns === 0 && source.crossings === 0
        ? 'pass'
        : mapData.encounterContext?.source === 'worldforge-road'
          || mapData.encounterContext?.source === 'worldforge-crossing'
          ? 'pass'
          : 'warning',
      detail: source.roadRuns === 0 && source.crossings === 0
        ? 'This location has no route or crossing requiring source-aware deployment.'
        : mapData.encounterContext?.kind === 'road-ambush'
          ? `The ${mapData.encounterContext.sourceRoadRole} heading drives a traveling party column and concealed flanks.`
          : mapData.encounterContext?.kind === 'river-crossing'
            ? `The ${mapData.encounterContext.crossingKind} heading divides deployment between the near and far banks.`
            : 'Source routes reach the referee grid, but this scenario does not yet provide a source-derived deployment frame.',
    },
    {
      id: 'river-semantics',
      label: 'Rivers reach the referee',
      status: source.riverRuns === 0 || terrain.water > 0 ? 'pass' : 'gap',
      detail: source.riverRuns === 0
        ? 'No river crosses this source location.'
        : terrain.water > 0
          ? `${source.riverRuns.toLocaleString()} river runs correspond with ${terrain.water.toLocaleString()} water cells.`
          : `${source.riverRuns.toLocaleString()} source river runs exist, but the tactical crop has no water cells.`,
    },
    {
      id: 'crossing-semantics',
      label: 'Crossings remain traversable',
      status: source.crossings === 0
        ? 'pass'
        : crossingTiles > 0 && passableCrossingTiles === crossingTiles ? 'pass' : 'gap',
      detail: source.crossings === 0
        ? 'No source bridge or ford crosses this location.'
        : crossingTiles > 0 && passableCrossingTiles === crossingTiles
          ? `${source.crossings.toLocaleString()} source crossing receipts produce ${crossingTiles.toLocaleString()} traversable referee cells without erasing the water terrain.`
          : `${source.crossings.toLocaleString()} source crossing receipts exist, but the tactical crop has ${passableCrossingTiles.toLocaleString()} traversable crossing cells.`,
    },
    {
      id: 'object-targeting',
      label: 'World objects are spell-targetable',
      status: !hasSourceObjects || tactical.targetableObjects > 0 ? 'pass' : 'gap',
      detail: !hasSourceObjects
        ? 'No source objects require tactical object facts.'
        : tactical.targetableObjects > 0
          ? `${tactical.targetableObjects.toLocaleString()} explicit object facts are available to spells.`
          : 'World features and props are visible, but the extracted patch does not yet publish TargetableMapObject facts for them.',
    },
  ];

  return { source, tactical, parity };
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
    sourceRole: Extract<BattleMapEncounterContext, { kind: 'road-ambush' }>['sourceRoadRole'];
    direction: { x: number; z: number };
  };
  crossing?: {
    id: string;
    kind: Extract<BattleMapEncounterContext, { kind: 'river-crossing' }>['crossingKind'];
    roadSourceIndex?: number;
    riverSourceIndex?: number;
    direction: { x: number; z: number };
  };
};

const roadSourceRole = (
  road: GroundWorld['roads'][number],
): Extract<BattleMapEncounterContext, { kind: 'road-ambush' }>['sourceRoadRole'] => (
  road.sourceKind === 'region-road'
    ? 'regional-route'
    : road.sourceKind === 'town-street' ? 'town-street' : 'unclassified'
);

/** Pick a real source location for the crop; road scenarios never synthesize a route. */
function scenarioAnchor(
  preset: WorldBattleScenarioPreset,
  ground: GroundWorld,
): ScenarioAnchor {
  const center = { x: ground.extentMetersX / 2, z: ground.extentMetersZ / 2 };
  if (preset.anchorMode === 'nearest-crossing') {
    const crossings = ground.crossings ?? [];
    // Prefer a physical bridge when a window happens to contain both crossing
    // forms; the first harness fixture should exercise the Ground deck path.
    const candidates = crossings.some((crossing) => crossing.kind === 'bridge')
      ? crossings.filter((crossing) => crossing.kind === 'bridge')
      : crossings;
    const crossing = [...candidates].sort((a, b) => (
      (a.xM - center.x) ** 2 + (a.zM - center.z) ** 2
      - ((b.xM - center.x) ** 2 + (b.zM - center.z) ** 2)
    ))[0];
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
  if (preset.anchorMode !== 'nearest-road') return center;

  // A route ambush belongs on the regional approach, not in a dense town-road
  // mesh. The crop clearance keeps the whole referee board outside a town's
  // coarse envelope when the source route provides such a point.
  const indexedRoads = ground.roads.map((road, sourceIndex) => ({ road, sourceIndex }));
  const regionalRoads = indexedRoads.filter(({ road }) => road.sourceKind === 'region-road');
  const roads = regionalRoads.length > 0 ? regionalRoads : indexedRoads;
  const patchClearanceM = Math.hypot(
    preset.dimensions.width * 1.524 / 2,
    preset.dimensions.height * 1.524 / 2,
  ) + 12;
  const clearsSettlements = (candidate: { x: number; z: number }): boolean => (
    ground.towns.every((town) => (
      Math.hypot(candidate.x - town.xM, candidate.z - town.zM) > town.halfM + patchClearanceM
    ))
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
        const distanceSq = (candidate.x - center.x) ** 2 + (candidate.z - center.z) ** 2;
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
): BattleMapEncounterContext | undefined {
  const center = {
    x: Math.floor(mapData.dimensions.width / 2),
    y: Math.floor(mapData.dimensions.height / 2),
  };
  const centerTile = mapData.tiles.get(`${center.x}-${center.y}`);

  if (preset.encounterKind === 'river-crossing' && anchor.crossing) {
    const matchingCrossingTiles = [...mapData.tiles.values()].filter((tile) => (
      !tile.blocksMovement
      && tile.crossing?.sourceCrossingId === anchor.crossing?.id
    ));
    const anchorTile = centerTile?.crossing?.sourceCrossingId === anchor.crossing.id
      && !centerTile.blocksMovement
      ? centerTile
      : matchingCrossingTiles.sort((a, b) => (
        Math.hypot(a.coordinates.x - center.x, a.coordinates.y - center.y)
        - Math.hypot(b.coordinates.x - center.x, b.coordinates.y - center.y)
      ))[0];
    if (!anchorTile) return undefined;

    return {
      kind: 'river-crossing',
      source: 'worldforge-crossing',
      sourceCrossingId: anchor.crossing.id,
      crossingKind: anchor.crossing.kind,
      anchorTile: anchorTile.coordinates,
      routeDirection: { x: anchor.crossing.direction.x, y: anchor.crossing.direction.z },
      deployment: {
        player: 'near-bank',
        enemy: 'far-bank',
      },
    };
  }

  if (preset.encounterKind !== 'road-ambush' || !anchor.road) return undefined;
  const matchingRoadTiles = [...mapData.tiles.values()].filter((tile) => (
    !tile.blocksMovement
    && tile.surface?.source === 'worldforge-road'
    && tile.surface.sourceIndex === anchor.road?.sourceIndex
  ));
  const anchorTile = centerTile?.surface?.sourceIndex === anchor.road.sourceIndex
    && !centerTile.blocksMovement
    ? centerTile
    : matchingRoadTiles.sort((a, b) => (
      Math.hypot(a.coordinates.x - center.x, a.coordinates.y - center.y)
      - Math.hypot(b.coordinates.x - center.x, b.coordinates.y - center.y)
    ))[0];

  // A clipped source relation may leave no legal route tile. Omitting the
  // context is deliberate: parity exposes the missing projection instead of
  // silently placing combatants on unrelated terrain.
  if (!anchorTile) return undefined;

  return {
    kind: 'road-ambush',
    source: 'worldforge-road',
    sourceRoadRole: anchor.road.sourceRole,
    sourceRoadIndex: anchor.road.sourceIndex,
    anchorTile: anchorTile.coordinates,
    routeDirection: { x: anchor.road.direction.x, y: anchor.road.direction.z },
    deployment: {
      player: 'traveling-column',
      enemy: 'concealed-flanks',
    },
  };
}

export function createWorldBattleScenarioFromGround(
  preset: WorldBattleScenarioPreset,
  ground: GroundWorld,
): WorldBattleScenario {
  const anchor = scenarioAnchor(preset, ground);
  const anchorX = anchor.x;
  const anchorZ = anchor.z;
  const locationLabel = ground.towns[0]?.name ?? preset.label;

  // Use the same production extractor as fight-in-place combat. The adapter
  // adds provenance after extraction because the lower-level bridge remains a
  // renderer-neutral WorldForge primitive shared by 2D and 3D consumers.
  const extracted = extractLocalTerrainPatch(
    ground,
    anchorX,
    anchorZ,
    preset.theme,
    preset.worldSeed,
    preset.dimensions,
  );
  const mapData: BattleMapData = {
    ...extracted,
    provenance: {
      kind: 'worldforge',
      worldSeed: preset.worldSeed,
      anchorCellId: preset.entryCellId,
      scenarioId: preset.id,
      locationLabel,
      anchorWorldMeters: { x: anchorX, z: anchorZ },
      generationPath: ['World', 'Region', 'Local', 'Ground', 'Tactical patch'],
    },
  };
  mapData.encounterContext = scenarioEncounterContext(preset, anchor, mapData);

  return {
    key: `${preset.id}:${preset.worldSeed}:${preset.entryCellId}`,
    preset,
    locationLabel,
    mapData,
    diagnostics: summarizeWorldBattleScenario(ground, mapData),
  };
}
