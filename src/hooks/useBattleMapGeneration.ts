// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:58:08
 * Dependents: components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file hooks/useBattleMapGeneration.ts
 * Utility logic for battle-map setup generation.
 * The filename is still hook-shaped for caller stability, but this module is
 * a plain stateless helper. Keep callers pointed here until a coordinated
 * rename can update every use site together.
 */
import {
  BattleMapBiome,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  CharacterPosition,
} from "../types/combat";
import { BATTLE_MAP_DIMENSIONS } from "../config/mapConfig";
import { BattleMapGenerator } from "../services/battleMapGenerator";
import { SeededRandom } from "@/utils/random";

type SpawnConfig =
  "left-right" | "top-bottom" | "corners-tl-br" | "corners-tr-bl";

// Teams spawn inside a bounded engagement window centered in the arena, not at
// the arena's far edges. When the battlefield quadrupled to 80×60 (2026-07-01)
// percentage-of-map spawn strips put teams 40-70 tiles apart — many turns of
// pure walking before first contact. The window keeps opening engagement range
// at the proven 40×30-era pacing; the arena beyond it is maneuvering room.
const SPAWN_WINDOW = { width: 48, height: 36 };

const _getSpawnTiles = (
  mapData: BattleMapData,
  config: SpawnConfig,
  rng: SeededRandom,
): { playerTiles: BattleMapTile[]; enemyTiles: BattleMapTile[] } => {
  const playerSpawnTiles: BattleMapTile[] = [];
  const enemySpawnTiles: BattleMapTile[] = [];
  const { width: mapW, height: mapH } = mapData.dimensions;
  const width = Math.min(mapW, SPAWN_WINDOW.width);
  const height = Math.min(mapH, SPAWN_WINDOW.height);
  const ox = Math.floor((mapW - width) / 2);
  const oy = Math.floor((mapH - height) / 2);
  // Wide corners ensure enough walkable tiles even in dense biomes
  const cornerSize = Math.floor(Math.min(width, height) * 0.35); // ~35% of shorter dimension

  const addTilesFromRect = (
    tiles: BattleMapTile[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    for (let y = y1 + oy; y < y2 + oy; y++) {
      for (let x = x1 + ox; x < x2 + ox; x++) {
        const tile = mapData.tiles.get(`${x}-${y}`);
        if (tile && !tile.blocksMovement) tiles.push(tile);
      }
    }
  };

  switch (config) {
    case "top-bottom": {
      const stripH = Math.floor(height * 0.25); // top/bottom 25% each
      addTilesFromRect(playerSpawnTiles, 0, 0, width, stripH);
      addTilesFromRect(enemySpawnTiles, 0, height - stripH, width, height);
      break;
    }
    case "corners-tl-br":
      addTilesFromRect(playerSpawnTiles, 0, 0, cornerSize, cornerSize);
      addTilesFromRect(
        enemySpawnTiles,
        width - cornerSize,
        height - cornerSize,
        width,
        height,
      );
      break;
    case "corners-tr-bl":
      addTilesFromRect(
        playerSpawnTiles,
        width - cornerSize,
        0,
        width,
        cornerSize,
      );
      addTilesFromRect(
        enemySpawnTiles,
        0,
        height - cornerSize,
        cornerSize,
        height,
      );
      break;
    case "left-right":
    default: {
      const stripW = Math.floor(width * 0.25); // left/right 25% each
      addTilesFromRect(playerSpawnTiles, 0, 0, stripW, height);
      addTilesFromRect(enemySpawnTiles, width - stripW, 0, width, height);
      break;
    }
  }

  // Shuffle results
  const shuffle = (array: BattleMapTile[]) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  // Tactical spawn score (battle-map G6 / GOAL #64): spawns should use the
  // terrain — high ground and cover-adjacent tiles beat open ground. Scored
  // candidates are stable-sorted best-first AFTER the seeded shuffle, so the
  // shuffle remains the tiebreak among equal scores and same-seed runs stay
  // deterministic. Wedged pockets (nearly enclosed tiles) are penalized so
  // "near cover" never degrades into "stuck in a hole".
  const tacticalScore = (tile: BattleMapTile): number => {
    const { x, y } = tile.coordinates;
    let coverNeighbors = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const n = mapData.tiles.get(`${x + dx}-${y + dy}`);
        if (n && (n.blocksMovement || n.blocksLoS || n.providesCover))
          coverNeighbors++;
      }
    }
    const coverScore =
      coverNeighbors === 0
        ? 0 // open ground
        : coverNeighbors <= 2
          ? 3 // flanking a rock/tree — ideal
          : coverNeighbors <= 4
            ? 1 // cramped but covered
            : -2; // wedged pocket — avoid
    return tile.elevation * 2 + coverScore + (tile.providesCover ? 1 : 0);
  };

  // Spread characters within their zone: claim a tile only if no already-claimed
  // tile is within MIN_SEP (Chebyshev). MIN_SEP=2 gives a visible formation
  // (≥2-tile gaps) instead of a clump; fallback fills if the zone is too tight.
  const MIN_SEP = 2;
  const spreadTiles = (
    tiles: BattleMapTile[],
    count: number,
  ): BattleMapTile[] => {
    // Seeded shuffle first (tiebreak), then stable sort by tactical score so
    // the spread pass claims the best terrain positions first.
    const shuffled = shuffle([...tiles]).sort(
      (a, b) => tacticalScore(b) - tacticalScore(a),
    );
    const occupied = new Set<string>();
    const result: BattleMapTile[] = [];
    const fallback: BattleMapTile[] = [];

    for (const tile of shuffled) {
      const { x, y } = tile.coordinates;
      const key = `${x}-${y}`;
      let hasNeighbor = false;
      for (let dx = -MIN_SEP; dx <= MIN_SEP && !hasNeighbor; dx++) {
        for (let dy = -MIN_SEP; dy <= MIN_SEP; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (occupied.has(`${x + dx}-${y + dy}`)) {
            hasNeighbor = true;
            break;
          }
        }
      }
      if (!hasNeighbor) {
        occupied.add(key);
        result.push(tile);
      } else {
        fallback.push(tile);
      }
    }
    // Fill remaining slots from fallback if spread tiles don't cover all characters
    for (const tile of fallback) {
      if (result.length >= count) break;
      result.push(tile);
    }
    return result;
  };

  return {
    playerTiles: spreadTiles(playerSpawnTiles, 20),
    enemyTiles: spreadTiles(enemySpawnTiles, 20),
  };
};

