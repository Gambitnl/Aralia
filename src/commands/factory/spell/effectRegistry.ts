/**
 * @file effectRegistry.ts
 * Maps ordinary effect families to their existing command implementations.
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
 * Dependents: commands/factory/spell/effectRouting.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { SpellEffect, StatusConditionEffect } from '@/types/spells'
import { SpellCommand, CommandContext } from '../../base/SpellCommand'
import { DamageCommand } from '../../effects/DamageCommand'
import { HealingCommand } from '../../effects/HealingCommand'
import { StatusConditionCommand } from '../../effects/StatusConditionCommand'
import { MovementCommand } from '../../effects/MovementCommand'
import { SummoningCommand } from '../../effects/SummoningCommand'
import { TerrainCommand } from '../../effects/TerrainCommand'
import { UtilityCommand } from '../../effects/UtilityCommand'
import { DefensiveCommand } from '../../effects/DefensiveCommand'
import { AttackRollModifierCommand } from '../../effects/AttackRollModifierCommand'

type EffectFamily = 'DAMAGE' | 'HEALING' | 'STATUS_CONDITION' | 'ATTACK_ROLL_MODIFIER' | 'MOVEMENT' | 'SUMMONING' | 'TERRAIN' | 'UTILITY' | 'DEFENSIVE'
type EffectBuilders = {
  [K in EffectFamily]: (effect: Extract<SpellEffect, { type: K }>, context: CommandContext) => SpellCommand
}

const effectBuilders: EffectBuilders = {
  DAMAGE: (effect, context) => new DamageCommand(effect, context),
  HEALING: (effect, context) => new HealingCommand(effect, context),
  STATUS_CONDITION: (effect, context) => new StatusConditionCommand(effect, context),
  ATTACK_ROLL_MODIFIER: (effect, context) => new AttackRollModifierCommand(effect, context),
  MOVEMENT: (effect, context) => new MovementCommand(effect, context),
  SUMMONING: (effect, context) => new SummoningCommand(effect, context),
  TERRAIN: (effect, context) => new TerrainCommand(effect, context),
  UTILITY: (effect, context) => {
    // Older control records keep Charmed inside a utility row. Preserve the
    // status command's save and domination owner instead of generic logging.
    if ((effect as { statusCondition?: unknown }).statusCondition && effect.summonControl?.summonsNewEntity === false) {
      return new StatusConditionCommand(effect as unknown as StatusConditionEffect, context)
    }
    return new UtilityCommand(effect, context)
  },
  DEFENSIVE: (effect, context) => new DefensiveCommand(effect, context)
}

export function buildEffectFamilyCommand(effect: SpellEffect, context: CommandContext): SpellCommand | null {
  if (!Object.hasOwn(effectBuilders, effect.type)) {
    console.warn(`Unknown effect type: ${effect.type}`)
    return null
  }
  // The discriminator chooses the matching typed builder. TypeScript loses that
  // correlation during indexed access; keep the assertion at this one boundary.
  const build = effectBuilders[effect.type as EffectFamily] as (effect: SpellEffect, context: CommandContext) => SpellCommand
  return build(effect, context)
}
