// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/08/2026, 13:57:36
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file applies Elemental Bane and stores its delayed damage-event rules.
 *
 * The spell's authored row is a utility effect because it changes resistance
 * and waits for later damage. This command resolves the initial Constitution
 * save, records the chosen damage type, and creates the status consumed by the
 * shared on-damage handler instead of leaving those mechanics in prose.
 *
 * Called by: SpellCommandFactory for the Elemental Bane live spell record.
 * Depends on: saving-throw utilities and combat status state.
 */

import type { CommandContext } from '../base/SpellCommand'
import { BaseEffectCommand } from '../base/BaseEffectCommand'
import type { UtilityEffect, DamageType } from '@/types/spells'
import type { CombatCharacter, CombatState, StatusEffect } from '@/types/combat'
import { calculateSpellDC, rollSavingThrow } from '@/utils/character'
import { generateId } from '@/utils/core'
import { SavePenaltySystem } from '@/systems/combat/SavePenaltySystem'
import { getRecurringMechanics } from '@/hooks/spellEffectUtils'

// ============================================================================
// Elemental Bane Application
// ============================================================================
// This command owns only the cast-time save and durable status. Actual damage
// remains with the normal damage owners after the target takes matching damage.
// ============================================================================

export class ElementalBaneCommand extends BaseEffectCommand<UtilityEffect> {
  constructor(effect: UtilityEffect, context: CommandContext) {
    super(effect, context)
  }

  async execute(state: CombatState): Promise<CombatState> {
    const caster = this.getCaster(state)
    const chosenDamageType = this.resolveChosenDamageType()

    if (!chosenDamageType) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${caster.name} must choose a valid Elemental Bane damage type.`,
        characterId: caster.id,
        data: {
          spellId: this.context.spellId,
          notes: this.context.playerInput
        }
      })
    }

    let nextState = state
    for (const targetSnapshot of this.context.targets) {
      const target = nextState.characters.find(character => character.id === targetSnapshot.id)
      if (!target) continue

      nextState = this.resolveTargetSave(nextState, caster, target, chosenDamageType)
    }

    return nextState
  }

  get description(): string {
    return `${this.context.caster.name} applies Elemental Bane`
  }

  private resolveTargetSave(
    state: CombatState,
    caster: CombatCharacter,
    target: CombatCharacter,
    chosenDamageType: DamageType
  ): CombatState {
    const savePenaltySystem = new SavePenaltySystem()
    const saveDc = calculateSpellDC(caster)
    const saveModifiers = savePenaltySystem.getActivePenalties(target)
    const saveResult = rollSavingThrow(target, 'Constitution', saveDc, saveModifiers)
    let nextState = savePenaltySystem.consumeNextSavePenalties(state, target.id)

    nextState = this.addLogEntry(nextState, {
      type: 'status',
      message: `${target.name} ${saveResult.success ? 'resists' : 'fails to resist'} Elemental Bane (${saveResult.total} vs DC ${saveDc}).`,
      characterId: target.id,
      targetIds: [target.id],
      data: {
        spellId: this.context.spellId,
        saveType: 'Constitution',
        saveTotal: saveResult.total,
        saveSucceeded: saveResult.success,
        notes: `Chosen damage type: ${chosenDamageType}`
      }
    })

    if (saveResult.success) {
      return nextState
    }

    const status = this.createElementalBaneStatus(chosenDamageType)
    const liveTarget = nextState.characters.find(character => character.id === target.id) ?? target

    return {
      ...nextState,
      characters: nextState.characters.map(character =>
        character.id === target.id
          ? {
              ...liveTarget,
              statusEffects: [
                ...liveTarget.statusEffects.filter(existing =>
                  existing.sourceSpellId !== this.context.spellId ||
                  existing.sourceCasterId !== caster.id
                ),
                status
              ]
            }
          : character
      )
    }
  }

  private resolveChosenDamageType(): DamageType | null {
    const allowedDamageTypes = this.effect.resistanceSuppression?.damageType ?? []
    const requestedType = this.context.playerInput?.trim().toLowerCase()

    if (!requestedType) return null

    return allowedDamageTypes.find(
      damageType => damageType.toLowerCase() === requestedType
    ) ?? null
  }

  private createElementalBaneStatus(chosenDamageType: DamageType): StatusEffect {
    const recurringDamage = getRecurringMechanics(this.effect).find(
      mechanic => mechanic.timing === 'on_damage' && mechanic.damage
    )

    return {
      id: `elemental_bane_${generateId()}`,
      name: `Elemental Bane (${chosenDamageType})`,
      type: 'debuff',
      description: this.effect.description,
      duration: this.resolveDurationRounds(),
      source: this.context.spellName,
      sourceSpellId: this.context.spellId,
      sourceCasterId: this.context.caster.id,
      resistanceSuppression: {
        damageTypes: [chosenDamageType],
        source: 'chosen_damage_type'
      },
      onDamageSpellEffect: recurringDamage?.damage
        ? {
            frequency: recurringDamage.frequency === 'every_time' ? 'every_time' : 'first_per_turn',
            damageDice: recurringDamage.damage.dice,
            damageType: 'triggering_damage_type'
          }
        : undefined
    }
  }

  private resolveDurationRounds(): number {
    const duration = this.context.effectDuration
    if (!duration || typeof duration.value !== 'number') return 10

    if (duration.type === 'rounds') return duration.value
    if (duration.type === 'minutes') return duration.value * 10
    if (duration.type === 'hours') return duration.value * 600

    return 10
  }
}
