/**
 * @file combat/map.ts
 * Battlefield objects, world provenance, terrain and the canonical biome list.
 *
 * Declarations moved unchanged from combat.ts. That file remains the public
 * compatibility entry; direct type imports here make ownership explicit.
 * Reciprocal type references are erased at runtime, not new state owners.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 28/10/2026, 09:01:33
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { MaterialType } from '../materials.js';
import type {DungeonCombatContext} from '../dungeonCombat';
import type { Position, LightLevel } from './primitives.js';
import type { StatusEffect, MapObjectInteractionState } from './effects.js';
import type { WorldforgeOpeningThreatSource, WorldforgeSurfaceHostileSource } from './actors.js';

// ============================================================================
// Combat Action Target Envelope
// ============================================================================
// Combat actions historically carried only creature IDs and one map position.
// Spell targeting now needs to preserve whether the chosen thing was a creature,
// a map object, or a ground point, so this envelope travels beside the legacy
// fields without replacing them.
// ============================================================================

/** Runtime object details preserved when a spell targets an object instead of a creature. */
export interface SelectedSpellObjectTarget {
  id: string;
  name?: string;
  position: Position;
  size?: string;
  weightPounds?: number;
  isWornOrCarried?: boolean;
  isMagical?: boolean;
  isFixedToSurface?: boolean;
  isCoveredByOpaqueMaterial?: boolean;
  /** Optional damage facts preserved for Mending-style repair spells. */
  damageState?: SelectedSpellObjectDamageState;
  /** Live combat interaction state for doors, containers, devices, and breakable objects. */
  interactionState?: MapObjectInteractionState;
}


/**
 * Optional damage facts preserved alongside a targetable object.
 *
 * Mending still consumes this spell-facing description. Ordinary attacks and
 * interaction actions use `MapObjectInteractionState` below, so repair details
 * remain separate from the object's finite combat durability.
 */
export interface SelectedSpellObjectDamageState {
  kind: "break_or_tear" | "broken" | "torn" | string;
  breakOrTearDimensionFeet?: number;
}


// ============================================================================
// Battle Map Object Provenance
// ============================================================================
// WorldForge objects keep the identity and world-meter anchor that produced
// their tactical target. This lets combat tools distinguish a real generated
// tree or prop from a sandbox obstacle without parsing display names or IDs.
// ============================================================================

export interface BattleMapObjectSource {
  /** Source layer that owns the object fact. */
  kind: "worldforge-feature" | "worldforge-prop" | "worldforge-monster-site";
  /** Stable identity within that source layer. */
  sourceId: string;
  /** Original feature kind or prop catalog definition id. */
  sourceKind: string;
  /** Ground-world position before the object was snapped to a five-foot cell. */
  worldMeters: { x: number; z: number };
}


/**
 * Positioned object candidate stored by the live battle map.
 * It deliberately matches the selected spell object envelope so map state,
 * target selection, and command context can pass the same object facts forward.
 */
export interface TargetableMapObject extends SelectedSpellObjectTarget {
  /** Map registries require a readable object name for targeting feedback. */
  name: string;
  /** Present when this tactical object was projected from a real world fact. */
  source?: BattleMapObjectSource;
}


/** First-class selected spell target reference used by combat action handoff. */
export type SelectedSpellTarget =
  | { kind: "creature"; id: string }
  | {
      kind: "object";
      id: string;
      position: Position;
      name?: string;
      object?: SelectedSpellObjectTarget;
    }
  | {
      kind: "point";
      position: Position;
      purpose?:
        "ground_target" | "area_origin" | "teleport_destination" | string;
    };


// Battle Map Types
export type BattleMapTerrain =
  "grass" | "rock" | "water" | "difficult" | "wall" | "floor" | "sand" | "mud";

export type BattleMapDecoration =
  | "tree"
  | "boulder"
  | "stalagmite"
  | "pillar"
  | "cactus"
  | "mangrove"
  | "fallen_log"
  | "stump"
  | "bush"
  // Authored tactical scenarios distinguish low cover from blocking walls.
  | "low_barrier"
  | "high_wall"
  | null;


