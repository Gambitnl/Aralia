/**
 * @file src/systems/necromancy/models.ts
 * Defines the data structures for the Necromancy system, specifically Corpses.
 */

import { CombatCharacter, Position } from '../../types/combat';

/**
 * Represents the state of a corpse on the battlefield.
 * Corpses are valid targets for spells like Animate Dead, Revivify, etc.
 */
export interface Corpse {
  id: string;

  /**
   * The ID of the original character this corpse came from.
   * Used for linking back to the original entity for Revivify.
   */
  originalCharacterId: string;

  /**
   * Snapshot of the character when they died.
   * Vital for determining stats of raised minions or if Revivify works (level, creature type).
   */
  characterSnapshot: CombatCharacter;

  /**
   * The turn number when death occurred.
   * Used to validate time limits (e.g., Revivify's 1-minute limit).
   */
  turnOfDeath: number;

  /**
   * The current physical state of the remains.
   * Affects which spells can be used (e.g., Animate Dead can target bones or fresh corpse).
   */
  state: CorpseState;

  /**
   * Position on the battle map.
   */
  position: Position;

  /**
   * If true, this corpse has been pillaged/looted and might not have items.
   */
  isLooted: boolean;
}

export type CorpseState =
  | 'fresh'        // Recently dead (detectable by Revivify)
  | 'decomposing'  // Too old for Revivify, but valid for Animate Dead (Zombie)
  | 'bones'        // Skeletal remains, valid for Animate Dead (Skeleton)
  | 'destroyed';   // Ashes or dust, requires Resurrection/True Resurrection

/**
 * Metadata usually stored in a spell effect to indicate it creates Undead.
 */
export interface NecromancyEffectMetadata {
  createsUndeadType: 'Zombie' | 'Skeleton' | 'Ghoul' | 'Other';
  requiresCorpseState: CorpseState[];
}
