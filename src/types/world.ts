// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 09/09/2026, 10:30:30
 * Dependents: components/CharacterSheet/Family/FamilyTreeTab.tsx, components/World3D/DebugHUD.tsx, components/World3D/InWorldHUD.tsx, hooks/actions/handleEncounter.ts, hooks/actions/handleMerchantInteraction.ts, hooks/actions/handleNpcInteraction.ts, services/strongholdService.ts, state/migrations/npcMemoryMigration.ts, state/migrations/worldDataMigration.ts, systems/entities3d/recipeFromCharacter.ts, systems/gameEntry/deEscalationToCombat.ts, systems/gameEntry/situationNpcToRichNpc.ts, systems/intrigue/RumorMillSystem.ts, systems/memory/actionMemoryMatrix.ts, systems/memory/factPropagation.ts, systems/npc/backgroundBrief.ts, systems/party/authoredCompanionToRichNpc.ts, systems/party/npcToPartyMember.ts, systems/party/recruitConsent.ts, systems/planar/PlanarService.ts, systems/social/npcEmotionalMemory.ts, systems/social/npcWitnessMemory.ts, systems/spells/ai/AISpellArbitrator.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/townsim/npcsForCell.ts, systems/worldforge/townsim/registerBurgMerchants.ts, types/index.ts, types/memory.ts, utils/world/chronicleNewsToRumors.ts, utils/world/dungeonRumorsToWorldRumors.ts, utils/world/memoryUtils.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { NPCVisualSpec } from './visuals.js';
import type { NPCKnowledgeProfile, SpeechProfile } from './dialogue.js';
import type { Position as CombatPosition } from './combat.js';
import type { Interaction } from './memory.js'; // Rich interaction records for the merged NPC memory lane.
import type { AbilityScores } from './character.js';
import type { EquipmentSlotType, Item } from './items.js';
import type { WorldData } from '../services/worldSim/types';
import type { Lock, Puzzle } from '../systems/puzzles/types.js';
// 2026-09-09 consolidation (sweep follow-up to board tasks agora-fe77, agora-9712, agora-171b):
// three NPC tasks shipped optional memory/biography extensions as intersection types because
// this file was lock-held all day. The fields now live on the canonical interfaces; the
// intersection names remain as aliases so no caller changes. Type-only imports keep the
// runtime graph acyclic.
import type { EmotionalMarker } from '../systems/social/npcEmotionalMemory';
import type { WitnessedAct } from '../systems/social/npcWitnessMemory';
import type { BackgroundBrief } from '../systems/npc/backgroundBrief';
// 2026-09-09 (agora-d9e1): NPC personality follows the same type-only-import
// pattern as the three lines above. `personality` is optional and additive.
import type { NPCPersonality } from '../systems/npcPersonality/types';


export type Position = CombatPosition;

// -----------------------------------------------------------------------------
// World and NPC types
// -----------------------------------------------------------------------------

export interface FamilyMember {
  id: string;
  name: string;
  relation: 'parent' | 'spouse' | 'child' | 'sibling' | 'grandparent' | 'grandchild';
  age: number;
  isAlive: boolean;
  occupation?: string;
}

/**
 * Extended NPC interface that includes detailed biographical and mechanical data.
 * Used by the generator to provide a complete character profile.
 */
export interface RichNPC extends NPC {
  biography: {
    age: number;
    backgroundId: string;
    classId: string;
    level: number;
    family: FamilyMember[];
    abilityScores: AbilityScores;
    /** Deterministic mini-backstory (agora-171b). Optional: authored/legacy NPCs may lack one. */
    background?: BackgroundBrief;
  }
  stats: {
    hp: number;
    maxHp: number;
    armorClass: number;
    speed: number;
    initiativeBonus: number;
    passivePerception: number;
    proficiencyBonus: number;
  }
  equippedItems: Partial<Record<EquipmentSlotType, Item>>;
}

export interface LocationDynamicNpcConfig {
  possibleNpcIds: string[];
  maxSpawnCount: number;
  baseSpawnChance: number;
}

export interface InteractableFeature {
  id: string;
  type: 'lock';
  label: string;
  lock: Lock;
}

export interface InteractablePuzzleFeature {
  id: string;
  type: 'puzzle';
  label: string;
  puzzle: Puzzle;
}

export interface Exit {
  direction: string;
  targetId: string;
  travelTime?: number;
  description?: string;
  isHidden?: boolean;
}

export interface Location {
  id: string;
  name: string;
  baseDescription: string;
  exits: { [direction: string]: string | Exit }; // Allow both string (legacy) and Exit object
  itemIds?: string[];
  npcIds?: string[];
  dynamicNpcConfig?: LocationDynamicNpcConfig;
  interactableFeatures?: Array<InteractableFeature | InteractablePuzzleFeature>;
  biomeId: string;
  gossipLinks?: string[];
  planeId?: string; // Optional, defaults to 'material'
  regionId?: string; // Links to REGIONAL_ECONOMIES
}

