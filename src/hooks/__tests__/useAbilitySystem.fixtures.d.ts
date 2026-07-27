import { CombatCharacter, Ability } from '../../types/combat';
import { Spell } from '../../types/spells';
import { Item } from '../../types';
/**
 * Shared fixtures for the useAbilitySystem hook test suite (split by describe block).
 * Move-only extraction from the former single useAbilitySystem.test.ts.
 */
export declare const shieldSpell: Spell;
export declare const attacker: CombatCharacter;
export declare const defender: CombatCharacter;
export declare const swordItem: Item;
export declare const basicAttack: Ability;
