import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { UtilityEffect } from '@/types/spells'
import { CombatCharacter, CombatState, StatusEffect } from '@/types/combat'
import { generateId } from '../../utils/idGenerator'

/**
 * This file applies the mechanical part of the Enhance Ability spell.
 *
 * Enhance Ability is stored as a utility spell because the spell asks the
 * caster to choose a different ability for each touched target. The normal
 * utility command can describe that choice, but it cannot change ability-check
 * rolls. This command bridges the selected per-target choices into the existing
 * character modifier channel that ability checks already read, while also
 * leaving a visible status effect for combat-map and character-sheet surfaces.
 *
 * Called by: SpellCommandFactory when an Enhance Ability cast carries
 * target-indexed choices from the combat input flow.
 * Depends on: CombatCharacter.modifiers.advantage and StatusEffect.modifiers.
 */

// ============================================================================
// Runtime Choice Payload
// ============================================================================
// The input modal collects choices outside the spell JSON and stores them on a
// temporary spell clone. This type names that payload so command creation and
// execution agree about how each target's chosen ability is carried.
// ============================================================================

export type EnhanceAbilityChoiceMap = Record<string, string>

// ============================================================================
// Enhance Ability Command
// ============================================================================
// This command is intentionally narrow. It handles the one structured utility
// spell whose mechanical outcome is "advantage on checks for a chosen ability"
// instead of expanding UtilityCommand into a catch-all buff engine.
// ============================================================================

export class EnhanceAbilityCommand extends BaseEffectCommand {
  constructor(
    effect: UtilityEffect,
    context: CommandContext,
    private readonly choicesByTargetId: EnhanceAbilityChoiceMap
  ) {
    super(effect, context)
  }

  execute(state: CombatState): CombatState {
    // Apply each chosen ability to the freshest target state. Earlier commands
    // in the same cast may already have updated these characters, so the base
    // helper resolves targets from the incoming combat state instead of using
    // the stale creation-time snapshots.
    let currentState = state

    for (const target of this.getTargets(currentState)) {
      const chosenAbility = this.choicesByTargetId[target.id]

      // A missing choice means the upstream prompt flow failed for this target.
      // Log the omission instead of guessing, because applying the wrong ability
      // would be worse than leaving a visible unresolved gap in the combat log.
      if (!chosenAbility) {
        currentState = this.addLogEntry(currentState, {
          type: 'status',
          message: `${target.name} has no Enhance Ability choice assigned`,
          characterId: target.id,
          targetIds: [target.id],
          data: { spellId: this.context.spellId }
        })
        continue
      }

      currentState = this.applyChosenAbility(currentState, target, chosenAbility)
    }

    return currentState
  }

  get description(): string {
    return `${this.context.spellName} grants chosen ability-check advantage`
  }

  // ==========================================================================
  // Target Application
  // ==========================================================================
  // This section writes the same outcome into two places on the character:
  // the existing modifier text that rollAbilityCheck already reads, and a
  // visible status effect that combat UI can show to the player.
  // ==========================================================================

  private applyChosenAbility(
    state: CombatState,
    target: CombatCharacter,
    chosenAbility: string
  ): CombatState {
    const advantageText = this.createAdvantageText(chosenAbility)
    const status = this.createStatusEffect(chosenAbility)

    // Preserve any existing character modifiers. Some characters receive racial
    // or item-based modifier arrays before combat; Enhance Ability should add to
    // that channel, not replace it.
    const currentModifiers = target.modifiers ?? {
      advantage: [],
      disadvantage: [],
      bonuses: []
    }

    // Avoid stacking duplicate advantage text if the same cast path is retried.
    // Different ability choices remain separate entries because higher-slot
    // casts can intentionally give different targets different abilities.
    const advantage = currentModifiers.advantage.includes(advantageText)
      ? currentModifiers.advantage
      : [...currentModifiers.advantage, advantageText]

    // Replace an existing visible Enhance Ability status from this caster/spell
    // on the same target. This keeps the map marker current without deleting
    // unrelated buffs or statuses from other sources.
    const statusEffects = [
      ...(target.statusEffects ?? []).filter(existing =>
        existing.source !== this.context.spellName ||
        existing.sourceCasterId !== this.context.caster.id ||
        !String(existing.name).startsWith('Enhance Ability')
      ),
      status
    ]

    const updatedState = this.updateCharacter(state, target.id, {
      modifiers: {
        ...currentModifiers,
        advantage
      },
      statusEffects
    })

    return this.addLogEntry(updatedState, {
      type: 'status',
      message: `${target.name} gains advantage on ${chosenAbility} ability checks from ${this.context.spellName}`,
      characterId: target.id,
      targetIds: [target.id],
      data: { statusId: status.id, chosenAbility, advantageText }
    })
  }

  private createStatusEffect(chosenAbility: string): StatusEffect {
    return {
      id: generateId(),
      name: `Enhance Ability (${chosenAbility})`,
      type: 'buff',
      description: `Advantage on ${chosenAbility} ability checks.`,
      duration: this.getDurationRounds(),
      source: this.context.spellName || this.context.spellId,
      sourceCasterId: this.context.caster.id,
      effect: { type: 'condition' },
      modifiers: {
        advantage: ['check']
      },
      visualEffect: 'enhance-ability'
    }
  }

  private createAdvantageText(chosenAbility: string): string {
    return `advantage on ${chosenAbility} ability checks from ${this.context.spellName}`
  }

  private getDurationRounds(): number {
    const duration = this.context.effectDuration

    // Enhance Ability lasts one hour in the current spell data. The command
    // factory normalizes unsupported units such as hours into `special`, so this
    // branch converts each special value as one hour worth of ten-round minutes.
    if (!duration) return 600
    if (duration.type === 'rounds') return duration.value
    if (duration.type === 'minutes') return duration.value * 10

    return Math.max(1, duration.value) * 600
  }
}