export interface TTSVoiceOption {
  name: string;
  characteristic: string;
}

export enum SuspicionLevel {
  Unaware,
  Suspicious,
  Alert,
}

export enum GoalStatus {
  Unknown = 'Unknown',
  Active = 'Active',
  Completed = 'Completed',
  Failed = 'Failed',
}

export interface Goal {
  id: string;
  description: string;
  status: GoalStatus;
}

export interface GoalUpdatePayload {
  npcId: string;
  goalId: string;
  newStatus: GoalStatus;
}

export interface KnownFact {
  id: string;
  text: string;
  /**
   * Provenance of the fact. 'direct'/'gossip' are the original live-lane values;
   * 'witnessed'/'told_by_player'/'inference' were merged in from the retired richer model.
   */
  source: 'direct' | 'gossip' | 'witnessed' | 'told_by_player' | 'inference';
  sourceNpcId?: string;
  isPublic: boolean;
  timestamp: number;
  strength: number;
  lifespan: number;
  sourceDiscoveryId?: string;
  /**
   * Semantic key for reliable "does this NPC know X" queries (e.g. 'player_is_ritual_casting').
   * The key contribution of the memory merge. Optional so existing writers stay unaffected.
   */
  factKey?: string;
  /** How confident the NPC is in this fact (0.0 - 1.0). Optional; backfilled from `strength` on load. */
  confidence?: number;
  /** Importance score (0 - 10) governing retention/priority. Optional; backfilled from `strength` on load. */
  significance?: number;
}

export interface WorldRumor {
  id: string;
  text: string;
  sourceFactionId?: string;
  targetFactionId?: string;
  type: 'skirmish' | 'market' | 'event' | 'misc';
  timestamp: number; // Game day timestamp
  expiration: number; // Game day timestamp when rumor fades
  region?: string; // Optional region restriction

  // New properties for propagation
  locationId?: string; // The specific location where this rumor instance is active
  spreadDistance?: number; // How far this rumor has traveled (0 = origin)
  virality?: number; // 0.0 - 1.0, chance to spread to adjacent locations
}

export interface DiscoveryResidue {
  text: string;
  discoveryDc: number;
  discovererNpcId: string;
}

export interface NpcMemory {
  disposition: number;
  knownFacts: KnownFact[];
  /** Grudge/bond markers with per-marker decay (agora-fe77). Optional; absent on legacy saves. */
  emotionalMarkers?: EmotionalMarker[];
  /** First- and second-hand observations of the player's acts (agora-9712). Optional. */
  witnessedActs?: WitnessedAct[];
  suspicion: SuspicionLevel;
  goals: Goal[];
  /** Optional lightweight fact list used by AI helpers (distinct from structured KnownFacts). */
  facts?: string[];
  lastInteractionTimestamp?: number;
  /** Chronological rich interaction records merged in from the retired richer memory model. */
  interactions?: Interaction[];
  /** Overall attitude toward the player, -100 (hostile) .. 100 (devoted). Optional; defaults to 0. */
  attitude?: number;
  /** Topics already discussed, keyed by topic id -> game-day timestamp, to avoid repetition. */
  discussedTopics?: Record<string, number>;
  lastInteractionDate?: string | number | Date | null;
}

/**
 * Historically a union of the two forked memory shapes. After the memory merge there is a single
 * canonical shape (`NpcMemory`); the alias is retained so existing importers keep resolving.
 */
export type ConsolidatedNpcMemory = NpcMemory;

export interface GossipUpdatePayload {
  [npcId: string]: {
    newFacts: KnownFact[];
    dispositionNudge: number;
  };
}

export interface NPC {
  id: string;
  name: string;
  baseDescription: string;
  initialPersonalityPrompt: string;
  role: 'merchant' | 'quest_giver' | 'guard' | 'civilian' | 'unique';
  faction?: string;
  dialoguePromptSeed?: string;
  voice?: TTSVoiceOption;
  /**
   * Per-NPC speech fingerprint (agora-9e0f). Optional and additive: when absent,
   * dialogue post-processing is a no-op and the NPC behaves exactly as before.
   * Distinct from `voice`, which selects a TTS timbre rather than word choice.
   */
  speechProfile?: SpeechProfile;
  /**
   * Stable disposition: archetype, five-factor traits and 2-3 behavioral quirks
   * (agora-d9e1). Optional and additive — every consumer in
   * `systems/npcPersonality/personalityEffects.ts` returns its neutral value when
   * this is absent, so legacy and authored NPCs are unaffected.
   *
   * Distinct from the three neighboring NPC layers: `speechProfile` owns HOW they
   * talk, `biography.background` owns where they came from, and
   * `memory.emotionalMarkers` owns how they feel about the player specifically.
   * Personality is the part that does not change when you meet them.
   */
  personality?: NPCPersonality;
  goals?: Goal[];
  knowledgeProfile?: NPCKnowledgeProfile;
  visual?: NPCVisualSpec;
  /**
   * Supports both legacy and current memory payloads during migration to consolidated persistence.
   */
  memory?: ConsolidatedNpcMemory;
  businessId?: string;              // ID of owned WorldBusiness (if merchant)
}

