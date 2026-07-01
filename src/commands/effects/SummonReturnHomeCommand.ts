// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 30/06/2026, 13:25:12
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
import { CombatCharacter, CombatState } from '../../types/combat'
import type { UtilityEffect } from '../../types/spells'

export interface ReturnHomeSummonOptions {
  summonId?: string
  summonReturnHomeAction?: 'no_agreement' | 'service_complete'
}

function createReturnHomeSummonEffect(description: string): UtilityEffect {
  return {
    type: 'UTILITY',
    utilityType: 'other',
    description,
    trigger: { type: 'immediate' },
    condition: { type: 'always' }
  }
}

export class SummonReturnHomeCommand extends BaseEffectCommand {
  constructor(
    protected context: CommandContext,
    private options: ReturnHomeSummonOptions = {}
  ) {
    super(createReturnHomeSummonEffect('Returns a spell-created ally to its home plane'), context)
  }

  execute(state: CombatState): CombatState {
    const caster = this.getCaster(state)
    const returningSummon = this.findReturningSummon(state, caster)

    if (!returningSummon) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${caster.name} has no ally to return home`,
        characterId: caster.id,
        data: {
          spellId: this.context.spellId,
          summonId: this.options.summonId,
          summonReturnHomeAction: this.options.summonReturnHomeAction
        }
      })
    }

    const sourceName = returningSummon.summonMetadata?.sourceName ?? this.context.spellName
    const summonLabel = returningSummon.summonMetadata?.formName ?? returningSummon.summonMetadata?.entityType ?? returningSummon.name
    const returnHomeAction = this.options.summonReturnHomeAction ?? 'service_complete'

    return this.addLogEntry({
      ...state,
      characters: state.characters.filter(character => character.id !== returningSummon.id)
    }, {
      type: 'action',
      message: `${caster.name} sends ${returningSummon.name} back to its home plane`,
      characterId: caster.id,
      targetIds: [returningSummon.id],
      data: {
        spellId: returningSummon.summonMetadata?.spellId ?? this.context.spellId,
        casterId: returningSummon.summonMetadata?.casterId ?? caster.id,
        removedSummonId: returningSummon.id,
        entityType: returningSummon.summonMetadata?.entityType,
        formName: returningSummon.summonMetadata?.formName,
        sourceName,
        summonLabel,
        summonReturnHomeAction: returnHomeAction,
        returnHomeOutcome: 'return_home_plane'
      }
    })
  }

  get description(): string {
    return `${this.context.caster.name} returns a summoned ally home`
  }

  private findReturningSummon(state: CombatState, caster: CombatCharacter): CombatCharacter | undefined {
    return state.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.casterId === caster.id &&
      character.summonMetadata?.spellId === this.context.spellId &&
      character.summonMetadata?.control?.entityType === 'planar_ally' &&
      (
        character.summonMetadata?.travelDetails?.returnOn !== undefined ||
        character.summonMetadata?.travelDetails?.noAgreement !== undefined
      ) &&
      (this.options.summonId ? character.id === this.options.summonId : true)
    )
  }
}