/**
 * An authored/generated surface laid over a tile's underlying terrain.
 *
 * Roads are surfaces rather than terrain because the same route may cross
 * grass, sand, mud, or a future ford without erasing that base material. The
 * retained WorldForge run index and width let debug tools prove which source
 * fact produced the tactical cells instead of inferring provenance from paint.
 */
export type BattleMapSurface = {
  kind: "road";
  source: "worldforge-road";
  sourceRole: "regional-route" | "town-street" | "unclassified";
  sourceIndex: number;
  widthMeters: number;
};


/** Physical route-over-water fact layered over the tile's water terrain. */
export type BattleMapCrossing = {
  kind: "bridge" | "ford";
  source: "worldforge-crossing";
  sourceCrossingId: string;
  roadSourceIndex?: number;
  riverSourceIndex?: number;
  /** Unit route heading in referee x/y coordinates. */
  roadDirection: { x: number; y: number };
  /**
   * Unit river-flow heading in the same referee x/y frame as roadDirection.
   * Carries the Region crossing receipt's real downstream so tactical painters
   * put broken water / ripples on the true downstream side instead of guessing.
   * Optional only for older fixtures/saves that predate the field.
   */
  riverDirection?: { x: number; y: number };
  /** Exact source center retained for renderers and provenance inspectors. */
  centerWorldMeters: { x: number; z: number };
  spanMeters: number;
  widthMeters: number;
};


/** Schedule vocabulary retained when a source-world resident enters a tactical crop. */
export type BattleMapOccupantActivity =
  "sleeping" | "home" | "working" | "out" | "unknown";


/**
 * A named WorldForge resident visible on the tactical board without silently
 * promoting them to a player/enemy combatant. The source coordinates let
 * diagnostics compare their current world position with the snapped referee
 * cell, while `moving` records whether combat froze them during a commute.
 */
export interface BattleMapWorldOccupant {
  id: string;
  name: string;
  position: Position;
  activity: BattleMapOccupantActivity;
  moving: boolean;
  source: {
    kind: "worldforge-occupant";
    burgId: number;
    occupantId: number;
    worldMeters: { x: number; z: number };
  };
}


/** One source military unit represented by zero or more tactical actors. */
export interface BattleMapDefenderProjectionUnit {
  sourceUnitType: string;
  sourceTroops: number;
  tacticalActors: number;
  bestiaryName: string;
  roleLabel: string;
}


/** A source military unit intentionally omitted by the current encounter policy. */
export interface BattleMapExcludedDefenderUnit {
  sourceUnitType: string;
  sourceTroops: number;
  reason: "not-gate-patrol-role" | "missing-bestiary-bridge";
}


/** The explicit scene event asking a generated settlement force to confront the party. */
export type BattleMapSettlementHostilityTrigger =
  | {
      kind: "none";
      source: "none";
      summary: string;
    }
  | {
      kind: "watch-confrontation";
      source: "player-interaction" | "quest" | "world-event" | "visual-harness";
      sourceId: string;
      locationId: string;
      summary: string;
    }
  | {
      kind: "state-confrontation";
      source: "player-interaction" | "quest" | "world-event" | "visual-harness";
      sourceId: string;
      factionId: string;
      summary: string;
    };


/** Matching player-state evidence that can authorize the confrontation. */
export type BattleMapSettlementHostilityRelation =
  | {
      kind: "none";
      source: "none";
      detail: string;
    }
  | {
      kind: "wanted-in-location";
      source: "player-crime-state";
      locationId: string;
      witnessedCrimeIds: string[];
    }
  | {
      kind: "state-standing";
      source: "player-faction-standing";
      factionId: string;
      publicStanding: number;
      tier:
        | "NEMESIS"
        | "HOSTILE"
        | "UNFRIENDLY"
        | "NEUTRAL"
        | "FRIENDLY"
        | "HONORED"
        | "REVERED";
      hostileThreshold: number;
      qualifiesAsHostile: boolean;
    };


