import type { NPCVisualSpec } from './visuals';
import type { NPCKnowledgeProfile } from './dialogue';
import type { Position as CombatPosition } from './combat';
import type { NPCMemory } from './memory'; // Added because NPC now carries optional memory.
import type { AbilityScores, EquipmentSlotType, Item } from './character';

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
  mapCoordinates: { x: number; y: number };
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
  // Was missing from NPC; added to allow MemorySystem/tests to attach NPCMemory without type errors.
  memory?: NPCMemory;
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

export interface MapData {
  gridSize: { rows: number; cols: number };
  tiles: MapTile[][];
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