// ============================================================================
// G6 Tactical Spawn Selection
// ============================================================================
// This section is the live spawn selector for procedural maps. It preserves the
// existing zone configurations and seeded tie-breaking, then ranks candidate
// tiles by tactical value and falls back to the nearest walkable map tile when a
// preferred zone cannot supply enough legal positions.
// ============================================================================

const MIN_SEP = 2;

type SpawnRect = { x1: number; y1: number; x2: number; y2: number };

type TeamSpawnPlan = {
  zoneTiles: BattleMapTile[];
  zoneCenter: { x: number; y: number };
  enemyAnchor: { x: number; y: number };
};

const tileKey = (tile: BattleMapTile): string =>
  `${tile.coordinates.x}-${tile.coordinates.y}`;

const pointDistance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): number => Math.hypot(a.x - b.x, a.y - b.y);

const rectCenter = (rect: SpawnRect): { x: number; y: number } => ({
  x: (rect.x1 + rect.x2 - 1) / 2,
  y: (rect.y1 + rect.y2 - 1) / 2,
});

const spawnRectsForConfig = (
  width: number,
  height: number,
  config: SpawnConfig,
): { player: SpawnRect; enemy: SpawnRect } => {
  // Keep the same deployment shapes as the legacy helper so scoring changes
  // tile preference, not the high-level encounter formation.
  const cornerSize = Math.floor(Math.min(width, height) * 0.35);

  switch (config) {
    case "top-bottom": {
      const stripH = Math.floor(height * 0.25);
      return {
        player: { x1: 0, y1: 0, x2: width, y2: stripH },
        enemy: { x1: 0, y1: height - stripH, x2: width, y2: height },
      };
    }
    case "corners-tl-br":
      return {
        player: { x1: 0, y1: 0, x2: cornerSize, y2: cornerSize },
        enemy: {
          x1: width - cornerSize,
          y1: height - cornerSize,
          x2: width,
          y2: height,
        },
      };
    case "corners-tr-bl":
      return {
        player: { x1: width - cornerSize, y1: 0, x2: width, y2: cornerSize },
        enemy: { x1: 0, y1: height - cornerSize, x2: cornerSize, y2: height },
      };
    case "left-right":
    default: {
      const stripW = Math.floor(width * 0.25);
      return {
        player: { x1: 0, y1: 0, x2: stripW, y2: height },
        enemy: { x1: width - stripW, y1: 0, x2: width, y2: height },
      };
    }
  }
};

