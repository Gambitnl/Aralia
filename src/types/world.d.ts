import type { NPCVisualSpec } from './visuals';
import type { NPCKnowledgeProfile } from './dialogue';
import type { Position as CombatPosition } from './combat';
import type { NPCMemory } from './memory';
import type { AbilityScores } from './character';
import type { EquipmentSlotType, Item } from './items';
export type Position = CombatPosition;
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
    };
    stats: {
        hp: number;
        maxHp: number;
        armorClass: number;
        speed: number;
        initiativeBonus: number;
        passivePerception: number;
        proficiencyBonus: number;
    };
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
    exits: {
        [direction: string]: string | Exit;
    };
    itemIds?: string[];
    npcIds?: string[];
    dynamicNpcConfig?: LocationDynamicNpcConfig;
    mapCoordinates: {
        x: number;
        y: number;
    };
    biomeId: string;
    gossipLinks?: string[];
    planeId?: string;
    regionId?: string;
}
export interface TTSVoiceOption {
    name: string;
    characteristic: string;
}
export declare enum SuspicionLevel {
    Unaware = 0,
    Suspicious = 1,
    Alert = 2
}
export declare enum GoalStatus {
    Unknown = "Unknown",
    Active = "Active",
    Completed = "Completed",
    Failed = "Failed"
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
    timestamp: number;
    expiration: number;
    region?: string;
    locationId?: string;
    spreadDistance?: number;
    virality?: number;
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
    interactions?: unknown[];
    attitude?: string | number;
    discussedTopics?: Record<string, unknown>;
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
    memory?: NPCMemory | NpcMemory;
    businessId?: string;
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
    family?: string;
    variant?: string;
    climate?: 'tropical' | 'temperate' | 'arid' | 'polar' | 'subtropical';
    moisture?: 'arid' | 'dry' | 'temperate' | 'wet' | 'saturated';
    elevation?: 'low' | 'mid' | 'high' | 'subterranean' | 'aquatic';
    magic?: 'mundane' | 'fey' | 'arcane' | 'necrotic' | 'elemental' | 'wild';
    waterFrequency?: 'none' | 'rare' | 'low' | 'medium' | 'high';
    spawnWeight?: number;
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
    hazards?: string[];
    elementalInteractions?: string[];
    encounterWeights?: Record<string, number>;
    resourceWeights?: Record<string, number>;
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
export interface MapData {
    gridSize: {
        rows: number;
        cols: number;
    };
    tiles: MapTile[][];
    azgaarWorld?: AzgaarWorldRenderData;
}
export interface PointOfInterest {
    /** Unique ID to reference this POI within UI elements. */
    id: string;
    /** Human readable name shown inside tooltips and legends. */
    name: string;
    /** Short description for hover tooltips. */
    description: string;
    /** World-map aligned coordinates (tile space, not pixels). */
    coordinates: {
        x: number;
        y: number;
    };
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
    coordinates: {
        x: number;
        y: number;
    };
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
export interface Monster {
    name: string;
    quantity: number;
    cr: string;
    description: string;
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