/**
 * Auditable decision that gates whether source defenders become enemy actors.
 *
 * `withhold-combat` is deliberately not called friendly: it means the current
 * evidence does not authorize the tactical layer to invent hostility.
 */
export interface BattleMapSettlementHostility {
  rule: "explicit-trigger-plus-matching-relation-v1";
  verdict: "hostile" | "withhold-combat";
  trigger: BattleMapSettlementHostilityTrigger;
  relation: BattleMapSettlementHostilityRelation;
  detail: string;
}


/**
 * Transparent regiment-to-encounter projection attached to a settlement map.
 *
 * WorldForge proves the state and regiment. The projection policy proves how a
 * small tactical patrol was sampled, while the hostility receipt independently
 * proves whether those representatives may enter the enemy team.
 */
export interface BattleMapDefendingForce {
  source: {
    kind: "worldforge-state-regiment";
    burgId: number;
    burgName: string;
    stateId: number;
    stateName: string;
    stateFullName: string;
    stateForm: string;
    stateAlert: number;
    regimentIndex: number;
    regimentName: string;
    regimentTroops: number;
    sourceCellId: number;
  };
  projection: {
    kind: "gate-patrol-alert-sample-v1";
    /** Rounded state alert, clamped to a readable 2-6 actor encounter. */
    tacticalActorBudget: number;
    tacticalActors: number;
    units: BattleMapDefenderProjectionUnit[];
    excludedUnits: BattleMapExcludedDefenderUnit[];
    /** Military presence alone never authorizes enemy combatants. */
    hostility: BattleMapSettlementHostility;
  };
}


/** Evidence left in the opening scene before initiative begins. */
export interface BattleMapOpeningEcologicalTrace {
  id: string;
  kind: "tracks" | "disturbed-vegetation" | "scent-mark" | "territorial-scrape";
  /** Relative freshness authored with the scene, without inventing a timestamp. */
  ageBand?: "fresh" | "recent" | "weathered";
  label: string;
  position: { x: number; y: number };
  worldGroundMeters: { x: number; z: number };
  sourceEntityIds: string[];
}


/**
 * Ground deformation left by monsters occupying one WorldForge location.
 *
 * Unlike tactical highlights, these are saved world facts. Start and end
 * anchors let both the 2D and 3D renderers draw the same flattened hollow,
 * traffic lane, dragged load, or refuse scatter without inventing placement.
 */
export interface BattleMapOpeningTerrainImprint {
  id: string;
  kind: "flattened-ground" | "trampled-run" | "drag-furrow" | "refuse-scatter";
  label: string;
  position: { x: number; y: number };
  endPosition: { x: number; y: number };
  worldGroundMeters: { x: number; z: number };
  endWorldGroundMeters: { x: number; z: number };
  direction: { x: number; y: number };
  extentCells: { length: number; width: number };
  ageBand: "fresh" | "recent";
  sourceEntityIds: string[];
  activitySiteId: string;
}


/** Physical monster activity that remains at this source location across visits. */
export interface BattleMapOpeningActivitySite {
  id: string;
  kind: "claimed-cache" | "feeding-site" | "resting-hollow";
  label: string;
  position: { x: number; y: number };
  worldGroundMeters: { x: number; z: number };
  ageBand: "fresh" | "recent";
  claimedByEntityIds: string[];
  contents: Array<
    | "salvaged-container"
    | "torn-bedding"
    | "gnawed-remains"
    | "flattened-ground"
  >;
}


/** What became of one exact WorldForge creature when the battle ended. */
export type BattleMapOpeningEntityOutcomeStatus =
  "downed" | "withdrew" | "holding-ground";


/**
 * Save-backed combat result for one opening-scene creature.
 *
 * `lastSeenWorldGroundMeters` is derived from the final referee cell rather
 * than guessed by a return renderer. A withdrawal therefore means "left this
 * scene after last being seen here", while a downed creature leaves a physical
 * body at the stored location.
 */
export interface BattleMapOpeningEntityOutcome {
  sourceEntityId: string;
  combatantId: string;
  status: BattleMapOpeningEntityOutcomeStatus;
  finalHitPoints: number;
  finalTacticalPosition: { x: number; y: number };
  lastSeenWorldGroundMeters: { x: number; z: number };
}


