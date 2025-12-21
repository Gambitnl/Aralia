
/**
 * @file src/types/religion.ts
 * Defines types and interfaces for the religion system, including deities,
 * divine favor, and temple services.
 */
import { AbilityScoreName } from './index';
import { MechanicalEffect } from './effects';

export type Alignment =
  | 'Lawful Good' | 'Neutral Good' | 'Chaotic Good'
  | 'Lawful Neutral' | 'True Neutral' | 'Chaotic Neutral'
  | 'Lawful Evil' | 'Neutral Evil' | 'Chaotic Evil';

export type Domain = 'Life' | 'Light' | 'Nature' | 'Tempest' | 'Trickery' | 'War' | 'Death' | 'Knowledge' | 'Arcana' | 'Forge' | 'Grave' | 'Order' | 'Peace' | 'Twilight' | 'Freedom';

export interface DeityActionTrigger {
  trigger: string;
  description: string;
  favorChange: number;
}

export interface DeityRelationship {
  targetDeityId: string;
  type: 'ally' | 'enemy' | 'rival';
}

export interface Deity {
  id: string;
  name: string;
  titles: string[]; // e.g., ["The Sun Lord"]
  domains: Domain[];
  alignment: Alignment;
  symbol: string;
  description: string;
  commandments: string[]; // Roleplay guidelines
  favoredWeapon?: string;
  approves: DeityActionTrigger[]; // Mechanical or narrative actions that gain favor
  forbids: DeityActionTrigger[]; // Actions that lose favor
  relationships?: DeityRelationship[];
  // Legacy fields for backward compatibility (optional)
  title?: string;
  approvedActions?: string[];
  forbiddenActions?: string[];
}

export type FavorRank = 'Heretic' | 'Shunned' | 'Neutral' | 'Initiate' | 'Devotee' | 'Champion' | 'Chosen';

export interface DivineFavor {
  score: number; // -100 to 100
  rank: FavorRank;
  consecutiveDaysPrayed: number;
  lastPrayerTimestamp?: number;
  history: { timestamp: number; reason: string; change: number }[];
  blessings: Blessing[];
}

export interface Blessing {
  id: string;
  name: string;
  description: string;
  duration?: number;
  /**
   * The mechanical effect granted by this blessing.
   * Can be a single effect or a list of effects.
   */
  effect: MechanicalEffect | MechanicalEffect[];
}

export interface TempleServiceRequirement {
  minFavor?: number; // Minimum favor score required
  questId?: string;  // Specific quest completion
  goldCost?: number;
  itemCost?: { itemId: string; count: number };
}

export interface TempleService {
  id: string;
  name: string;
  description: string;
  costGp?: number; // Simplified cost
  minFavor?: number; // Simplified requirement
  requirement?: TempleServiceRequirement;
  effect: string | { // Allow string description or complex object
    type: 'heal' | 'buff' | 'cure' | 'identify' | 'quest' | 'favor' | 'restoration';
    value?: number;
    stat?: AbilityScoreName;
    duration?: number; // in minutes
    description?: string;
  };
}

export interface Temple {
  id: string;
  deityId: string;
  name: string;
  description: string;
  locationId?: string; // If tied to a specific location
  services: (TempleService | string)[]; // Can be objects or IDs
}

export interface ReligionState {
  divineFavor: Record<string, DivineFavor>; // Map of deityId -> DivineFavor
  discoveredDeities: string[]; // IDs of deities the player knows about
  activeBlessings: {
    deityId: string;
    effectId: string;
    expirationTimestamp: number;
  }[];
}

// Action Types for Favor System
export interface DeityAction {
    id: string;
    description: string;
    domain?: string;
    favorChange: number;
}
