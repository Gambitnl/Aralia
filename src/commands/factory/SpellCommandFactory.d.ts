/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 21:24:56
 * Dependents: commands/index.ts
 * Imports: 33 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { Spell } from '@/types/spells';
import { CombatCharacter, SelectedSpellTarget } from '@/types/combat';
import { SpellCommand } from '../base/SpellCommand';
import { GameState } from '@/types';
import { Plane } from '@/types/planes';
export declare class SpellCommandFactory {
    /**
     * Create all commands for a spell
     */
    static createCommands(spell: Spell, caster: CombatCharacter, targets: CombatCharacter[], castAtLevel: number, gameState: GameState, playerInput?: string, currentPlane?: Plane, requestReaction?: (attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_take_damage', options: any[]) => Promise<string | null>, selectedSpellTargets?: SelectedSpellTarget[]): Promise<SpellCommand[]>;
    private static withConcentrationLifecycle;
    private static isEnhanceAbilityPerTargetChoice;
    private static shouldUseSpellAttackCommand;
    /**
     * Create a single command from an effect, filtering targets if necessary
     */
    private static isPersistentAreaZoneTrigger;
    private static isScheduledRuntimeTrigger;
    private static createCommand;
    /**
     * Apply scaling formulas to effect
     * TODO: This manual scaling logic duplicates `resolveScalableNumber` from `src/types/spells.ts`.
     * We should refactor this to use the shared utility, especially for resolving numeric values.
     */
    private static applyScaling;
    /**
     * Apply slot level scaling (e.g., +1d6 per level)
     */
    private static applySlotLevelScaling;
    private static createFireArtifactCommand;
    /**
     * Apply character level scaling (cantrips)
     */
    private static applyCharacterLevelScaling;
    /**
     * Preserve Frostbite-style nested damage riders when scaling cantrips.
     * Top-level damage rows still scale the same way, but attack-roll modifier
     * rows can carry their own damage payload and should not be left behind.
     */
    private static applyScaledDamageDice;
    /**
     * Build the rich target envelope for the current creature-only command path.
     *
     * Object and point refs enter through the optional factory argument, but most
     * existing callers still pass only CombatCharacter targets. This adapter keeps
     * those callers visible to future command code without changing their behavior.
     */
    private static createCreatureTargetRefs;
    /**
     * Keep selected creature refs aligned with filtered command targets.
     *
     * Filters such as "Undead only" apply to creature targets. Non-creature refs
     * are preserved because object and point eligibility belongs to the object
     * targeting resolver, not creature taxonomy filters.
     */
    private static filterSelectedTargetsForCreatures;
}
