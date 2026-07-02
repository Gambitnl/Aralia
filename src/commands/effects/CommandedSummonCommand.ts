// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/07/2026, 14:29:58
 * Dependents: commands/factory/AbilityCommandFactory.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { CombatState } from '../../types/combat'
import type { UtilityEffect } from '../../types/spells'

/**
 * This command records a generic order being given to a controlled summon.
 *
 * Some spells create helpers that can be commanded but do not have a bespoke
 * attack, damage roll, or stat block action yet. The summon runtime gives those
 * helpers a normal ability button, and this command makes that button execute
 * through the same combat log and command pipeline as other spell-created
 * actions. It intentionally does not invent task completion, pathing, servant
 * chores, or structure behavior; those remain owned by later spell-specific
 * runtime slices.
 *
 * Called by: AbilityCommandFactory for generated commanded-summon abilities.
 * Depends on: summon metadata on the acting combat character.
 */

export interface CommandedSummonOptions {
  description?: string;
}

export interface AnimateDeadControlWindowAdvance {
  elapsedHours: number;
}

function createCommandedSummonEffect(description?: string): UtilityEffect {
  // This lightweight utility effect lets the shared command base handle common
  // spell-command plumbing while the concrete execute method below records the
  // player-visible order. The description is copied from structured summon data
  // when available so the log keeps the spell-authored intent.
  return {
    type: 'UTILITY',
    utilityType: 'other',
    description: description ?? 'Issues a command to a controlled summon',
    trigger: { type: 'immediate' },
    condition: { type: 'always' }
  }
}

export class CommandedSummonCommand extends BaseEffectCommand {
  constructor(
    protected context: CommandContext,
    private options: CommandedSummonOptions = {}
  ) {
    super(createCommandedSummonEffect(options.description), context)
  }

  execute(state: CombatState): CombatState {
    const actor = this.getCaster(state)
    const metadata = actor.summonMetadata

    // Only spell-created controlled actors should use this generic command.
    // Normal class and weapon abilities should keep using their existing
    // command families so this bridge does not become a catch-all utility sink.
    if (!actor.isSummon || !metadata) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} is not a controlled summon`,
        characterId: actor.id,
        data: {
          spellId: this.context.spellId,
          commandSurface: 'controlled-summon'
        }
      })
    }

    const commandDescription = this.options.description ?? metadata.sourceName ?? this.context.spellName
    const commandsPerTurn = metadata.commandsPerTurn ?? 1
    const commandsUsedThisTurn = metadata.commandsUsedThisTurn ?? 0

    // Persistent controlled undead stop obeying when their authored control
    // window expires. Block the generic command button before spending the
    // per-turn command counter so Create Undead and Animate Dead can share this
    // expiry gate without each spell inventing its own command command.
    if (metadata.control?.entityType === 'controlled_undead' && (metadata.durationRemaining ?? 1) <= 0) {
      const expiredSourceName = metadata.sourceName ?? this.context.spellName
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name}'s ${expiredSourceName} control has expired.`,
        characterId: actor.id,
        data: {
          spellId: metadata.spellId ?? this.context.spellId,
          casterId: metadata.casterId,
          sourceName: metadata.sourceName,
          commandSurface: 'controlled-summon',
          controlState: 'expired',
          durationRemaining: metadata.durationRemaining ?? 0,
          commandsUsedThisTurn
        }
      })
    }

    // The spell data says how many orders this helper can carry out each turn.
    // Enforce that counter on the summon itself so repeated button presses do
    // not quietly exceed the spell-authored command cadence.
    if (commandsUsedThisTurn >= commandsPerTurn) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} has already followed its command this turn`,
        characterId: actor.id,
        data: {
          spellId: metadata.spellId ?? this.context.spellId,
          casterId: metadata.casterId,
          sourceName: metadata.sourceName,
          commandSurface: 'controlled-summon',
          commandsPerTurn,
          commandsUsedThisTurn
        }
      })
    }

    // Store the spent command on the actor's summon metadata. This is separate
    // from normal action economy because some spells use "one command per turn"
    // language in addition to the action/bonus/free cost paid to issue it.
    const updatedActor = {
      ...actor,
      summonMetadata: {
        ...metadata,
        commandsUsedThisTurn: commandsUsedThisTurn + 1
      }
    }

    return this.addLogEntry({
      ...state,
      characters: state.characters.map(character =>
        character.id === actor.id ? updatedActor : character
      )
    }, {
      type: 'action',
      message: `${actor.name} follows the command`,
      characterId: actor.id,
      data: {
        spellId: metadata.spellId ?? this.context.spellId,
        casterId: metadata.casterId,
        sourceName: metadata.sourceName,
        entityType: metadata.entityType,
        commandSurface: 'controlled-summon',
        commandDescription,
        commandsPerTurn,
        commandsUsedThisTurn: commandsUsedThisTurn + 1
      }
    })
  }

  get description(): string {
    return `${this.context.caster.name} follows a controlled-summon command`
  }
}

export function advanceAnimateDeadControlWindows(
  state: CombatState,
  advance: AnimateDeadControlWindowAdvance
): CombatState {
  const elapsedHours = Math.max(0, advance.elapsedHours)

  // This helper is intentionally narrow: it advances Animate Dead's durable
  // 24-hour control window without pretending the combat turn manager is a
  // complete world-clock scheduler for every long-lived spell.
  if (elapsedHours === 0) {
    return state
  }

  let expiredActors: Array<{ id: string; name: string; casterId?: string; previousDuration: number }> = []
  const characters = state.characters.map(character => {
    const metadata = character.summonMetadata

    if (
      !character.isSummon ||
      metadata?.spellId !== 'animate-dead' ||
      metadata.control?.entityType !== 'controlled_undead' ||
      typeof metadata.durationRemaining !== 'number'
    ) {
      return character
    }

    const nextDuration = Math.max(0, metadata.durationRemaining - elapsedHours)
    if (metadata.durationRemaining > 0 && nextDuration === 0) {
      expiredActors = [
        ...expiredActors,
        {
          id: character.id,
          name: character.name,
          casterId: metadata.casterId,
          previousDuration: metadata.durationRemaining
        }
      ]
    }

    return {
      ...character,
      summonMetadata: {
        ...metadata,
        durationRemaining: nextDuration
      }
    }
  })

  if (expiredActors.length === 0) {
    return {
      ...state,
      characters
    }
  }

  return {
    ...state,
    characters,
    combatLog: [
      ...state.combatLog,
      ...expiredActors.map(actor => ({
        id: `animate_dead_expiry_${actor.id}_${Date.now()}`,
        timestamp: Date.now(),
        type: 'status' as const,
        message: `${actor.name}'s Animate Dead control window expires.`,
        characterId: actor.id,
        data: {
          spellId: 'animate-dead',
          casterId: actor.casterId,
          commandSurface: 'controlled-summon',
          controlState: 'expired_by_elapsed_time',
          previousDuration: actor.previousDuration,
          durationRemaining: 0,
          elapsedHours
        }
      }))
    ]
  }
}
