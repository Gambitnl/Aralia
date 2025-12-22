import type { NPCVisualSpec } from './visuals';
import type { NPCKnowledgeProfile } from './dialogue';

// -----------------------------------------------------------------------------
// World and NPC types
// -----------------------------------------------------------------------------

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
  lastInteractionTimestamp?: number;
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

export enum QuestStatus {
  Active = 'Active',
  Completed = 'Completed',
  Failed = 'Failed'
}

export interface QuestObjective {
  id: string;
  description: string;
  isCompleted: boolean;
}

export interface QuestReward {
  gold?: number;
  xp?: number;
  items?: string[]; // Item IDs
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  giverId: string; // NPC ID
  status: QuestStatus;
  objectives: QuestObjective[];
  rewards?: QuestReward;
  dateStarted: number;
  dateCompleted?: number;
  /** Optional world-region hint for UI grouping */
  regionHint?: string;
  /** Narrative tag such as "Main", "Side", "Guild" for filtering */
  questType?: 'Main' | 'Side' | 'Guild' | 'Dynamic';

  /** Game day timestamp by which the quest must be completed */
  deadline?: number;

  /** Consequence logic for missing the deadline */
  deadlineConsequence?: {
    action: 'fail_quest' | 'fail_with_note' | 'log_only';
    message: string; // "The merchant has left town."
  };

  /** Internal notes or system comments appended to the quest (e.g. failure reasons) */
  notes?: string;
}

export interface QuestTemplate extends Omit<Quest, 'status' | 'objectives' | 'dateStarted' | 'dateCompleted'> {
  objectives: Array<Omit<QuestObjective, 'isCompleted'>>;
  repeatable?: boolean;
}

export interface Monster {
  name: string;
  quantity: number;
  cr: string;
  description: string;
}

export interface GameMessage {
  id: number;
  text: string;
  sender: 'system' | 'player' | 'npc';
  timestamp: Date;
  metadata?: {
    companionId?: string;
    reactionType?: string;
    [key: string]: any;
  };
}
