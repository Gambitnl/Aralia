/**
 * Compatibility path for the existing spell trigger and duration helpers.
 * Pure rules are owned by systems/spells/effects/spellEffectRules; all original
 * exports remain available here for commands, hooks and unfinished callers.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: commands/effects/DamageCommand.ts, commands/effects/ElementalBaneCommand.ts, commands/effects/StatusConditionCommand.ts, commands/factory/spell/effectRouting.ts, hooks/ability/execution/spellExecutionFlow.ts, systems/spells/effects/trigger/areaTriggerProcessing.ts, systems/spells/effects/trigger/zoneLifecycle.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export * from '../systems/spells/effects/spellEffectRules';