const walkableTilesInRect = (
  mapData: BattleMapData,
  rect: SpawnRect,
): BattleMapTile[] => {
  const tiles: BattleMapTile[] = [];

  // Clamp rectangles to the map bounds so test fixtures and future alternate
  // map sizes still use the same spawn logic safely.
  for (
    let y = Math.max(0, rect.y1);
    y < Math.min(mapData.dimensions.height, rect.y2);
    y++
  ) {
    for (
      let x = Math.max(0, rect.x1);
      x < Math.min(mapData.dimensions.width, rect.x2);
      x++
    ) {
      const tile = mapData.tiles.get(`${x}-${y}`);
      if (tile && !tile.blocksMovement) {
        tiles.push(tile);
      }
    }
  }

  return tiles;
};

const nearbyTiles = (
  mapData: BattleMapData,
  tile: BattleMapTile,
): BattleMapTile[] => {
  const tiles: BattleMapTile[] = [];
  const { x, y } = tile.coordinates;

  // Nearby blockers and cover tiles are enough to express cover pressure
  // without running a full line-of-sight pass for every candidate.
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const neighbor = mapData.tiles.get(`${x + dx}-${y + dy}`);
      if (neighbor) {
        tiles.push(neighbor);
      }
    }
  }

  return tiles;
};

const cardinalWalkableCount = (
  mapData: BattleMapData,
  tile: BattleMapTile,
): number => {
  const { x, y } = tile.coordinates;
  let count = 0;

  // Cardinal exits approximate chokepoint quality: two or three exits are
  // defensible lanes, while one exit is usually a trap for a starting unit.
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const neighbor = mapData.tiles.get(`${x + dx}-${y + dy}`);
    if (neighbor && !neighbor.blocksMovement) {
      count++;
    }
  }

  return count;
};

const coverScore = (mapData: BattleMapData, tile: BattleMapTile): number => {
  const coverNeighbors = nearbyTiles(mapData, tile).filter(
    (neighbor) =>
      neighbor.blocksMovement || neighbor.blocksLoS || neighbor.providesCover,
  ).length;

  // Reward usable cover and blocked-line proximity, then penalize heavy
  // enclosure so "near cover" does not become "spawned in a pocket."
  if (coverNeighbors === 0) {
    return tile.providesCover ? 1 : 0;
  }
  if (coverNeighbors <= 3) {
    return 4 + (tile.providesCover ? 1 : 0);
  }
  if (coverNeighbors <= 5) {
    return 1;
  }
  return -4;
};

const chokepointScore = (
  mapData: BattleMapData,
  tile: BattleMapTile,
): number => {
  const exits = cardinalWalkableCount(mapData, tile);

  // Battle starts should favor controlled lanes over dead ends.
  if (exits <= 1) {
    return -3;
  }
  if (exits === 2) {
    return 2;
  }
  if (exits === 3) {
    return 1;
  }
  return 0;
};

const enemyDistanceScore = (
  tile: BattleMapTile,
  enemyAnchors: Array<{ x: number; y: number }>,
): number => {
  if (enemyAnchors.length === 0) {
    return 0;
  }

  const closestEnemyDistance = Math.min(
    ...enemyAnchors.map((anchor) => pointDistance(tile.coordinates, anchor)),
  );

  // This band keeps opening pressure meaningful without starting opposing
  // units on top of each other before turn order begins.
  if (closestEnemyDistance < 5) {
    return -8;
  }
  if (closestEnemyDistance <= 8) {
    return 1;
  }
  if (closestEnemyDistance <= 18) {
    return 5;
  }
  if (closestEnemyDistance <= 26) {
    return 2;
  }
  return -2;
};

const tacticalSpawnScore = (
  mapData: BattleMapData,
  tile: BattleMapTile,
  enemyAnchors: Array<{ x: number; y: number }>,
): number =>
  coverScore(mapData, tile) +
  tile.elevation * 2 +
  chokepointScore(mapData, tile) +
  enemyDistanceScore(tile, enemyAnchors);