export interface Biome {
  id: string;
  name: string;
  color: string;
  rgbaColor?: string;
  icon?: string;
  description: string;
  passable: boolean;
  impassableReason?: string;
  // World-gen metadata (optional, non-breaking)
  family?: string; // e.g., forest, plains, wetland, jungle, coastal, desert, mountain, tundra, volcanic, blight
  variant?: string; // e.g., temperate, boreal, ancient, haunted
  climate?: 'tropical' | 'temperate' | 'arid' | 'polar' | 'subtropical';
  moisture?: 'arid' | 'dry' | 'temperate' | 'wet' | 'saturated';
  elevation?: 'low' | 'mid' | 'high' | 'subterranean' | 'aquatic';
  magic?: 'mundane' | 'fey' | 'arcane' | 'necrotic' | 'elemental' | 'wild';
  waterFrequency?: 'none' | 'rare' | 'low' | 'medium' | 'high';
  spawnWeight?: number; // bias for world-map sampling
  tags?: string[];
  movementModifiers?: {
    speedMultiplier?: number;
    difficultTerrain?: boolean;
    requiresClimb?: boolean;
    requiresSwim?: boolean;
  };
  visibilityModifiers?: {
    fog?: 'light' | 'medium' | 'heavy';
    haze?: boolean;
    canopyShade?: boolean;
    snowBlindness?: boolean;
    darkness?: boolean;
  };
  hazards?: string[]; // hazard ids (quicksand, thin-ice, lava, toxic-vent, cursed-ground, etc.)
  elementalInteractions?: string[]; // fire-spreads-fast, ice-cracks, lightning-conductive, water-freezes-night
  encounterWeights?: Record<string, number>; // e.g., { beasts: 3, undead: 1 }
  resourceWeights?: Record<string, number>; // e.g., { wood: 3, ore: 2, fish: 1 }
}

/**
 * One cell of the legacy 30x20 rectangular world grid.
 *
 * @deprecated Grid retirement (see `docs/adr/0003-mapdata-tiles-grid-retirement.md`).
 * The world is the cell-native Worldforge Voronoi atlas: `getBridgeAtlas(worldSeed)`
 * for the cell graph, `state.playerCell` for position, `biomeIdForCell()` for
 * terrain. Use `WorldCellView` for click/observation payloads. This type survives
 * only as the element type of the optional `MapData.tiles` legacy-save grid.
 */
export interface MapTile {
  x: number;
  y: number;
  biomeId: string;
  locationId?: string;
  discovered: boolean;
  isPlayerCurrent: boolean;
}

/**
 * Cell-native description of one world cell, as handed to click / 3D-entry /
 * observation handlers.
 *
 * Grid retirement (agora-608b): this replaces `MapTile` in every runtime
 * contract. The difference that matters is `cellId` — the canonical Worldforge
 * atlas identity. The old payloads were synthesized from a cell and then threw
 * that identity away, forcing callers to recover it from `travelMeta` or an
 * `Entry3DAnchor`.
 *
 * `x` / `y` are preserved (not removed) because the tooltip formatter and the
 * `coord_X_Y` location-id shape still exist for legacy saves. They are display
 * bookkeeping only — never a grid index. They go away with the
 * `coord_X_Y` -> `cell_<id>` cut, not before.
 *
 * Structurally a superset of `MapTile`, so the migration preserved behavior.
 */
export interface WorldCellView {
  /** Canonical Worldforge atlas cell id. The identity of this place. */
  cellId: number;
  /** Legacy display coords: real for a `coord_X_Y` save, otherwise bookkeeping. */
  x: number;
  y: number;
  biomeId: string;
  locationId?: string;
  /** Whether the party knows this cell (persisted explored-cell set). */
  discovered: boolean;
  isPlayerCurrent: boolean;
}

export interface AzgaarWorldRenderData {
  version: 1;
  templateId: string;
  heights: number[];
  temperatures: number[];
  moisture: number[];
  rivers: boolean[];
}

/**
 * Provenance of a generated world, used to surface degraded/fallback generation in the
 * (dev) DebugHUD instead of silently shipping a flat world. See worldsim-service WSS-004.
 */
