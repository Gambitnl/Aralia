// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:38:43
 * Dependents: commands/factory/AbilityCommandFactory.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { ActiveEffect, CombatCharacter, CombatState } from '../../types/combat'
import type { UtilityEffect } from '../../types/spells'
import { getDistance } from '../../utils/combatUtils'

/**
 * Activates Find Familiar-style shared senses as a structured caster effect.
 *
 * This command intentionally stops at the runtime-state boundary. It records
 * which familiar should act as the observer and how far the telepathic link can
 * reach, but it does not directly switch the 2D or 3D camera/visibility system.
 * Keeping that visual handoff separate makes the remaining combat-map gap
 * explicit instead of hiding it inside a utility action.
 */

export interface FamiliarSharedSensesOptions {
  familiarId?: string;
}

function createSharedSensesEffect(): UtilityEffect {
  return {
    type: 'UTILITY',
    utilityType: 'other',
    description: 'Uses a familiar as the sensory observer',
    trigger: { type: 'immediate' },
    condition: { type: 'always' }
  }
}

export class FamiliarSharedSensesCommand extends BaseEffectCommand {
  constructor(
    protected context: CommandContext,
    private options: FamiliarSharedSensesOptions = {}
  ) {
    super(createSharedSensesEffect(), context)
  }

  execute(state: CombatState): CombatState {
    const caster = this.getCaster(state)
    const familiar = this.findSharedSensesFamiliar(state, caster)

    if (!familiar) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${caster.name} has no familiar available for shared senses`,
        characterId: caster.id,
        data: {
          spellId: this.context.spellId,
          familiarId: this.options.familiarId
        }
      })
    }

    const telepathyRange = familiar.summonMetadata?.telepathyRange ?? 100
    const distanceFeet = getDistance(caster.position, familiar.position) * 5

    if (distanceFeet > telepathyRange) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${familiar.name} is too far away for ${caster.name} to share senses`,
        characterId: caster.id,
        targetIds: [familiar.id],
        data: {
          spellId: this.context.spellId,
          familiarId: familiar.id,
          telepathyRange,
          distanceFeet
        }
      })
    }

    const activeEffect = this.createActiveEffect(familiar, state.turnState.currentTurn, telepathyRange)
    const existingEffects = caster.activeEffects || []
    const nextCaster: CombatCharacter = {
      ...caster,
      activeEffects: [
        ...existingEffects.filter(effect => effect.id !== activeEffect.id && !effect.mechanics?.familiarSharedSenses),
        activeEffect
      ]
    }

    return this.addLogEntry({
      ...state,
      characters: state.characters.map(character =>
        character.id === caster.id ? nextCaster : character
      )
    }, {
      type: 'action',
      message: `${caster.name} uses ${familiar.name}'s senses`,
      characterId: caster.id,
      targetIds: [familiar.id],
      data: {
        spellId: this.context.spellId,
        familiarId: familiar.id,
        entityType: familiar.summonMetadata?.entityType,
        formName: familiar.summonMetadata?.formName,
        sourceName: familiar.summonMetadata?.sourceName,
        telepathyRange,
        sharedSenses: true
      }
    })
  }

  get description(): string {
    return `${this.context.caster.name} uses a familiar's senses`
  }

  private createActiveEffect(
    familiar: CombatCharacter,
    currentTurn: number,
    telepathyRange: number
  ): ActiveEffect {
    return {
      id: `familiar-shared-senses-${this.context.caster.id}`,
      spellId: this.context.spellId,
      casterId: this.context.caster.id,
      sourceName: this.context.spellName,
      type: 'utility',
      duration: { type: 'rounds', value: 1 },
      startTime: currentTurn,
      mechanics: {
        familiarSharedSenses: true,
        observerCharacterId: familiar.id,
        telepathyRange,
        sharedSensesCost: familiar.summonMetadata?.sharedSensesCost
      }
    }
  }

  private findSharedSensesFamiliar(state: CombatState, caster: CombatCharacter): CombatCharacter | undefined {
    return state.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.casterId === caster.id &&
      character.summonMetadata?.spellId === this.context.spellId &&
      character.summonMetadata?.sharedSenses &&
      (this.options.familiarId ? character.id === this.options.familiarId : this.isFamiliar(character))
    )
  }

  private isFamiliar(character: CombatCharacter): boolean {
    return character.summonMetadata?.entityType === 'familiar' ||
      character.summonMetadata?.sourceName === 'Find Familiar'
  }
}
