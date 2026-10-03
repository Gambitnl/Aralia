// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: systems/planar/InfernalMechanics.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CharacterStats as _CharacterStats } from './combat';
import { AbilityScoreName } from './core';
import { Item } from './items';
import { CrimeType } from './crime';

export type ContractType = 'soul_pact' | 'service_agreement' | 'power_exchange' | 'forbidden_knowledge';

export type ContractStatus = 'draft' | 'active' | 'fulfilled' | 'breached' | 'void' | 'collected';

/**
 * What a clause actually does to the running game.
 *
 * `ContractClause.mechanics` stays the human-facing sentence shown in tooltips;
 * `ContractClause.effect` is the machine-readable twin that InfernalMechanics
 * applies, so boons and penalties never depend on parsing that prose.
 */
export type ContractEffect =
  /** Permanent ability-score increase granted to the Signee. */
  | { kind: 'ability_score'; ability: AbilityScoreName; amount: number }
  /** Coin paid to (positive) or taken from (negative) the party purse. */
  | { kind: 'gold'; amount: number }
  /** A physical boon placed in the party inventory. */
  | { kind: 'item'; item: Item }
  /** Dice notation rolled against the Signee when a penalty resolves. */
  | { kind: 'psychic_damage'; dice: string }
  /** The Hells collect every coin the party holds. */
  | { kind: 'forfeit_gold' };

/**
 * A term the Signee must keep. `InfernalMechanics.detectBreach` evaluates these
 * against live GameState; the first violated condition breaches the contract.
 */
export type ContractBreachCondition =
  /** Breached once notoriety climbs past the agreed ceiling. */
  | { kind: 'max_global_heat'; value: number }
  /** Breached as soon as a crime of this kind appears on the record. */
  | { kind: 'forbidden_crime'; crimeType: CrimeType }
  /** Breached when `soulsRequired` is unmet this many days after signing. */
  | { kind: 'souls_due'; withinDays: number }
  /** Breached when `servicesRequired` is unmet this many days after signing. */
  | { kind: 'services_due'; withinDays: number };

export interface ContractClause {
  id: string;
  description: string;
  type: 'boon' | 'obligation' | 'penalty';
  mechanics?: string; // Description of the mechanical effect for UI/Tooltips
  triggerCondition?: string; // e.g. "daily", "on_death", "on_kill"
  /**
   * Structured payload applied when this clause resolves: on signing for a boon,
   * on breach for a penalty. Optional so hand-authored, flavor-only clauses stay legal.
   */
  effect?: ContractEffect;
  /** Obligations only: the condition whose violation breaches the contract. */
  breachCondition?: ContractBreachCondition;
}

export interface InfernalContract {
  id: string;
  title: string;
  description: string;
  type: ContractType;
  grantorId: string; // The Devil's ID
  grantorName: string;
  signeeId: string; // The Player's ID
  signeeName: string;
  dateSigned?: number; // Game time
  status: ContractStatus;

  clauses: ContractClause[];

  // Specific tracking for contract progress
  soulsCollected?: number;
  soulsRequired?: number;
  servicesRendered?: number;
  servicesRequired?: number;

  // Hidden terms that might be revealed later
  finePrint?: ContractClause[];

  signatureBlood?: boolean; // Flavor: was it signed in blood?
}

export interface ContractGenerationParams {
  type: ContractType;
  grantorId: string;
  grantorName: string;
  signeeId: string;
  signeeName: string;
  tier: 'minor' | 'lesser' | 'greater' | 'archduke';
}