const getTacticalSpawnTiles = (
  mapData: BattleMapData,
  config: SpawnConfig,
  rng: SeededRandom,
  playerCount: number,
  enemyCount: number,
): { playerTiles: BattleMapTile[]; enemyTiles: BattleMapTile[] } => {
  const { width, height } = mapData.dimensions;
  const rects = spawnRectsForConfig(width, height, config);
  const playerCenter = rectCenter(rects.player);
  const enemyCenter = rectCenter(rects.enemy);
  const allWalkableTiles = [...mapData.tiles.values()].filter(
    (tile) => !tile.blocksMovement,
  );

  const shuffle = (array: BattleMapTile[]) => {
    // Preserve seeded randomness as the tie-breaker for equally useful
    // tactical positions.
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const nearestFallbackTiles = (
    plan: TeamSpawnPlan,
    occupied: Set<string>,
  ): BattleMapTile[] =>
    shuffle(
      allWalkableTiles.filter((tile) => !occupied.has(tileKey(tile))),
    ).sort((a, b) => {
      // When a zone is exhausted, proximity to the original zone is
      // the first fallback priority. Score is the tie-breaker.
      const distanceDelta =
        pointDistance(a.coordinates, plan.zoneCenter) -
        pointDistance(b.coordinates, plan.zoneCenter);

      if (distanceDelta !== 0) {
        return distanceDelta;
      }

      return (
        tacticalSpawnScore(mapData, b, [plan.enemyAnchor]) -
        tacticalSpawnScore(mapData, a, [plan.enemyAnchor])
      );
    });

  const hasNearbyFriendly = (
    tile: BattleMapTile,
    selectedTiles: BattleMapTile[],
  ): boolean =>
    selectedTiles.some(
      (selectedTile) =>
        Math.max(
          Math.abs(selectedTile.coordinates.x - tile.coordinates.x),
          Math.abs(selectedTile.coordinates.y - tile.coordinates.y),
        ) <= MIN_SEP,
    );

  const spreadTiles = (
    plan: TeamSpawnPlan,
    count: number,
    occupied: Set<string>,
    enemyTiles: BattleMapTile[],
  ): BattleMapTile[] => {
    const result: BattleMapTile[] = [];
    const fallback: BattleMapTile[] = [];
    const enemyAnchors =
      enemyTiles.length > 0
        ? enemyTiles.map((tile) => tile.coordinates)
        : [plan.enemyAnchor];
    const rankedZoneTiles = shuffle([...plan.zoneTiles])
      .filter((tile) => !occupied.has(tileKey(tile)))
      .sort(
        (a, b) =>
          tacticalSpawnScore(mapData, b, enemyAnchors) -
          tacticalSpawnScore(mapData, a, enemyAnchors),
      );

    // First pass preserves MIN_SEP for the visible formation whenever the
    // preferred zone has enough room.
    for (const tile of rankedZoneTiles) {
      if (!hasNearbyFriendly(tile, result)) {
        occupied.add(tileKey(tile));
        result.push(tile);
      } else {
        fallback.push(tile);
      }

      if (result.length >= count) {
        return result;
      }
    }

    // Second pass mirrors the old dense-zone behavior: use legal same-zone
    // fallbacks before leaving the preferred deployment area.
    for (const tile of fallback) {
      if (result.length >= count) break;
      if (!occupied.has(tileKey(tile))) {
        occupied.add(tileKey(tile));
        result.push(tile);
      }
    }

    // Final pass handles exhausted preferred zones by choosing the nearest
    // unclaimed walkable tiles anywhere on the map.
    for (const tile of nearestFallbackTiles(plan, occupied)) {
      if (result.length >= count) break;
      occupied.add(tileKey(tile));
      result.push(tile);
    }

    return result;
  };

  const playerPlan: TeamSpawnPlan = {
    zoneTiles: walkableTilesInRect(mapData, rects.player),
    zoneCenter: playerCenter,
    enemyAnchor: enemyCenter,
  };
  const enemyPlan: TeamSpawnPlan = {
    zoneTiles: walkableTilesInRect(mapData, rects.enemy),
    zoneCenter: enemyCenter,
    enemyAnchor: playerCenter,
  };
  // Ambient source residents are physical location facts even before neutral
  // initiative rules exist. Reserve their cells so combat never starts with a
  // party member or defender stacked on a named civilian household cluster.
  const occupied = new Set<string>(
    (mapData.worldOccupants ?? []).map(
      (occupant) => `${occupant.position.x}-${occupant.position.y}`,
    ),
  );
  // Reserve only the positions needed by the current roster. This matters on
  // dense maps where a fixed oversized reservation could consume every
  // fallback tile for one team before the other team gets a chance to place.
  const playerTiles = spreadTiles(playerPlan, playerCount, occupied, []);
  const enemyTiles = spreadTiles(enemyPlan, enemyCount, occupied, playerTiles);

  return { playerTiles, enemyTiles };
};

// ============================================================================
// Walkable Tile Search for Preset Maps
// ============================================================================
// Finds the closest tile to a target coordinate that is walkable and not yet
// claimed by another character. Used to position teams near their relative
// starting spots on pre-extracted ground maps.
// ============================================================================
function findNearestWalkableTile(
  mapData: BattleMapData,
  targetX: number,
  targetY: number,
  occupied: Set<string>,
): BattleMapTile | null {
  let bestTile: BattleMapTile | null = null;
  let bestDist = Infinity;

  for (const tile of mapData.tiles.values()) {
    const key = `${tile.coordinates.x}-${tile.coordinates.y}`;
    if (tile.blocksMovement || occupied.has(key)) {
      continue;
    }
    const dist = Math.hypot(
      tile.coordinates.x - targetX,
      tile.coordinates.y - targetY,
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestTile = tile;
    }
  }
  return bestTile;
}

// ============================================================================
// Source-Derived Encounter Deployment
// ============================================================================
// WorldForge maps may carry an encounter frame tied to a real map fact. This
// selector translates that intent into legal current-map tiles. Road ambushes
// retain their traveling column and flanks; river crossings instead place each
// team on a different bank using the crossing's real route heading and span.
// ============================================================================

function getSourceEncounterSpawnTiles(
  mapData: BattleMapData,
  playerCount: number,
  enemyCount: number,
): { playerTiles: BattleMapTile[]; enemyTiles: BattleMapTile[] } | null {
  const context = mapData.encounterContext;
  if (!context) return null;

  const allWalkable = [...mapData.tiles.values()].filter(
    (tile) => !tile.blocksMovement,
  );
  const occupied = new Set<string>(
    (mapData.worldOccupants ?? []).map(
      (occupant) => `${occupant.position.x}-${occupant.position.y}`,
    ),
  );

  const nearestCandidate = (
    candidates: BattleMapTile[],
    target: { x: number; y: number },
    preferCover: boolean,
  ): BattleMapTile | null => {
    const available = candidates.filter((tile) => !occupied.has(tileKey(tile)));
    const ranked = available.sort((a, b) => {
      const aScore =
        pointDistance(a.coordinates, target) -
        (preferCover ? coverScore(mapData, a) * 0.8 : 0);
      const bScore =
        pointDistance(b.coordinates, target) -
        (preferCover ? coverScore(mapData, b) * 0.8 : 0);
      if (aScore !== bScore) return aScore - bScore;

      // Coordinate ordering makes equal geometric choices deterministic
      // without importing random arena behavior into a world scenario.
      return (
        a.coordinates.y - b.coordinates.y || a.coordinates.x - b.coordinates.x
      );
    });
    const selected = ranked[0] ?? null;
    if (selected) occupied.add(tileKey(selected));
    return selected;
  };

  if (context.kind === "opening-standoff") {
    // Gather the party around its exact live anchor, then consume the
    // opening receipt's entity tiles verbatim. Re-running a placement
    // heuristic here would silently replace source history with referee art.
    const partyOffsets = [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
      { x: 1, y: 1 },
    ];
    const playerTiles: BattleMapTile[] = [];
    for (let index = 0; index < playerCount; index++) {
      const offset = partyOffsets[index % partyOffsets.length]!;
      const ring = Math.floor(index / partyOffsets.length);
      const target = {
        x: context.anchorTile.x + offset.x * (1 + ring),
        y: context.anchorTile.y + offset.y * (1 + ring),
      };
      const selected = nearestCandidate(allWalkable, target, false);
      if (selected) playerTiles.push(selected);
    }

    // A resolved return uses the combat shell as an inspection surface,
    // but its saved bodies are map facts rendered outside initiative. Any
    // enemy combatant here would resurrect historical evidence as a fight.
    if (context.sceneContinuity === "resolved-return") {
      if (enemyCount !== 0) {
        throw new Error(
          `Resolved opening scene ${context.sourceSceneReceiptId} received ${enemyCount} active enemies.`,
        );
      }
      return { playerTiles, enemyTiles: [] };
    }

    if (context.sourceEntities.length !== enemyCount) {
      throw new Error(
        `Opening scene ${context.sourceSceneReceiptId} has ${context.sourceEntities.length} source entities for ${enemyCount} enemies.`,
      );
    }
    const enemyTiles = context.sourceEntities.map((entity) => {
      const tile = mapData.tiles.get(
        `${entity.position.x}-${entity.position.y}`,
      );
      if (!tile || tile.blocksMovement || occupied.has(tileKey(tile))) {
        throw new Error(
          `Opening source entity ${entity.entityId} has an invalid or occupied tactical tile.`,
        );
      }
      occupied.add(tileKey(tile));
      return tile;
    });

    return { playerTiles, enemyTiles };
  }

  const headingLength = Math.hypot(
    context.routeDirection.x,
    context.routeDirection.y,
  );
  if (headingLength <= 1e-9) return null;

  const heading = {
    x: context.routeDirection.x / headingLength,
    y: context.routeDirection.y / headingLength,
  };
  const flank = { x: -heading.y, y: heading.x };

  if (context.kind === "settlement-edge") {
    const signedDistance = (tile: BattleMapTile): number =>
      (tile.coordinates.x - context.anchorTile.x) * heading.x +
      (tile.coordinates.y - context.anchorTile.y) * heading.y;
    const outsideTiles = allWalkable.filter(
      (tile) => signedDistance(tile) <= -2,
    );
    const insideTiles = allWalkable.filter((tile) => signedDistance(tile) >= 2);

    const deploySide = (
      count: number,
      direction: -1 | 1,
      candidates: BattleMapTile[],
      preferCover: boolean,
    ): BattleMapTile[] => {
      const result: BattleMapTile[] = [];
      for (let index = 0; index < count; index++) {
        const row = Math.floor(index / 2);
        const side = index % 2 === 0 ? -1 : 1;
        const target = {
          x:
            context.anchorTile.x +
            heading.x * direction * (5 + row * 2) +
            flank.x * side * 1.75,
          y:
            context.anchorTile.y +
            heading.y * direction * (5 + row * 2) +
            flank.y * side * 1.75,
        };
        const selected =
          nearestCandidate(candidates, target, preferCover) ??
          nearestCandidate(allWalkable, target, preferCover);
        if (selected) result.push(selected);
      }
      return result;
    };

    return {
      playerTiles: deploySide(playerCount, -1, outsideTiles, false),
      enemyTiles: deploySide(enemyCount, 1, insideTiles, true),
    };
  }

  if (
    context.kind === "settlement-watch" ||
    context.kind === "settlement-state-patrol"
  ) {
    // The crop center is the player's exact live-world position. Keep the
    // lead party member on that anchor, gather companions immediately
    // behind them, and place the responding watch/patrol toward town.
    // This differs from the gate recipe above: an interior arrest must not
    // teleport the party to opposite sides of a boundary they never crossed.
    const deployParty = (): BattleMapTile[] => {
      const result: BattleMapTile[] = [];
      for (let index = 0; index < playerCount; index++) {
        const row = Math.ceil(index / 2);
        const side = index === 0 ? 0 : index % 2 === 0 ? 1 : -1;
        const target = {
          x:
            context.anchorTile.x - heading.x * row * 1.5 + flank.x * side * 1.5,
          y:
            context.anchorTile.y - heading.y * row * 1.5 + flank.y * side * 1.5,
        };
        const selected = nearestCandidate(allWalkable, target, false);
        if (selected) result.push(selected);
      }
      return result;
    };

    const deployInterceptors = (): BattleMapTile[] => {
      const result: BattleMapTile[] = [];
      for (let index = 0; index < enemyCount; index++) {
        const row = Math.floor(index / 2);
        const side = index % 2 === 0 ? -1 : 1;
        const target = {
          x:
            context.anchorTile.x +
            heading.x * (4 + row * 2) +
            flank.x * side * 1.75,
          y:
            context.anchorTile.y +
            heading.y * (4 + row * 2) +
            flank.y * side * 1.75,
        };
        const selected = nearestCandidate(allWalkable, target, true);
        if (selected) result.push(selected);
      }
      return result;
    };

    return {
      playerTiles: deployParty(),
      enemyTiles: deployInterceptors(),
    };
  }

  if (context.kind === "river-crossing") {
    const crossingTiles = allWalkable.filter(
      (tile) => tile.crossing?.sourceCrossingId === context.sourceCrossingId,
    );
    if (crossingTiles.length === 0) return null;

    // Region span includes the water and its authored bridge landings. The
    // extra three-cell clearance places tokens on usable bank terrain rather
    // than beginning combat on the narrow crossing itself.
    const crossingSpanMeters = crossingTiles[0].crossing?.spanMeters ?? 0;
    const halfSpanTiles = Math.max(2, crossingSpanMeters / 1.524 / 2);
    const signedDistance = (tile: BattleMapTile): number =>
      (tile.coordinates.x - context.anchorTile.x) * heading.x +
      (tile.coordinates.y - context.anchorTile.y) * heading.y;
    const nearBankTiles = allWalkable.filter(
      (tile) => !tile.crossing && signedDistance(tile) <= -halfSpanTiles,
    );
    const farBankTiles = allWalkable.filter(
      (tile) => !tile.crossing && signedDistance(tile) >= halfSpanTiles,
    );
    const roadSourceIndex = crossingTiles[0].crossing?.roadSourceIndex;
    const bankRouteTiles = (tiles: BattleMapTile[]) =>
      tiles.filter(
        (tile) =>
          tile.surface?.source === "worldforge-road" &&
          (roadSourceIndex == null ||
            tile.surface.sourceIndex === roadSourceIndex),
      );
    const nearRouteTiles = bankRouteTiles(nearBankTiles);
    const farRouteTiles = bankRouteTiles(farBankTiles);

    const deployBank = (
      count: number,
      direction: -1 | 1,
      bankTiles: BattleMapTile[],
      routeTiles: BattleMapTile[],
    ): BattleMapTile[] => {
      const result: BattleMapTile[] = [];
      for (let index = 0; index < count; index++) {
        const row = Math.floor(index / 2);
        const side = index % 2 === 0 ? -1 : 1;
        const target = {
          x:
            context.anchorTile.x +
            heading.x * direction * (halfSpanTiles + 3 + row * 2) +
            flank.x * side * 1.5,
          y:
            context.anchorTile.y +
            heading.y * direction * (halfSpanTiles + 3 + row * 2) +
            flank.y * side * 1.5,
        };
        const selected =
          nearestCandidate(routeTiles, target, false) ??
          nearestCandidate(bankTiles, target, direction === 1) ??
          nearestCandidate(allWalkable, target, direction === 1);
        if (selected) result.push(selected);
      }
      return result;
    };

    return {
      playerTiles: deployBank(playerCount, -1, nearBankTiles, nearRouteTiles),
      enemyTiles: deployBank(enemyCount, 1, farBankTiles, farRouteTiles),
    };
  }

  if (context.kind !== "road-ambush") return null;
  const routeTiles = allWalkable.filter(
    (tile) =>
      tile.surface?.source === "worldforge-road" &&
      tile.surface.sourceIndex === context.sourceRoadIndex,
  );
  const offRouteTiles = allWalkable.filter(
    (tile) => tile.surface?.source !== "worldforge-road",
  );

  const playerTiles: BattleMapTile[] = [];
  for (let index = 0; index < playerCount; index++) {
    // A two-cell cadence reads as a traveling column while leaving room for
    // medium creatures and later movement previews on a five-foot grid.
    const target = {
      x: context.anchorTile.x - heading.x * index * 2,
      y: context.anchorTile.y - heading.y * index * 2,
    };
    const selected =
      nearestCandidate(routeTiles, target, false) ??
      nearestCandidate(allWalkable, target, false);
    if (selected) playerTiles.push(selected);
  }

  const enemyTiles: BattleMapTile[] = [];
  const flankRows = Math.max(1, Math.ceil(enemyCount / 2));
  for (let index = 0; index < enemyCount; index++) {
    const side = index % 2 === 0 ? 1 : -1;
    const row = Math.floor(index / 2);
    const alongRoute = (row - (flankRows - 1) / 2) * 4;
    const flankDistance = 7 + (row % 2) * 1.5;
    const target = {
      x:
        context.anchorTile.x +
        heading.x * alongRoute +
        flank.x * flankDistance * side,
      y:
        context.anchorTile.y +
        heading.y * alongRoute +
        flank.y * flankDistance * side,
    };
    const selected =
      nearestCandidate(offRouteTiles, target, true) ??
      nearestCandidate(allWalkable, target, true);
    if (selected) enemyTiles.push(selected);
  }

  return { playerTiles, enemyTiles };
}

export interface BattleSetup {
  mapData: BattleMapData;
  positionedCharacters: CombatCharacter[];
}

type BattleSetupSource = "world-derived" | "procedural-sandbox";

/**
 * Positions one roster on an already-selected battlefield.
 *
 * Source-aware maps use their encounter receipt and exact world anchor. The
 * procedural sandbox deliberately retains its seeded arena formations, but it
 * reaches this helper only through the explicitly named sandbox export below.
 */
const positionBattleSetup = (
  mapData: BattleMapData,
  seed: number,
  initialCharacters: CombatCharacter[],
  source: BattleSetupSource,
): BattleSetup => {
  const rng = new SeededRandom(seed);

  const newPositions = new Map<string, CharacterPosition>();
  // Keep ambient residents reserved during the final character assignment as
  // well as during encounter-plan selection. This also protects the generic
  // nearest-walkable fallback if a source deployment zone is exhausted.
  const occupied = new Set<string>(
    (mapData.worldOccupants ?? []).map(
      (occupant) => `${occupant.position.x}-${occupant.position.y}`,
    ),
  );

  // The two sources have intentionally different deployment authorities:
  // WorldForge maps use source encounter facts; sandbox arenas use a seeded
  // generic formation because they have no source-world event to project.
  const spawnConfigs: SpawnConfig[] = [
    "left-right",
    "top-bottom",
    "corners-tl-br",
    "corners-tr-bl",
  ];
  const randomConfig =
    spawnConfigs[Math.floor(rng.next() * spawnConfigs.length)];
  const playerCount = initialCharacters.filter(
    (char) => char.team === "player",
  ).length;
  const enemyCount = initialCharacters.filter(
    (char) => char.team === "enemy",
  ).length;
  // Older extracted maps can be genuine WorldForge crops without a richer
  // encounter receipt. Empty planned lists deliberately fall through to the
  // generic center-relative placement below; only the terrain source is
  // mandatory, not every newer deployment annotation.
  const sourceTiles =
    source === "world-derived"
      ? getSourceEncounterSpawnTiles(mapData, playerCount, enemyCount)
      : null;
  const { playerTiles, enemyTiles } =
    source === "world-derived"
      ? (sourceTiles ?? { playerTiles: [], enemyTiles: [] })
      : getTacticalSpawnTiles(
          mapData,
          randomConfig,
          rng,
          playerCount,
          enemyCount,
        );

  let playerSpawnIndex = 0;
  let enemySpawnIndex = 0;

  const positionedCharacters = initialCharacters.map((char) => {
    let spawnTile: BattleMapTile | null = null;

    if (source === "world-derived") {
      if (char.team === "player" && playerSpawnIndex < playerTiles.length) {
        spawnTile = playerTiles[playerSpawnIndex++];
      } else if (char.team === "enemy" && enemySpawnIndex < enemyTiles.length) {
        spawnTile = enemyTiles[enemySpawnIndex++];
      } else {
        // Extracted maps center the originating world point at the map's
        // geometric center. This dimension-aware fallback preserves that
        // contract for ordinary fight-in-place maps without a formation.
        const centerX = Math.floor(mapData.dimensions.width / 2);
        const centerY = Math.floor(mapData.dimensions.height / 2);
        const targetX = char.team === "player" ? centerX : centerX + 4;
        const targetY = char.team === "player" ? centerY : centerY + 3;
        spawnTile = findNearestWalkableTile(
          mapData,
          targetX,
          targetY,
          occupied,
        );
      }
    } else {
      // Standard procedural mapping uses zone-based spawn configurations
      if (char.team === "player" && playerSpawnIndex < playerTiles.length) {
        spawnTile = playerTiles[playerSpawnIndex++];
      } else if (char.team === "enemy" && enemySpawnIndex < enemyTiles.length) {
        spawnTile = enemyTiles[enemySpawnIndex++];
      }
    }

    if (spawnTile) {
      const key = `${spawnTile.coordinates.x}-${spawnTile.coordinates.y}`;
      occupied.add(key);
      newPositions.set(char.id, {
        characterId: char.id,
        coordinates: spawnTile.coordinates,
      });
      return { ...char, position: spawnTile.coordinates };
    }
    return char;
  });

  return { mapData, positionedCharacters };
};

/**
 * Production setup contract: callers must provide the tactical projection of
 * a real WorldForge location. There is no optional map and no arena fallback.
 */
export const generateWorldBattleSetup = (
  mapData: BattleMapData,
  seed: number,
  initialCharacters: CombatCharacter[],
): BattleSetup =>
  positionBattleSetup(mapData, seed, initialCharacters, "world-derived");

/**
 * Explicit developer-only arena generator used by BattleMapDemo and QA deep
 * links. Keeping construction behind this name makes accidental production
 * fallback visible in code review and dependency searches.
 */
export const generateProceduralSandboxBattleSetup = (
  biome: BattleMapBiome,
  seed: number,
  initialCharacters: CombatCharacter[],
): BattleSetup => {
  const mapData = new BattleMapGenerator(
    BATTLE_MAP_DIMENSIONS.width,
    BATTLE_MAP_DIMENSIONS.height,
  ).generate(biome, seed);
  return positionBattleSetup(
    mapData,
    seed,
    initialCharacters,
    "procedural-sandbox",
  );
};
