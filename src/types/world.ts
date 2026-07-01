// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 27/06/2026, 01:55:55
 * Dependents: components/CharacterSheet/Family/FamilyTreeTab.tsx, components/World3D/DebugHUD.tsx, components/World3D/InWorldHUD.tsx, services/strongholdService.ts, state/migrations/worldDataMigration.ts, systems/economy/TradeRouteSystem.ts, systems/gameEntry/situationNpcToRichNpc.ts, systems/spells/ai/AISpellArbitrator.ts, systems/worldforge/bridge/groundChunkLoader.ts, types/index.ts, utils/mapDataToWorldData.ts, utils/world/worldGeographyAdapter.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { NPCVisualSpec } from './visuals.js';
import type { NPCKnowledgeProfile } from './dialogue.js';
import type { Position as CombatPosition } from './combat.js';
import type { NPCMemory } from './memory.js'; // Added because NPC now carries optional memory.
import type { AbilityScores } from './character.js';
import type { EquipmentSlotType, Item } from './items.js';
import type { WorldData } from '../services/worldSim/types';
import type { Lock, Puzzle } from '../systems/puzzles/types.js';

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
  source: 'direct' | 'gossip';
  sourceNpcId?: string;
  isPublic: boolean;
  timestamp: number;
  strength: number;
  lifespan: number;
  sourceDiscoveryId?: string;
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
  suspicion: SuspicionLevel;
  goals: Goal[];
  /** Optional lightweight fact list used by AI helpers (distinct from structured KnownFacts). */
  facts?: string[];
  lastInteractionTimestamp?: number;
  // TODO(2026-01-03 pass 4 Codex-CLI): interactions placeholder until NPC interaction history is fully typed.
  interactions?: unknown[];
  // TODO(2026-01-03 pass 4 Codex-CLI): attitude placeholder for future relationship modeling.
  attitude?: string | number;
  // TODO(2026-01-03 pass 4 Codex-CLI): discussedTopics placeholder until conversation logging is formalized.
  discussedTopics?: Record<string, unknown>;
  // TODO(2026-01-03 pass 4 Codex-CLI): lastInteractionDate placeholder until timestamps are standardized across NPC memory.
  lastInteractionDate?: string | number | Date | null;
}

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
  goals?: Goal[];
  knowledgeProfile?: NPCKnowledgeProfile;
  visual?: NPCVisualSpec;
  // TODO(preserve-lint): Unify NpcMemory/NPCMemory once the memory systems converge.
  memory?: NPCMemory | NpcMemory;
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

export interface MapTile {
  x: number;
  y: number;
  biomeId: string;
  locationId?: string;
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

export interface MapData {
  gridSize: { rows: number; cols: number };
  tiles: MapTile[][];
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
  name: string;
  quantity: number;
  cr: string;
  description: string;
  // TODO(Schemer): Link to LootTable ID once loot tables are populated in src/data/lootTables.ts
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
    // TODO(lint-intent): The any on this value hides the intended shape of this data.
    // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
    // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
    [key: string]: unknown;
  };
}
