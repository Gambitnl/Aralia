/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 12/06/2026, 23:58:58
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, systems/spells/targeting/TargetResolver.ts, utils/combat/combatAI.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { CombatCharacter } from '@/types/combat';
import type { TargetConditionFilter } from '@/types/spells';
/**
 * Utility for validating spell targets against constraints.
 * Moved from SpellCommandFactory to decouple Systems from Commands.
 */
export declare class TargetValidationUtils {
    /**
     * Read the target's consent marker when a spell requires a willing creature.
     *
     * Most combatants do not expose a willingness field yet, so unknown consent
     * stays permissive to preserve existing ally-targeting flows. When a UI,
     * scenario, or future agent marks a target as explicitly unwilling, willing-
     * target spells can now reject that target instead of ignoring the spell text.
     */
    private static getExplicitWillingness;
    /**
     * Read all creature taxonomy labels from the combat character.
     *
     * Spell targeting is in a migration period: newer callers put taxonomy on
     * `CombatCharacter.creatureTypes`, while older monster adapters still place
     * it under `stats.creatureTypes`. This helper preserves both sources so
     * player targeting, effect filters, and AI planning can agree without
     * deleting either field prematurely.
     */
    static getCreatureTypes(target: CombatCharacter): string[];
    /**
     * Check if a target matches the filter
     */
    static matchesFilter(target: CombatCharacter, filter: TargetConditionFilter): boolean;
}
