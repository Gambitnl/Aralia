/**
 * @file elevationPresentation.ts
 * Converts encoded battle-map relief into player-readable tactical language.
 *
 * WorldForge terrain arrives as real metres divided by the shared 0.3-metre
 * encoding constant. Raw values such as 47.95 are useful to a renderer but not
 * to a player, so this module owns rounded feet, relative labels, and contour
 * bands without changing the underlying terrain or combat mechanics.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/10/2026, 10:31:41
 * Dependents: components/BattleMap/BattleMapHUD.tsx, components/BattleMap/BattleMapTile.tsx, components/BattleMap/characters/characterActor/CharacterActor.tsx, components/BattleMap/groundPainter/paintPipeline.ts, components/BattleMap/hooks/useBattleMapDerivedState.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  BATTLE_MAP_CONTOUR_INTERVAL_FEET,
} from "../../config/mapConfig";
import type {
  BattleMapCrossing,
  BattleMapSurface,
  BattleMapTerrain,
} from "../../types/combat";

// C11 (agora-9ed9.11): the feet conversion moved to utils/combat/elevationUnits
// so combat utils can use it without importing a component module. It stays
// exported from here for the existing UI callers.
import { elevationUnitsToFeet } from "../../utils/combat/elevationUnits";
import { getBattleMapTileAltitudeFeet } from "../../utils/spatial/elevationGeometry";

export { elevationUnitsToFeet } from "../../utils/combat/elevationUnits";

export type ElevationRelation = "higher" | "lower" | "level";

export interface BattleMapElevationPresentation {
  /** Rounded height above the lowest sampled ground tile on this battle map. */
  localReliefFeet: number;
  /** The comparison creature's height on the same map-floor scale. */
  referenceLocalReliefFeet: number | null;
  /** Signed rounded difference from the active or selected combatant. */
  relativeFeet: number | null;
  relation: ElevationRelation | "unreferenced";
  badgeText: string;
  relativeText: string | null;
  primaryText: string;
  secondaryText: string;
}

/** Return the five-foot contour band containing an encoded elevation value. */
export function elevationContourBand(elevation: number): number {
  return Math.floor(
    elevationUnitsToFeet(elevation) / BATTLE_MAP_CONTOUR_INTERVAL_FEET,
  );
}

/**
 * Find the lowest finite ground sample in one tactical crop.
 *
 * WorldForge height values retain their wider-world offset, so the smallest
 * tile is not normally zero. Player-facing map height subtracts this baseline
 * before converting to feet; otherwise a river crop can claim every tile is
 * dozens of feet above an undefined "local low point."
 */
export function findBattleMapElevationBaseline(
  tiles: Iterable<{ elevation: number }>,
): number {
  let lowestElevation = Number.POSITIVE_INFINITY;
  for (const tile of tiles) {
    if (Number.isFinite(tile.elevation)) {
      lowestElevation = Math.min(lowestElevation, tile.elevation);
    }
  }
  return Number.isFinite(lowestElevation) ? lowestElevation : 0;
}

/**
 * Describe one tile relative to a creature when a reference elevation exists.
 * Rounding to whole feet avoids counterfeit precision from interpolated source
 * terrain while retaining differences that are useful at tactical scale.
 */
export function describeBattleMapElevation(
  elevation: number,
  referenceElevation?: number | null,
  referenceLabel = "active creature",
  mapBaselineElevation = 0,
): BattleMapElevationPresentation {
  // Round source altitudes on the combat ruler before subtracting the map floor.
  // Rounding after that subtraction can label a one-foot range difference Level.
  // The same rounded floor keeps both displayed heights and their delta consistent.
  const safeBaseline = Number.isFinite(mapBaselineElevation)
    ? mapBaselineElevation
    : 0;
  const baselineFeet = getBattleMapTileAltitudeFeet({ elevation: safeBaseline });
  const localReliefFeet = Math.max(
    0,
    getBattleMapTileAltitudeFeet({ elevation }) - baselineFeet,
  );
  if (referenceElevation == null || !Number.isFinite(referenceElevation)) {
    return {
      localReliefFeet,
      referenceLocalReliefFeet: null,
      relativeFeet: null,
      relation: "unreferenced",
      badgeText: `${localReliefFeet} ft`,
      relativeText: null,
      primaryText: `${localReliefFeet} ft above this map's lowest ground`,
      secondaryText: "Lowest ground on this map = 0 ft",
    };
  }

  // Put the creature and tile on one shared ruler. The hover readout presents
  // these two absolute map-local heights beside the zero-foot map floor so the
  // player never has to reverse-engineer the relative difference.
  const referenceLocalReliefFeet = Math.max(
    0,
    getBattleMapTileAltitudeFeet({ elevation: referenceElevation }) - baselineFeet,
  );
  // Derive the comparison from the two displayed whole-foot values. Rounding
  // each raw sample independently and then displaying a separately rounded
  // delta can disagree by one foot, which would make the visible ladder fail
  // its own arithmetic even though the source measurements are consistent.
  const relativeFeet = localReliefFeet - referenceLocalReliefFeet;
  if (relativeFeet === 0) {
    return {
      localReliefFeet,
      referenceLocalReliefFeet,
      relativeFeet,
      relation: "level",
      badgeText: "= 0 ft",
      relativeText: "same height",
      primaryText: `Level with ${referenceLabel}`,
      secondaryText: `${localReliefFeet} ft above this map's lowest ground (0 ft)`,
    };
  }

  const relation = relativeFeet > 0 ? "higher" : "lower";
  const magnitude = Math.abs(relativeFeet);
  return {
    localReliefFeet,
    referenceLocalReliefFeet,
    relativeFeet,
    relation,
    badgeText: `${relativeFeet > 0 ? "\u2191" : "\u2193"} ${magnitude} ft`,
    relativeText: `${magnitude} ft ${relativeFeet > 0 ? "higher" : "lower"}`,
    primaryText: `${magnitude} ft ${relativeFeet > 0 ? "higher" : "lower"} than ${referenceLabel}`,
    secondaryText: `${localReliefFeet} ft above this map's lowest ground (0 ft)`,
  };
}

/**
 * The physical tile facts that decide the inspector's terrain wording. A full
 * BattleMapTile satisfies this shape; tests can pass just the deciding fields.
 */
export interface BattleMapTerrainFacts {
  terrain: BattleMapTerrain;
  surface?: Pick<BattleMapSurface, "kind"> | null;
  crossing?: Pick<BattleMapCrossing, "kind"> | null;
}

/**
 * Name a tile's ground in plain language for the tile inspector.
 *
 * Physical facts outrank the base terrain word: a bridge or ford is the most
 * useful thing to say about a water tile, and a road matters more than the
 * ground it was worn into. Special terrains carry a short movement qualifier
 * so the player learns the rule with the name.
 */
export function describeBattleMapTerrain(tile: BattleMapTerrainFacts): string {
  if (tile.crossing) {
    return tile.crossing.kind === "ford"
      ? "Water \u2014 ford crossing (passable, slow)"
      : "Water \u2014 bridge deck (passable)";
  }
  if (tile.surface?.kind === "road") {
    return `Road (${tile.terrain} under a worn route)`;
  }
  switch (tile.terrain) {
    case "water":
      return "Water (impassable)";
    case "difficult":
      return "Difficult ground (slow going)";
    case "wall":
      return "Wall (blocks movement and sight)";
    case "grass":
      return "Grass";
    case "rock":
      return "Rock";
    case "floor":
      return "Floor";
    case "sand":
      return "Sand";
    case "mud":
      return "Mud";
  }
}
