/**
 * @file utilityBridges.ts
 * Builds the Elemental Bane and Grasping Vine special command paths.
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
 * Dependents: commands/factory/SpellCommandFactory.ts, commands/factory/spell/specialSpellRegistry.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, UtilityEffect, isUtilityEffect } from '@/types/spells'
import { SpellCommand } from '../../base/SpellCommand'
import { type EnhanceAbilityChoiceMap } from '../../effects/EnhanceAbilityCommand'
import { ElementalBaneCommand } from '../../effects/ElementalBaneCommand'
import { GraspingVineCommand } from '../../effects/GraspingVineCommand'
import { applyScaling } from './scaling'
import { withConcentrationLifecycle } from './concentration'
import { SpellBridgeContext } from './bridgeContext'

export function isEnhanceAbilityPerTargetChoice(
  spell: Spell,
  choicesByTargetId: EnhanceAbilityChoiceMap | undefined
): choicesByTargetId is EnhanceAbilityChoiceMap {
  return spell.id === 'enhance-ability' &&
    !!spell.targeting.perTargetChoice &&
    !!choicesByTargetId &&
    Object.keys(choicesByTargetId).length > 0
}

export function buildUtilityBridgesCommands(input: SpellBridgeContext): SpellCommand[] | undefined {
  const { spell, caster, context, activeEffects, effectiveCastLevel } = input


    // Elemental Bane's utility row is a cast-time save plus a delayed damage
    // event. Route it into its explicit owner before generic utility narration
    // can discard the chosen type and recurring damage state.
    if (spell.id === 'elemental-bane') {
      const elementalBaneEffect = activeEffects.find(isUtilityEffect)
      if (elementalBaneEffect) {
        const scaledEffect = applyScaling(
          elementalBaneEffect,
          spell.level,
          effectiveCastLevel,
          caster.level
        ) as UtilityEffect
        return withConcentrationLifecycle([
          new ElementalBaneCommand(scaledEffect, context)
        ], spell, caster, context)
      }
    }


    // Grasping Vine is the one live composite trigger whose same attack fires
    // immediately and on later Bonus Actions. Its command stores the vine
    // origin and delegates all three hit rows through one shared event owner.
    if (spell.id === 'grasping-vine') {
      const scaledEffects = activeEffects.map(effect =>
        applyScaling(effect, spell.level, effectiveCastLevel, caster.level)
      )
      return withConcentrationLifecycle([
        new GraspingVineCommand(context, scaledEffects, 'initial_cast')
      ], spell, caster, context)
    }

  return undefined
}