export interface WorldGenDiagnostics {
  /**
   * Which generator produced this world:
   * - `azgaar-derived`: primary, faithful path (real heightfield + biomes).
   * - `legacy-fallback`: Azgaar generation threw; legacy generator used instead.
   * - `biome-derived`: no Azgaar terrain was available, so heights were derived from the
   *   per-cell biome elevation bands (coarser relief than Azgaar, but not flat). Reachable
   *   via legacy fallback or loading an old save. See `heightFromBiomes`.
   */
  source: 'azgaar-derived' | 'legacy-fallback' | 'biome-derived';
  /** Human-readable reason the non-primary path was taken (fallback/backfill only). */
  reason?: string;
  /** Epoch ms when this provenance was recorded. */
  at: number;
}

/**
 * A saved world's map payload.
 *
 * @deprecated as a runtime type. Grid retirement (2026-06-30 + agora-608b, see
 * `docs/adr/0003-mapdata-tiles-grid-retirement.md`): `mapData` is no longer in
 * `GameState` and no longer in the save format. Nothing in the running game
 * constructs or reads a `MapData`. It survives ONLY as the input shape of the
 * pre-v2 save backfill (`migrateMapDataToWorldDataV2`).
 */
export interface MapData {
  gridSize: { rows: number; cols: number };
  /**
   * The legacy rectangular tile grid.
   *
   * @deprecated Optional as of agora-608b. Migration path: read the cell-native
   * atlas instead (`getBridgeAtlas(worldSeed)` + `biomeIdForCell()`); a click or
   * observation payload is a `WorldCellView`. The field is kept, not deleted,
   * because a pre-v2 save's grid is the ONLY record of that world's biomes —
   * the atlas is derived from `worldSeed` and may not reproduce it. Delete this
   * field when the project decides pre-v2 saves are no longer loadable.
   */
  tiles?: MapTile[][];
  /** @deprecated Use `worldData` instead. Kept for one release for migration. */
  azgaarWorld?: AzgaarWorldRenderData;
  /** Rich world artifact — produced by worldSim. Required for new saves; populated by migration on load for old saves. */
  worldData?: WorldData;
  // Grid retirement (2026-06-30): the `worldGeography` snapshot field is removed
  // — it was a legacy-tile-grid-derived "future geography contract" that nothing
  // ever read; the worldGeographyAdapter that built it is deleted.
  /** How this world was generated (primary vs fallback). Surfaced in the DebugHUD. */
  generation?: WorldGenDiagnostics;
}

export interface PointOfInterest {
  /** Unique ID to reference this POI within UI elements. */
  id: string;
  /** Human readable name shown inside tooltips and legends. */
  name: string;
  /** Short description for hover tooltips. */
  description: string;
  /** World-map aligned coordinates (tile space, not pixels). */
  coordinates: { x: number; y: number };
  /** Emoji or small string icon used on the map surface. */
  icon: string;
  /** Category helps the legend group similar markers. */
  category: 'settlement' | 'landmark' | 'ruin' | 'cave' | 'wilderness';
  /** Optional link back to a formal Location entry. */
  locationId?: string;
}

export interface MapMarker {
  /** ID of the originating POI or generated marker. */
  id: string;
  /** Tile-space coordinates where the marker should render. */
  coordinates: { x: number; y: number };
  /** Icon rendered on both the minimap canvas and the large map grid. */
  icon: string;
  /** Text label shown in tooltips or alongside the icon. */
  label: string;
  /** Optional grouping used by the legend to style or describe the marker. */
  category?: string;
  /** Whether the marker should render as "known" (tile discovered or player present). */
  isDiscovered: boolean;
  /** Associated Location ID, if any, to aid tooltips. */
  relatedLocationId?: string;
}

export interface VillageActionContext {
  worldX: number;
  worldY: number;
  biomeId: string;
  buildingId?: string;
  buildingType: string;
  description: string;
  integrationProfileId: string;
  integrationPrompt: string;
  integrationTagline: string;
  culturalSignature: string;
  encounterHooks: string[];
}

// Note: QuestStatus, QuestObjective, QuestReward, Quest types are now defined in quests.ts
// Import them from there if needed in this file

export interface Monster {
  /**
   * Stable bestiary key (MonsterData.id), e.g. "goblin_boss". Absent on
   * encounter entries built from a name alone, such as AI-authored encounters.
   */
  id?: string;
  name: string;
  quantity: number;
  cr: string;
  description: string;
  /** Optional loot-table link when source data is available. */
  lootTableId?: string;
}

export interface GameMessage {
  id: number;
  text: string;
  sender: 'system' | 'player' | 'npc';
  timestamp: Date;
  metadata?: {
    companionId?: string;
    reactionType?: string;
    [key: string]: unknown;
  };
}
