/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 13:19:32
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns Booming Blade's spell data into a real melee weapon attack.
 *
 * Booming Blade has two linked parts: a weapon hit during the cast, then a
 * target-side thunder rider if the hit creature willingly moves before the next
 * turn. Keeping that bridge here lets the spell command factory reuse the
 * ordinary weapon attack command while still preserving the delayed movement
 * payload from the live spell JSON.
 *
 * Called by: SpellCommandFactory and WeaponAttackCommand.
 * Depends on: combat/item/spell types and character proficiency/stat helpers.
 */
import { Ability, CombatCharacter, SelectedSpellTarget } from '@/types/combat';
import { Item } from '@/types/items';
import { Spell, SpellEffect } from '@/types/spells';
export interface BoomingBladeAttackBuildResult {
    attackAbility: Ability;
    attackTarget: CombatCharacter;
    weaponSnapshot: Item;
    movementEffects: SpellEffect[];
}
export interface BoomingBladeWeaponValidation {
    valid: boolean;
    reason?: string;
}
export interface BoomingBladeRuntimeAbility extends Ability {
    boomingBladeMovementEffects?: SpellEffect[];
    boomingBladeDurationRounds?: number;
}
export declare const hasBoomingBladeWeaponAttackBridge: (spell: Spell) => boolean;
export declare const resolveBoomingBladeWeaponSnapshot: (caster: CombatCharacter) => Item | undefined;
export declare const resolveBoomingBladeAttackTarget: (selectedSpellTargets: SelectedSpellTarget[] | undefined, targets: CombatCharacter[], casterId: string) => CombatCharacter | undefined;
export declare const validateBoomingBladeWeaponSnapshot: (caster: CombatCharacter, weaponSnapshot: Item | undefined) => BoomingBladeWeaponValidation;
export declare const buildBoomingBladeAttack: (spell: Spell, caster: CombatCharacter, weaponSnapshot: Item, attackTarget: CombatCharacter) => BoomingBladeAttackBuildResult;
export declare const isBoomingBladeRuntimeAbility: (ability: Ability) => ability is BoomingBladeRuntimeAbility;
