// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/06/2026, 06:37:00
 * Dependents: components/Religion/TempleModal.tsx, state/initialState.ts, types/index.ts, utils/world/religionUtils.ts, utils/world/templeUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/types/religion.ts
 * Defines types and interfaces for the religion system, including deities,
 * divine favor, and temple services.
 */
import { AbilityScoreName } from './core.js';
import { MechanicalEffect } from './effects.js';

/**
 * Alignment represents the moral and ethical stance of a creature or deity. */
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
  /**
   * Optional combat taxonomy labels that let the combat adapter map structured
   * log fields to this trigger without guessing from the trigger name alone.
   */
  combatTags?: string[];
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

/**
 * Temple service effects stay backward-compatible with legacy string IDs, but
 * the structured branch is now typed explicitly so non-heal services do not
 * get lumped into the heal path by default.
 */
export type TempleServiceLegacyEffect =
  | 'grant_blessing_minor'
  | 'heal_20_hp'
  | 'remove_curse'
  | 'Divine Intervention'
  | 'Prevent Undeath'
  | `grant_blessing_${string}`
  | `grant_favor_${string}`
  | `restore_hp_${string}`
  | `remove_condition_${string}`
  | `Spell: ${string}`;

export interface TempleHealEffect {
  type: 'heal';
  value?: number;
  description?: string;
}

export interface TempleBuffEffect {
  type: 'buff';
  value?: number;
  stat?: AbilityScoreName;
  duration?: number;
  description?: string;
}

export interface TempleCureEffect {
  type: 'cure';
  value?: number;
  description?: string;
}

export interface TempleIdentifyEffect {
  type: 'identify';
  description?: string;
  itemId?: string;
}

export interface TempleQuestEffect {
  type: 'quest';
  questId?: string;
  description?: string;
}

export interface TempleFavorEffect {
  type: 'favor';
  value?: number;
  deityId?: string;
  description?: string;
}

export interface TempleRestorationEffect {
  type: 'restoration';
  subtype?: 'heal' | 'cure_condition' | 'restore_slot';
  value?: number;
  spellLevel?: number;
  conditions?: string[];
  description?: string;
}

export type TempleStructuredEffect =
  | TempleHealEffect
  | TempleBuffEffect
  | TempleCureEffect
  | TempleIdentifyEffect
  | TempleQuestEffect
  | TempleFavorEffect
  | TempleRestorationEffect;

export type TempleServiceEffect = TempleServiceLegacyEffect | TempleStructuredEffect;

export interface TempleService {
  id: string;
  name: string;
  description: string;
  costGp?: number; // Simplified cost
  minFavor?: number; // Simplified requirement
  requirement?: TempleServiceRequirement;
  effect: TempleServiceEffect;
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