/** Physical churn authored from the final positions of the combat participants. */
export interface BattleMapOpeningCombatDisturbance {
  kind: "combat-churn";
  position: { x: number; y: number };
  worldGroundMeters: { x: number; z: number };
  direction: { x: number; y: number };
  extentCells: { length: number; width: number };
  severity: "scattered" | "heavy";
  sourceEntityIds: string[];
}


/**
 * Durable resolution of an opening scene.
 *
 * A resolved receipt is historical evidence, not permission to launch the
 * same combat again. Production projection refuses it; the World Battle Lab
 * may explicitly request a return-site projection to inspect the aftermath.
 */
export interface BattleMapOpeningSceneResolution {
  outcome: "party-victory" | "party-defeat";
  resolvedAtGameTimeMs: number;
  entityOutcomes: BattleMapOpeningEntityOutcome[];
  activitySiteCondition: "abandoned-disturbed" | "held-disturbed";
  combatDisturbance: BattleMapOpeningCombatDisturbance;
}


/** Exact tactical/world position of one source-authored opening creature. */
export interface BattleMapOpeningThreatEntity extends WorldforgeOpeningThreatSource {
  position: { x: number; y: number };
}


/**
 * Source-backed tactical framing for an encounter projected onto this map.
 *
 * Most contexts state intent and lineage while combat chooses legal final
 * coordinates. Opening threat scenes are stricter: their persisted WorldForge
 * entity receipt carries exact source positions which combat must consume.
 */
