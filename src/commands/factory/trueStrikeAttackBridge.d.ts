/**
 * This file turns True Strike's structured attack augment into a real weapon attack.
 *
 * The spell data already describes the weapon requirement, the cast-time attack,
 * the spellcasting-ability substitution, and the Radiant-vs-normal choice. This
 * helper keeps that logic in one small place so the spell command factory and the
 * self-target selection flow can share the same validation and synthesis rules.
 *
 * Called by: SpellCommandFactory and useAbilitySystem.
 * Depends on: shared spell, combat, item, and weapon-proficiency types/utilities.
 */
import { Ability, CombatCharacter, SelectedSpellTarget } from '@/types/combat';
import { Item } from '@/types/items';
import { Spell, UtilityEffect } from '@/types/spells';
export interface TrueStrikeWeaponValidation {
    valid: boolean;
    reason?: string;
}
export interface TrueStrikeAttackBuildResult {
    attackAbility: Ability;
    attackTarget: CombatCharacter;
    weaponSnapshot: Item;
    chosenDamageType: 'Radiant' | string;
}
export declare const hasTrueStrikeImmediateAttackAugment: (spell: Spell) => boolean;
export declare const resolveTrueStrikeWeaponSnapshot: (caster: CombatCharacter) => Item | undefined;
export declare const resolveTrueStrikeAttackTarget: (selectedSpellTargets: SelectedSpellTarget[] | undefined, targets: CombatCharacter[], casterId: string) => CombatCharacter | undefined;
export declare const validateTrueStrikeWeaponSnapshot: (caster: CombatCharacter, weaponSnapshot: Item | undefined, weaponRequirement?: NonNullable<UtilityEffect["attackAugments"]>[number]["weaponRequirement"]) => TrueStrikeWeaponValidation;
export declare const buildTrueStrikeAttack: (spell: Spell, caster: CombatCharacter, weaponSnapshot: Item, attackTarget: CombatCharacter, playerInput?: string) => TrueStrikeAttackBuildResult;
export declare const resolveTrueStrikeDamageChoice: (spell: Spell, playerInput?: string) => "Radiant" | string;
