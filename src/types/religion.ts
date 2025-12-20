
/**
 * @file src/types/religion.ts
 * Defines types and interfaces for the religion system, including deities,
 * divine favor, and temple services.
 */
import { AbilityScoreName } from './index';

export type Alignment =
  | 'Lawful Good' | 'Neutral Good' | 'Chaotic Good'
  | 'Lawful Neutral' | 'True Neutral' | 'Chaotic Neutral'
  | 'Lawful Evil' | 'Neutral Evil' | 'Chaotic Evil';

export type Domain = 'Life' | 'Light' | 'Nature' | 'Tempest' | 'Trickery' | 'War' | 'Death' | 'Knowledge' | 'Arcana' | 'Forge' | 'Grave' | 'Order' | 'Peace' | 'Twilight' | 'Freedom';

export interface DeityApproval {
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
  titles: string[]; // e.g., ["The Sun Lord", "The Shining One"]
  domains: Domain[];
  alignment: Alignment;
  symbol: string;
  description: string;
  commandments: string[]; // Roleplay guidelines
  favoredWeapon?: string;
  approves: DeityApproval[];
  forbids: DeityApproval[];
  relationships?: DeityRelationship[];
  // Legacy compatibility fields (optional, marked deprecated if needed)
  approvedActions?: string[];
  forbiddenActions?: string[];
  title?: string;
}

export type FavorRank = 'Heretic' | 'Shunned' | 'Neutral' | 'Initiate' | 'Devotee' | 'Champion' | 'Chosen';

export interface DivineFavor {
  score: number; // -100 to 100
  rank: FavorRank;
  consecutiveDaysPrayed: number;
  lastPrayerTimestamp?: number;
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
  requirement: TempleServiceRequirement;
  effect: {
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
  services: string[]; // IDs of available services
}

export interface ReligionState {
  deityFavor: Record<string, DivineFavor>; // Map of deityId -> DivineFavor
  discoveredDeities: string[]; // IDs of deities the player knows about
  activeBlessings: {
    deityId: string;
    effectId: string;
    expirationTimestamp: number;
  }[];
}