export type BattleMapEncounterContext =
  | {
      kind: "surface-contact";
      source: "worldforge-surface-hostiles";
      sourceScope: string;
      sourceReceiptId: string;
      sourceWorldCellId: number;
      anchorTile: { x: number; y: number };
      partySources: Array<{ characterId: string; position: { x: number; y: number }; worldGroundMeters: { x: number; z: number }; groundYM?: number }>;
      sourceEntities: Array<{ combatantId: string; source: WorldforgeSurfaceHostileSource }>;
    }
  | {
      kind: "opening-standoff";
      source: "worldforge-opening";
      /** Stable receipt copied from the game-authored opening location. */
      sourceReceiptId: string;
      /** Frozen WorldForge entity scene accepted into save-backed history. */
      sourceSceneReceiptId: string;
      /** Whether this map authored the scene now or replayed its saved world facts. */
      sceneContinuity?: "authored" | "saved-replay" | "resolved-return";
      /** Canonical atlas cell validated against tactical provenance. */
      sourceWorldCellId: number;
      /** Walkable tactical cell nearest the exact live player position. */
      anchorTile: { x: number; y: number };
      /** Direction the authored threat group faces as it closes on the party. */
      approachDirection: { x: number; y: number };
      /** Exact source entities in the same order as the opening threat roster. */
      sourceEntities: BattleMapOpeningThreatEntity[];
      /** Source-authored signs that make the encounter legible before the body. */
      ecologicalTraces: BattleMapOpeningEcologicalTrace[];
      /**
       * Persistent ground deformation connecting the activity site to creature
       * behavior. Old combat snapshots can omit it; current scenes require it.
       */
      terrainImprints?: BattleMapOpeningTerrainImprint[];
      /**
       * Persisted physical activity site. Legacy v1 combat snapshots can omit
       * this, while every current v2 WorldForge projection must provide it.
       */
      activitySite?: BattleMapOpeningActivitySite;
      /** Combat-authored aftermath. Its presence means this is a return view, not a live standoff. */
      sceneResolution?: BattleMapOpeningSceneResolution;
      deployment: {
        player: "current-position";
        enemy: "source-world-entities" | "resolved-source-bodies";
      };
      /**
       * The v1 contact scene authors current positions and approach evidence,
       * but does not invent the threat's earlier travel history.
       */
      omittedFacts: {
        preContactHistory: "not-authored";
      };
    }
  | {
      kind: "road-ambush";
      source: "worldforge-road";
      sourceRoadRole: BattleMapSurface["sourceRole"];
      sourceRoadIndex: number;
      /** Referee cell corresponding to the selected source-world encounter point. */
      anchorTile: { x: number; y: number };
      /** Normalized route heading in referee x/y coordinates. */
      routeDirection: { x: number; y: number };
      deployment: {
        player: "traveling-column";
        enemy: "concealed-flanks";
      };
    }
  | {
      kind: "river-crossing";
      source: "worldforge-crossing";
      sourceCrossingId: string;
      crossingKind: BattleMapCrossing["kind"];
      anchorTile: { x: number; y: number };
      routeDirection: { x: number; y: number };
      deployment: {
        player: "near-bank";
        enemy: "far-bank";
      };
    }
  | {
      kind: "settlement-edge";
      source: "worldforge-settlement";
      sourceBurgId: number;
      sourceGatehouseId: string;
      anchorTile: { x: number; y: number };
      /** Normalized heading from the gate exterior toward the town interior. */
      routeDirection: { x: number; y: number };
      deployment: {
        player: "outside-approach";
        enemy: "inside-gate";
      };
      /** Present only when a real stationed regiment can supply this encounter. */
      defendingForce?: BattleMapDefendingForce;
    }
  | {
      kind: "settlement-watch";
      source: "worldforge-settlement";
      sourceBurgId: number;
      /** The live interaction or world event that caused the watch to intervene. */
      sourceConfrontationId: string;
      /** Referee cell corresponding to the party's exact world position at combat start. */
      anchorTile: { x: number; y: number };
      /** Normalized heading from the party toward the settlement's responding force. */
      routeDirection: { x: number; y: number };
      deployment: {
        player: "current-position";
        enemy: "watch-interception";
      };
      /** Present only when a real stationed regiment can supply this encounter. */
      defendingForce?: BattleMapDefendingForce;
    }
  | {
      kind: "settlement-state-patrol";
      source: "worldforge-settlement";
      sourceBurgId: number;
      /** Generated-state faction whose standing authorized this interception. */
      sourceFactionId: string;
      /** The deterministic world event that caused the patrol to intervene. */
      sourceConfrontationId: string;
      /** Referee cell corresponding to the party's exact world position at combat start. */
      anchorTile: { x: number; y: number };
      /** Normalized heading from the party toward the settlement's responding force. */
      routeDirection: { x: number; y: number };
      deployment: {
        player: "current-position";
        enemy: "state-patrol-interception";
      };
      /** Present only when a real stationed regiment can supply this encounter. */
      defendingForce?: BattleMapDefendingForce;
    };


export interface EnvironmentalEffect {
  id: string;
  type:
    "fire" | "ice" | "poison" | "difficult_terrain" | "web" | "fog" | "hazard";
  duration: number;
  effect: StatusEffect;
  sourceSpellId?: string;
  casterId?: string;
}


export interface BattleMapTile {
  id: string; // "x-y"
  coordinates: { x: number; y: number };
  terrain: BattleMapTerrain;
  elevation: number;
  movementCost: number;
  blocksLoS: boolean;
  blocksMovement: boolean;
  decoration: BattleMapDecoration;
  /** Optional source-backed surface treatment layered over base terrain. */
  surface?: BattleMapSurface;
  /** Optional source-authored bridge/ford relation over base water. */
  crossing?: BattleMapCrossing;
  effects: string[]; // IDs of active effects
  providesCover?: boolean;
  environmentalEffects?: EnvironmentalEffect[];
  /**
   * Legacy single environmental effect still written/read by terrain and
   * concentration commands. Coexists with the canonical `environmentalEffects`
   * array until those call sites migrate to the array form.
   */
  environmentalEffect?: EnvironmentalEffect;
  material?: MaterialType;
  thicknessInches?: number;
  /**
   * Optional authored limits for the volume above this tactical square.
   *
   * Ground elevation still describes the surface and the top of ordinary
   * blockers. These facts cover enclosed ceilings and exceptional obstacles
   * that block flight above the surface without changing walking behavior.
   */
  airspace?: {
    /** Lowest ceiling over this square, measured from the map's local zero. */
    ceilingFeet?: number;
    /** Highest solid obstruction in the square when it differs from elevation. */
    blockerTopFeet?: number;
    /** Closes the whole vertical column, such as a sealed wall or force plane. */
    blocksFlight?: boolean;
  };
}


