import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { CombatCharacter, CombatState, Position, PocketedSummon } from '../../types/combat'
import type { UtilityEffect } from '../../types/spells'

/**
 * These commands move a Find Familiar-style summon between the combat map and a
 * recoverable pocket state.
 *
 * The active summon runtime still creates familiars through SummoningCommand.
 * This file does not add player UI buttons yet. It provides the missing runtime
 * state transition so a future UI/action slice can dismiss a familiar without
 * destroying the bond, then restore that same familiar later.
 *
 * Called by: future familiar dismissal/reappearance action wiring.
 * Depends on: CombatState.pocketedSummons and summonMetadata identity fields.
 */

export interface FamiliarPocketOptions {
  familiarId?: string;
  position?: Position;
}

function createPocketEffect(description: string): UtilityEffect {
  return {
    type: 'UTILITY',
    utilityType: 'other',
    description,
    trigger: { type: 'immediate' },
    condition: { type: 'always' }
  }
}

export class DismissFamiliarToPocketCommand extends BaseEffectCommand {
  constructor(
    protected context: CommandContext,
    private options: FamiliarPocketOptions = {}
  ) {
    super(createPocketEffect('Dismisses a familiar into its pocket dimension'), context)
  }

  execute(state: CombatState): CombatState {
    const caster = this.getCaster(state)
    const familiar = this.findOnMapFamiliar(state, caster)

    if (!familiar) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${caster.name} has no on-map familiar to dismiss`,
        characterId: caster.id,
        data: {
          spellId: this.context.spellId,
          familiarId: this.options.familiarId
        }
      })
    }

    const pocketed: PocketedSummon = {
      summon: familiar,
      casterId: caster.id,
      spellId: familiar.summonMetadata?.spellId ?? this.context.spellId,
      dismissedTurn: state.turnState.currentTurn,
      lastKnownPosition: familiar.position,
      reason: 'familiar_pocket'
    }

    return this.addLogEntry({
      ...state,
      characters: state.characters.filter(character => character.id !== familiar.id),
      pocketedSummons: [
        ...(state.pocketedSummons || []).filter(entry => entry.summon.id !== familiar.id),
        pocketed
      ]
    }, {
      type: 'action',
      message: `${familiar.name} withdraws into its pocket dimension`,
      characterId: caster.id,
      targetIds: [familiar.id],
      data: {
        spellId: pocketed.spellId,
        familiarId: familiar.id,
        entityType: familiar.summonMetadata?.entityType,
        formName: familiar.summonMetadata?.formName,
        sourceName: familiar.summonMetadata?.sourceName,
        pocketState: 'dismissed'
      }
    })
  }

  get description(): string {
    return `${this.context.caster.name} dismisses a familiar into its pocket dimension`
  }

  private findOnMapFamiliar(state: CombatState, caster: CombatCharacter): CombatCharacter | undefined {
    return state.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.casterId === caster.id &&
      character.summonMetadata?.spellId === this.context.spellId &&
      character.summonMetadata?.dismissable &&
      (this.options.familiarId ? character.id === this.options.familiarId : this.isFamiliar(character))
    )
  }

  private isFamiliar(character: CombatCharacter): boolean {
    return character.summonMetadata?.entityType === 'familiar' ||
      character.summonMetadata?.sourceName === 'Find Familiar'
  }
}

export class RecallFamiliarFromPocketCommand extends BaseEffectCommand {
  constructor(
    protected context: CommandContext,
    private options: FamiliarPocketOptions = {}
  ) {
    super(createPocketEffect('Recalls a familiar from its pocket dimension'), context)
  }

  execute(state: CombatState): CombatState {
    const caster = this.getCaster(state)
    const pocketed = this.findPocketedFamiliar(state, caster)

    if (!pocketed) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${caster.name} has no pocketed familiar to recall`,
        characterId: caster.id,
        data: {
          spellId: this.context.spellId,
          familiarId: this.options.familiarId
        }
      })
    }

    const requestedPosition = this.options.position ?? pocketed.lastKnownPosition ?? caster.position
    const recallPosition = this.findRecallPosition(state, requestedPosition, caster.position, pocketed.summon.id)
    const recalledFamiliar: CombatCharacter = {
      ...pocketed.summon,
      position: recallPosition
    }

    return this.addLogEntry({
      ...state,
      characters: [...state.characters, recalledFamiliar],
      pocketedSummons: (state.pocketedSummons || []).filter(entry => entry.summon.id !== pocketed.summon.id)
    }, {
      type: 'action',
      message: `${recalledFamiliar.name} returns from its pocket dimension`,
      characterId: caster.id,
      targetIds: [recalledFamiliar.id],
      data: {
        spellId: pocketed.spellId,
        familiarId: recalledFamiliar.id,
        entityType: recalledFamiliar.summonMetadata?.entityType,
        formName: recalledFamiliar.summonMetadata?.formName,
        sourceName: recalledFamiliar.summonMetadata?.sourceName,
        pocketState: 'recalled',
        position: recallPosition
      }
    })
  }

  get description(): string {
    return `${this.context.caster.name} recalls a familiar from its pocket dimension`
  }

  private findPocketedFamiliar(state: CombatState, caster: CombatCharacter): PocketedSummon | undefined {
    return (state.pocketedSummons || []).find(entry =>
      entry.casterId === caster.id &&
      entry.spellId === this.context.spellId &&
      (this.options.familiarId ? entry.summon.id === this.options.familiarId : this.isFamiliar(entry.summon))
    )
  }

  private isFamiliar(character: CombatCharacter): boolean {
    return character.summonMetadata?.entityType === 'familiar' ||
      character.summonMetadata?.sourceName === 'Find Familiar'
  }

  private findRecallPosition(
    state: CombatState,
    requestedPosition: Position,
    casterPosition: Position,
    familiarId: string
  ): Position {
    // A recalled familiar is a real combat token. If its last known square or
    // requested square is occupied, choose a nearby open tile instead of
    // stacking actors on one position and breaking target selection.
    if (!this.isOccupied(state, requestedPosition, familiarId)) {
      return requestedPosition
    }

    const searchOrigins = [requestedPosition, casterPosition]
    for (const origin of searchOrigins) {
      for (let radius = 1; radius <= 3; radius += 1) {
        for (let x = origin.x - radius; x <= origin.x + radius; x += 1) {
          for (let y = origin.y - radius; y <= origin.y + radius; y += 1) {
            if (Math.abs(x - origin.x) !== radius && Math.abs(y - origin.y) !== radius) {
              continue
            }

            const candidate = { x, y }
            if (this.isWithinBounds(state, candidate) && !this.isOccupied(state, candidate, familiarId)) {
              return candidate
            }
          }
        }
      }
    }

    // If no local tile is available, keep the requested position so the command
    // still makes progress rather than destroying the pocketed familiar. Map
    // validation can surface a tighter error once recall has a player-facing
    // placement picker.
    return requestedPosition
  }

  private isOccupied(state: CombatState, position: Position, familiarId: string): boolean {
    return state.characters.some(character =>
      character.id !== familiarId &&
      character.currentHP > 0 &&
      character.position.x === position.x &&
      character.position.y === position.y
    )
  }

  private isWithinBounds(state: CombatState, position: Position): boolean {
    if (!state.mapData) {
      return true
    }

    return position.x >= 0 &&
      position.y >= 0 &&
      position.x < state.mapData.dimensions.width &&
      position.y < state.mapData.dimensions.height
  }
}
