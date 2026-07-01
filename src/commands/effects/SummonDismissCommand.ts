// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 30/06/2026, 02:41:57
 * Dependents: commands/factory/AbilityCommandFactory.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BaseEffectCommand } from '../base/BaseEffectCommand';
import { CommandContext } from '../base/SpellCommand';
import { CombatCharacter, CombatState } from '../../types/combat';
import type { UtilityEffect } from '../../types/spells';

/**
 * This command removes a dismissable spell-created summon from combat state.
 *
 * The summon runtime already stores dismissAction and dismissable metadata on
 * the created actor. This bridge turns that metadata into an executable combat
 * action for non-Familiar summons such as Find Steed without reusing the
 * familiar pocket-dimension flow.
 *
 * Called by: AbilityCommandFactory for generated summon-dismiss abilities.
 * Depends on: summon metadata on the acting combat character and the source
 * spell id carried through the ability command context.
 */

export interface DismissSummonOptions {
  summonId?: string;
}

function createDismissSummonEffect(description: string): UtilityEffect {
  return {
    type: 'UTILITY',
    utilityType: 'other',
    description,
    trigger: { type: 'immediate' },
    condition: { type: 'always' }
  }
}

export class DismissSummonCommand extends BaseEffectCommand {
  constructor(
    protected context: CommandContext,
    private options: DismissSummonOptions = {}
  ) {
    super(createDismissSummonEffect('Dismisses a spell-created summon'), context)
  }

  execute(state: CombatState): CombatState {
    const caster = this.getCaster(state)
    const dismissableSummon = this.findDismissableSummon(state, caster)

    if (!dismissableSummon) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${caster.name} has no dismissable summon to dismiss`,
        characterId: caster.id,
        data: {
          spellId: this.context.spellId,
          summonId: this.options.summonId
        }
      })
    }

    const sourceName = dismissableSummon.summonMetadata?.sourceName ?? this.context.spellName
    const summonLabel = dismissableSummon.summonMetadata?.formName ?? dismissableSummon.summonMetadata?.entityType ?? dismissableSummon.name

    return this.addLogEntry({
      ...state,
      characters: state.characters.filter(character => character.id !== dismissableSummon.id)
    }, {
      type: 'action',
      message: `${caster.name} dismisses ${dismissableSummon.name}`,
      characterId: caster.id,
      targetIds: [dismissableSummon.id],
      data: {
        spellId: dismissableSummon.summonMetadata?.spellId ?? this.context.spellId,
        casterId: dismissableSummon.summonMetadata?.casterId ?? caster.id,
        removedSummonId: dismissableSummon.id,
        entityType: dismissableSummon.summonMetadata?.entityType,
        formName: dismissableSummon.summonMetadata?.formName,
        sourceName,
        summonLabel,
        dismissAction: dismissableSummon.summonMetadata?.dismissAction ?? 'action',
        summonDismissAction: 'dismiss'
      }
    })
  }

  get description(): string {
    return `${this.context.caster.name} dismisses a controlled summon`
  }

  private findDismissableSummon(state: CombatState, caster: CombatCharacter): CombatCharacter | undefined {
    return state.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.casterId === caster.id &&
      character.summonMetadata?.spellId === this.context.spellId &&
      character.summonMetadata?.dismissable &&
      character.summonMetadata?.entityType !== 'familiar' &&
      (this.options.summonId ? character.id === this.options.summonId : true)
    )
  }
}
