/**
 * @file effectRouting.ts
 * Applies shared trigger and target gates before dispatching an ordinary effect.
 *
 * Extracted from SpellCommandFactory without changing rule bodies or random
 * draws. The public factory still controls cast preparation and command order.
 * New spell behavior belongs with its family; broad rules changes remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 21:02:48
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SpellEffect } from '@/types/spells'
import { SpellCommand, CommandContext } from '../../base/SpellCommand'
import { ReactiveEffectCommand } from '../../effects/ReactiveEffectCommand'
import { RegisterRiderCommand } from '../../effects/RegisterRiderCommand'
import { TargetValidationUtils } from '@/systems/spells/targeting/TargetValidationUtils'
import { isDeferredAreaZoneTrigger } from '@/hooks/spellEffectUtils'
import { filterSelectedTargetsForCreatures } from './targets'
import { buildEffectFamilyCommand } from './effectRegistry'

/**
 * Create a single command from an effect, filtering targets if necessary
 */
export function isPersistentAreaZoneTrigger(effect: SpellEffect): boolean {
  // Composite source rows are delayed unless their areaTiming or controlled
  // entity explicitly requires an initial command to create live state.
  return isDeferredAreaZoneTrigger(effect)
}



export function isScheduledRuntimeTrigger(effect: SpellEffect): boolean {
  return ['turn_start', 'turn_end'].includes(effect.trigger.type)
}



export function createEffectCommand(
  effect: SpellEffect,
  context: CommandContext
): SpellCommand | null {
  // Check for target filtering
  if (effect.condition?.targetFilter || context.targets.length > 0) {
    // We need to filter targets.
    // The CommandContext has `targets`. The command itself might use them.
    // Most commands use `context.targets`.
    // If we filter here, we should pass a modified context.

    let filteredTargets = context.targets;

    const targetFilter = effect.condition?.targetFilter;
    if (targetFilter) {
      filteredTargets = context.targets.filter(t => TargetValidationUtils.matchesFilter(t, targetFilter));

      if (filteredTargets.length === 0 && context.targets.length > 0) {
        // All targets filtered out
        return null;
      }
    }

    // Create a new context with filtered targets if they changed.
    // This intentionally performs a shallow context copy so callers can observe
    // only the filtered target set without mutating shared command state.
    if (filteredTargets.length !== context.targets.length) {
      context = {
        ...context,
        targets: filteredTargets,
        // If a creature filter removes targets, mirror that reduction in the
        // rich target envelope so future object/point commands do not see stale
        // creature refs that legacy command execution already rejected.
        selectedSpellTargets: filterSelectedTargetsForCreatures(context.selectedSpellTargets, filteredTargets)
      };
    }
  }

  // Narrow on the REACTIVE discriminator so the constructor receives a real
  // ReactiveEffect instead of a cast SpellEffect. The trigger-type check is
  // kept as a second condition so routing stays limited to reactive triggers.
  if (effect.type === 'REACTIVE' && ['on_target_move', 'on_target_attack', 'on_target_cast', 'on_caster_action'].includes(effect.trigger.type)) {
    return new ReactiveEffectCommand(effect, context)
  }

  if (effect.trigger.type === 'on_attack_hit') {
    return new RegisterRiderCommand(effect, context)
  }

  if (isPersistentAreaZoneTrigger(effect)) {
    // Area-zone triggers are registered by useAbilitySystem/createSpellZoneFromAoEParams.
    // Returning null here prevents delayed zone effects from also resolving immediately.
    return null
  }

  if (isScheduledRuntimeTrigger(effect)) {
    // Bare turn-start/end effects are registered by useAbilitySystem as target-bound
    // scheduled effects. They should not resolve during the initial cast.
    return null
  }

  // Pass conditional endings to the command context to provide a runtime bridge
  if (effect.conditionalEndings && effect.conditionalEndings.length > 0) {
    context = { ...context, conditionalEndings: effect.conditionalEndings }
  }

  return buildEffectFamilyCommand(effect, context)
}
