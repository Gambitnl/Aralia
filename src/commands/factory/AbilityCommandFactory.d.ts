/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 20:12:17
 * Dependents: commands/factory/SpellCommandFactory.ts, commands/index.ts
 * Imports: 28 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * ARCHITECTURAL CONTEXT:
 * This factory is responsible for bridging the gap between 'Abilities'
 * (weapon attacks, class features) and 'Commands'. It translates raw
 * weapon data into executable combat logic.
 *
 * Recent updates focus on 'Keyword Propagation'.
 * - In `WeaponAttackCommand`, we now extract `weapon.properties` (e.g.,
 *   'heavy', 'finesse') from the ability and pass them into the
 *   `CommandContext`.
 * - This ensures that downstream `DamageCommands` are aware of the source
 *   weapon's traits, enabling feat logic like GWM or HAM to function
 *   correctly without the command needing a direct reference to the weapon.
 * - Added `hasDisadvantage` check to the attack roll, allowing status
 *   effects (like the Slasher feat's Grievous Wound) to influence accuracy.
 *
 * @file src/commands/factory/AbilityCommandFactory.ts
 */
import { CombatCharacter, Ability, CombatState, SelectedSpellTarget } from '@/types/combat';
import { GameState } from '@/types';
import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand';
/**
 * Command for executing a weapon attack.
 * Handles attack rolls, critical hits, and reaction windows (conceptually).
 */
export declare class WeaponAttackCommand implements SpellCommand {
    readonly id: string;
    readonly description: string;
    readonly metadata: CommandMetadata;
    private ability;
    private caster;
    private targets;
    private context;
    constructor(ability: Ability, caster: CombatCharacter, targets: CombatCharacter[], context: CommandContext);
    private getLiveCaster;
    private getMatchingHeldWeaponAugment;
    private getSpellcastingAbilityModifier;
    private getHeldWeaponDamageDice;
    private applyHeldWeaponAugmentToDamageEffect;
    private consumeOneShotHeldWeaponAugment;
    private applyDefensiveHitReaction;
    execute(state: CombatState): Promise<CombatState>;
    /**
     * Spend one-shot attack-roll riders only after a matching weapon attack is
     * actually rolled. Outgoing riders live on the attacker, incoming riders live
     * on the target; checking the direction keeps Frostbite and target-side
     * attack marks from consuming each other.
     */
    private consumeNextAttackRollRiders;
    private getRiderAreaTargets;
}
export declare class AbilityCommandFactory {
    private static createEffectCommand;
    private static createDirectAbilityCommand;
    static createCommands(ability: Ability, caster: CombatCharacter, targets: CombatCharacter[], gameState: GameState, selectedSpellTargets?: SelectedSpellTarget[], requestReaction?: (attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_take_damage', options: any[]) => Promise<string | null>): SpellCommand[];
}
