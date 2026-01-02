
/**
 * @file src/types/religion.ts
 * Defines types and interfaces for the religion system, including deities,
 * divine favor, and temple services.
 */
import { AbilityScoreName } from './core';
import { MechanicalEffect } from './effects';

/**
 * Alignment represents the moral and ethical stance of a creature or deity.
 * Source: PHB 2024
 */
export enum Alignment {
  LawfulGood = 'Lawful Good',
  NeutralGood = 'Neutral Good',
  ChaoticGood = 'Chaotic Good',
  LawfulNeutral = 'Lawful Neutral',
  TrueNeutral = 'True Neutral',
  ChaoticNeutral = 'Chaotic Neutral',
  LawfulEvil = 'Lawful Evil',
  NeutralEvil = 'Neutral Evil',
  ChaoticEvil = 'Chaotic Evil',
  Unaligned = 'Unaligned',
}

export type AlignmentEthicalAxis = 'Lawful' | 'Neutral' | 'Chaotic';
export type AlignmentMoralAxis = 'Good' | 'Neutral' | 'Evil';

export interface AlignmentTraits {
  ethical: AlignmentEthicalAxis;
  moral: AlignmentMoralAxis;
  description: string;
}

/**
 * Standard traits associated with each alignment.
 */
export const AlignmentDefinitions: Record<Alignment, AlignmentTraits> = {
  [Alignment.LawfulGood]: {
    ethical: 'Lawful',
    moral: 'Good',
    description: 'Creatures that can be counted on to do the right thing as expected by society.',
  },
  [Alignment.NeutralGood]: {
    ethical: 'Neutral',
    moral: 'Good',
    description: 'Folk who do the best they can to help others according to their needs.',
  },
  [Alignment.ChaoticGood]: {
    ethical: 'Chaotic',
    moral: 'Good',
    description: 'Creatures that act as their conscience directs, with little regard for what others expect.',
  },
  [Alignment.LawfulNeutral]: {
    ethical: 'Lawful',
    moral: 'Neutral',
    description: 'Individuals who act in accordance with law, tradition, or personal codes.',
  },
  [Alignment.TrueNeutral]: {
    ethical: 'Neutral',
    moral: 'Neutral',
    description: 'Those who prefer to steer clear of moral questions and don\'t take sides.',
  },
  [Alignment.ChaoticNeutral]: {
    ethical: 'Chaotic',
    moral: 'Neutral',
    description: 'Creatures that follow their whims, holding their personal freedom above all else.',
  },
  [Alignment.LawfulEvil]: {
    ethical: 'Lawful',
    moral: 'Evil',
    description: 'Creatures that methodically take what they want, within the limits of a code of tradition, loyalty, or order.',
  },
  [Alignment.NeutralEvil]: {
    ethical: 'Neutral',
    moral: 'Evil',
    description: 'Those who do whatever they can get away with, without compassion or qualms.',
  },
  [Alignment.ChaoticEvil]: {
    ethical: 'Chaotic',
    moral: 'Evil',
    description: 'Creatures that act with arbitrary violence, spurred by their greed, hatred, or bloodlust.',
  },
  [Alignment.Unaligned]: {
    ethical: 'Neutral',
    moral: 'Neutral',
    description: 'Creatures that lack the capacity for rational moral or ethical judgment.',
  },
};

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

// TODO(Taxonomist): Update codebase to use Alignment enum instead of string literals
