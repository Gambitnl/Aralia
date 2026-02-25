/**
 * @file src/types/town.ts
 * Type definitions for the Living Town system.
 *
 * This module defines all types related to town navigation, NPCs,
 * events, and the living world simulation.
 */
import { TownMap, TileType } from './realmsmith';
/**
 * Position within the town grid (tile coordinates)
 */
export interface TownPosition {
    x: number;
    y: number;
}
/**
 * Cardinal and ordinal directions for movement
 */
export type TownDirection = 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';
/**
 * Direction vectors for 8-directional movement
 */
export declare const TOWN_DIRECTION_VECTORS: Record<TownDirection, TownPosition>;
/**
 * Main state container for town exploration
 */
export interface TownState {
    /** Player's current position in tile coordinates */
    playerPosition: TownPosition;
    /** Cached town map data for the current session */
    townMap: TownMap;
    /** Entry point for returning to overworld */
    entryPoint: {
        worldX: number;
        worldY: number;
        subMapX: number;
        subMapY: number;
    };
    /** Camera/viewport center position */
    viewportCenter: TownPosition;
    /** Current zoom level (1.0 = default) */
    zoomLevel: number;
    /** Direction the player is facing (for sprite rendering) */
    playerFacing: TownDirection;
    /** Whether the player is currently moving (for animation) */
    isMoving: boolean;
}
/** Tile types that can be walked on */
export declare const WALKABLE_TILE_TYPES: TileType[];
/** Tile types that block movement */
export declare const BLOCKING_TILE_TYPES: TileType[];
export type NPCRole = 'merchant' | 'guard' | 'villager' | 'traveler' | 'child' | 'noble' | 'beggar' | 'performer';
export type NPCActivity = 'sleeping' | 'working' | 'walking' | 'shopping' | 'eating' | 'drinking' | 'praying' | 'patrolling' | 'chatting' | 'idling' | 'performing';
export type NPCMood = 'happy' | 'neutral' | 'sad' | 'angry' | 'fearful' | 'excited' | 'tired' | 'suspicious';
export interface ScheduleEntry {
    /** Hour when this activity starts (0-23) */
    startHour: number;
    /** Hour when this activity ends (0-23) */
    endHour: number;
    /** Location type to go to */
    location: 'home' | 'work' | 'plaza' | 'market' | 'tavern' | 'temple' | 'patrol';
    /** Specific building ID if applicable */
    buildingId?: string;
    /** What the NPC is doing */
    activity: NPCActivity;
}
export interface DailySchedule {
    entries: ScheduleEntry[];
}
export interface TownNPC {
    id: string;
    name: string;
    role: NPCRole;
    /** Current position in the town (tile coordinates) */
    position: TownPosition;
    /** Building they call home */
    homeBuilding: string;
    /** Building they work at (if applicable) */
    workBuilding?: string;
    /** Daily schedule */
    schedule: DailySchedule;
    /** Current activity */
    currentActivity: NPCActivity;
    /** Current mood */
    mood: NPCMood;
    /** Direction they're facing */
    facing: TownDirection;
    /** Whether they're currently walking */
    isWalking: boolean;
    /** Path they're currently following (if moving) */
    currentPath?: TownPosition[];
}
export type TownEventType = 'cart_passing' | 'town_crier' | 'street_performer' | 'argument' | 'guard_patrol' | 'merchant_arrival' | 'suspicious_figure' | 'children_playing' | 'dog_barking';
export interface TownEvent {
    id: string;
    type: TownEventType;
    position: TownPosition;
    startTime: number;
    duration: number;
    participants: string[];
    description: string;
}
export type InteractionType = 'talk' | 'trade' | 'enter_building' | 'examine' | 'pickpocket' | 'attack' | 'follow';
export interface TownInteraction {
    type: InteractionType;
    targetId: string;
    targetType: 'npc' | 'building' | 'doodad';
    position: TownPosition;
    label: string;
}
