/**
 * @file concentration.ts
 * Keeps concentration and taunt transitions in their original command order.
 *
 * Extracted from SpellCommandFactory without changing rule bodies or random
 * draws. The public factory still controls cast preparation and command order.
 * New spell behavior belongs with its family; broad rules changes remain separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 24/10/2026, 21:02:48
 * Dependents: commands/factory/SpellCommandFactory.ts, commands/factory/spell/movement.ts, commands/factory/spell/utilityBridges.ts, commands/factory/spell/weaponBridges.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell } from '@/types/spells'
import { CombatCharacter, CombatState } from '@/types/combat'
import { SpellCommand, CommandContext, CommandMetadata } from '../../base/SpellCommand'
import { StartConcentrationCommand, BreakConcentrationCommand } from '../../effects/ConcentrationCommands'
import { generateId } from '@/utils/combat'
import { breakTauntsForEvent } from '@/systems/combat/tauntConstraint'

/** Ends caster-owned taunts before a spell affects a different enemy. */
export class TauntSpellCastBreakCommand implements SpellCommand {
  public readonly id = generateId()
  public readonly description: string
  public readonly metadata: CommandMetadata

  constructor(
    private readonly spell: Spell,
    private readonly caster: CombatCharacter,
    private readonly context: CommandContext
  ) {
    this.description = `Checks ${spell.name} against active taunt constraints`
    this.metadata = {
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: context.targets.map(target => target.id),
      effectType: 'taunt_break_check',
      timestamp: Date.now()
    }
  }

  execute(state: CombatState): CombatState {
    const result = breakTauntsForEvent(state.characters, {
      event: 'caster_casts_spell_on_other_enemy',
      casterId: this.caster.id,
      targetIds: this.context.targets.map(target => target.id)
    })
    if (result.characters === state.characters) {
      return state
    }

    return {
      ...state,
      characters: result.characters,
      combatLog: [
        ...state.combatLog,
        ...result.breaks.map(record => ({
          id: generateId(),
          timestamp: Date.now(),
          type: 'status' as const,
          message: `${record.spellName} ends because its caster casts ${this.spell.name} on another enemy.`,
          characterId: record.casterId,
          targetIds: [record.targetId],
          data: { spellId: record.spellId, tauntBreakEvent: record.event }
        }))
      ]
    }
  }
}



// ... (rest of the file remains same)

export function withConcentrationLifecycle(
  commands: SpellCommand[],
  spell: Spell,
  caster: CombatCharacter,
  context: CommandContext
): SpellCommand[] {
  // Concentration setup must wrap every successful spell command path, not
  // only the generic effect loop. Spell attacks and bridge commands often
  // return early after building a single runtime command, so they need the
  // same break-then-start contract to avoid stale concentration artifacts.
  const lifecycleCommands = [...commands]
  // Casting a new concentration spell already drops the old concentration
  // below. Non-concentration spells need this explicit event check so a
  // caster cannot keep Compelled Duel while targeting another enemy.
  if (!spell.duration.concentration && caster.concentratingOn) {
    lifecycleCommands.unshift(new TauntSpellCastBreakCommand(spell, caster, context))
  }
  if (spell.duration.concentration && caster.concentratingOn) {
    lifecycleCommands.unshift(new BreakConcentrationCommand(context))
  }

  if (spell.duration.concentration) {
    lifecycleCommands.push(new StartConcentrationCommand(spell, context))
  }
  return lifecycleCommands
}