/**
 * Every biome the battle-map generator can roll. ONE list — the generator,
 * the painter, the biome pill, and the dev override all derive from it.
 */
export const BATTLE_MAP_BIOMES = [
  "forest",
  "cave",
  "dungeon",
  "desert",
  "swamp",
  "snow",
  "jungle",
  "coast",
  "ruins",
  "volcanic",
] as const;

export type BattleMapBiome = (typeof BATTLE_MAP_BIOMES)[number];


// ============================================================================
// Battle Map Provenance
// ============================================================================
// A tactical board can now be an extracted view of an actual WorldForge
// location. Keeping that origin on the map lets renderers and debugging tools
// distinguish source-world facts from the older context-free arena generator.
// The field is optional so old saves, tests, and sandbox maps remain valid.
// ============================================================================

export interface BattleMapWorldforgeProvenance {
  /** WorldForge is authoritative for terrain and placed objects on this map. */
  kind: "worldforge";
  /** Seed of the generated world the encounter belongs to. */
  worldSeed: number;
  /** Exact atlas cell used to build Region -> Local -> Ground, when resolved. */
  anchorCellId?: number;
  /** Stable harness or encounter recipe that selected the location. */
  scenarioId?: string;
  /** Player-facing place or scenario label when one is known. */
  locationLabel?: string;
  /** World-meter point that became the center tile of the tactical crop. */
  anchorWorldMeters: { x: number; z: number };
  /** Human-readable lineage for debug surfaces and future save inspection. */
  generationPath: readonly string[];
}


/**
 * The world ground a tactical patch was cut from (GG-533, 2026-10-29). Tile
 * (x, y) stands at anchorWorldMeters + (tile - floor(dimensions / 2)) times
 * 1.524 m, the mapping `extractLocalTerrainPatch` sampled the tiles with.
 */
export interface BattleMapWorldGround {
  /** The local artifact whose ground record the patch shows (`groundRecord.ts`). */
  artifactSeedPath: string;
  /** Ground meters of the patch's center tile. */
  anchorWorldMeters: { x: number; z: number };
}

export interface BattleMapData {
  /** Exact generated floor, actors and return checkpoint for a dungeon encounter. */
  dungeonEncounter?: DungeonCombatContext;
  dimensions: { width: number; height: number };
  tiles: Map<string, BattleMapTile>;
  /**
   * Explicit positioned objects that spells may target.
   * Visual decorations remain separate because they do not prove object weight,
   * magical status, worn/carried status, or fixed-to-surface rules.
   */
  targetableObjects?: TargetableMapObject[];
  /** Named ambient residents projected from the same GroundWorld and clock. */
  worldOccupants?: BattleMapWorldOccupant[];
  theme: BattleMapBiome;
  seed: number;
  /**
   * Base light level of the whole board before light sources and magical
   * darkness apply (agora-a46a.3). When absent, visibility infers it from the
   * theme (cave/dungeon -> darkness, else bright) as it did before the field.
   */
  ambientLight?: Exclude<LightLevel, 'magical_darkness'>;
  /**
   * Present when this board was projected from a real game-world location.
   * Renderers must not invent unrelated set dressing on these maps: anything
   * object-like should be traceable to the source world or a later world delta.
   */
  provenance?: BattleMapWorldforgeProvenance;
  /** Optional source-backed formation that the combat setup must realize. */
  encounterContext?: BattleMapEncounterContext;
  /**
   * Present when this patch was cut from a world ground that knows its local
   * artifact (`extractLocalTerrainPatch`). A spell that moves earth here cuts
   * the same change into that ground and saves it (`spellGroundEdits.ts`).
   */
  worldGround?: BattleMapWorldGround;
}
