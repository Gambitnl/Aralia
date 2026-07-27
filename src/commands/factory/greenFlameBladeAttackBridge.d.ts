/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 13:45:05
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns Green-Flame Blade into a real melee weapon attack with a
 * hit-gated fire leap.
 *
 * The spell already carries the exact secondary-target metadata in its live
 * JSON. This bridge keeps the cast scoped to a weapon attack while resolving
 * the secondary target and tiered fire damage in one narrow place.
 */
import { Ability, CombatCharacter, SelectedSpellTarget } from '@/types/combat';
import { Item } from '@/types/items';
import { Spell, SpellEffect } from '@/types/spells';
export interface GreenFlameBladeAttackBuildResult {
    attackAbility: GreenFlameBladeRuntimeAbility;
    attackTarget: CombatCharacter;
    weaponSnapshot: Item;
}
export interface GreenFlameBladeWeaponValidation {
    valid: boolean;
    reason?: string;
}
export interface GreenFlameBladeRuntimeAbility extends Ability {
    greenFlameBladeSecondaryTargetId?: string;
    greenFlameBladeSecondaryEffect?: SpellEffect;
}
export declare const hasGreenFlameBladeWeaponAttackBridge: (spell: Spell) => boolean;
export declare const resolveGreenFlameBladeWeaponSnapshot: (caster: CombatCharacter) => Item | undefined;
export declare const resolveGreenFlameBladeAttackTarget: (selectedSpellTargets: SelectedSpellTarget[] | undefined, targets: CombatCharacter[], casterId: string) => CombatCharacter | undefined;
export declare const resolveGreenFlameBladeSecondaryTarget: (selectedSpellTargets: SelectedSpellTarget[] | undefined, targets: CombatCharacter[], primaryTargetId: string, casterId: string, primaryTarget: CombatCharacter) => CombatCharacter | undefined;
export declare const validateGreenFlameBladeWeaponSnapshot: (caster: CombatCharacter, weaponSnapshot: Item | undefined) => GreenFlameBladeWeaponValidation;
export declare const buildGreenFlameBladeAttack: (spell: Spell, caster: CombatCharacter, weaponSnapshot: Item, attackTarget: CombatCharacter, selectedSpellTargets: SelectedSpellTarget[] | undefined, targets: CombatCharacter[]) => GreenFlameBladeAttackBuildResult;
export declare const isGreenFlameBladeRuntimeAbility: (ability: Ability) => ability is GreenFlameBladeRuntimeAbility;
