/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/types/dungeon.ts
 * Defines the data structures for the persistent Dungeon system.
 *
 * Dungeons are distinct from world map Locations. They represent complex,
 * multi-room environments with floors, connections, hazards, and encounters.
 */

import { Trap, Lock } from './mechanics';
import { LootTable } from './loot';

// ============================================================================
// CORE HIERARCHY
// ============================================================================

/**
 * Represents a complete dungeon complex (e.g., "The Sunken Citadel").
 * A dungeon is composed of one or more floors.
 */
export interface Dungeon {
  /** Unique identifier for the dungeon (e.g., "sunken_citadel"). */
  id: string;

  /** Display name of the dungeon. */
  name: string;

  /** Narrative description of the dungeon's exterior or entrance context. */
  description: string;

  /** Recommended character level range (e.g., { min: 1, max: 3 }). */
  levelRange: {
    min: number;
    max: number;
  };

  /** The region or biome where this dungeon is located. */
  region: string;

  /**
   * The floors/levels of the dungeon.
   * Ordered from top to bottom (or logical progression).
   */
  floors: DungeonFloor[];

  /**
   * Global state flags for the dungeon instance.
   * e.g., { "boss_defeated": true, "secret_entrance_found": false }
   */
  state: Record<string, boolean>;
}

/**
 * Represents a single level or strata within a dungeon.
 */
export interface DungeonFloor {
  /** Unique ID for the floor (e.g., "level_1_upper"). */
  id: string;

  /** Display name (e.g., "The Goblin Halls"). */
  name: string;

  /** Order index (0 = surface/first level). */
  depth: number;

  /** The grid of rooms on this floor. */
  rooms: DungeonRoom[];

  /**
   * General environmental traits for this floor.
   * e.g., "damp", "echoing", "magically_dark"
   */
  traits: string[];
}

// ============================================================================
// ROOMS & CONNECTIONS
// ============================================================================

/**
 * Represents a single node (room, corridor section) in the dungeon graph.
 */
export interface DungeonRoom {
  /** Unique ID within the dungeon (e.g., "room_101"). */
  id: string;

  /** Short label for DM/Map view (e.g., "Guard Post"). */
  name: string;

  /** Full descriptive text for the players. */
  description: string;

  /**
   * Logical dimensions in grid squares (5ft).
   * Used for generating the battle map if combat occurs.
   */
  dimensions: {
    width: number;
    height: number;
  };

  /**
   * Connections to other rooms.
   */
  exits: DungeonExit[];

  /**
   * The contents of the room.
   */
  contents: RoomContents;

  /**
   * Lighting conditions in the room.
   */
  lighting: 'bright' | 'dim' | 'dark' | 'magical_darkness';

  /**
   * Whether this room has been visited/mapped by the party.
   * (Runtime state, usually separate, but included here for structure).
   */
  visited?: boolean;
}

/**
 * Represents a connection (edge) between two rooms.
 */
export interface DungeonExit {
  /** The ID of the room this exit leads TO. */
  targetRoomId: string;

  /** Compass direction of the exit relative to the current room center. */
  direction: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

  /**
   * The type of passage.
   * 'door': Standard door (can be closed/locked).
   * 'archway': Open passage.
   * 'secret': Hidden door requiring detection.
   * 'rubble': Blocked passage requiring clearing.
   */
  type: 'door' | 'archway' | 'secret' | 'rubble' | 'portal';

  /** State of the door/passage. */
  state: {
    isOpen: boolean;
    isLocked: boolean;
    isHidden: boolean;
  };

  /**
   * Mechanics associated with the exit.
   */
  mechanics?: {
    lock?: Lock;
    trap?: Trap;
    keyIdRequired?: string; // ID of item needed
  };

  /** Description of the door itself (e.g., "Iron-bound oak door"). */
  description?: string;
}

// ============================================================================
// CONTENTS & ENCOUNTERS
// ============================================================================

/**
 * Aggregates all entities and objects within a room.
 */
export interface RoomContents {
  /**
   * Monsters or NPCs present in the room.
   */
  creatures: DungeonCreatureSpawn[];

  /**
   * Interactive features (statues, altars, furniture).
   */
  features: RoomFeature[];

  /**
   * Loose items or containers.
   */
  loot: DungeonLoot[];

  /**
   * Hazards affecting the room (pits, gas, ambient damage).
   */
  traps: Trap[];
}

/**
 * Definition for a creature spawn.
 */
export interface DungeonCreatureSpawn {
  /** ID of the monster blueprint (e.g., "goblin_archer"). */
  creatureId: string;

  /** Number of creatures (or dice formula e.g. "1d4"). */
  quantity: string | number;

  /**
   * Initial behavior state.
   * 'hostile': Attacks on sight.
   * 'neutral': Wary, might talk.
   * 'sleeping': Prone, unconscious.
   * 'patrolling': Moving between points.
   */
  state: 'hostile' | 'neutral' | 'friendly' | 'sleeping' | 'patrolling';

  /** Specific position in the room (x,y) if fixed. */
  position?: { x: number; y: number };
}

/**
 * An interactive object in the room.
 */
export interface RoomFeature {
  id: string;
  name: string;
  description: string;

  /**
   * Type of feature.
   * 'container': Chest, crate, barrel.
   * 'furniture': Table, throne, bed.
   * 'landmark': Statue, fountain, altar.
   * 'mechanism': Lever, button, wheel.
   */
  type: 'container' | 'furniture' | 'landmark' | 'mechanism';

  /**
   * Interaction properties.
   */
  interaction?: {
    isLocked?: boolean;
    lock?: Lock;
    lootTableId?: string; // If it contains loot
    triggerScript?: string; // ID of script to run on interact
  };
}

/**
 * Loot found in the room (not on bodies).
 */
export interface DungeonLoot {
  /**
   * Type of loot source.
   * 'pile': Loose items on floor.
   * 'hidden': Tucked away (requires investigation).
   */
  type: 'pile' | 'hidden';

  /** The specific items or gold. */
  items?: string[]; // Item IDs
  currency?: {
    gold: number;
    silver: number;
    copper: number;
  };

  /** Or a reference to a loot table to roll when searched. */
  lootTableId?: string;
}

// TODO(Schemer): Export this module in src/types/index.ts to make it available to the MapGenerator system.
