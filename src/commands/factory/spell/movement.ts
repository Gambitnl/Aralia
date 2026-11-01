/**
 * @file movement.ts
 * Owns the Lightning Lure and Thunderwave movement/damage bridges.
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
 * Dependents: commands/factory/spell/specialSpellRegistry.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, UtilityEffect, isUtilityEffect, type DamageEffect, type MovementEffect } from '@/types/spells'
import { CombatCharacter, CombatState } from '@/types/combat'
import { SpellCommand, CommandContext, CommandMetadata } from '../../base/SpellCommand'
import { DamageCommand } from '../../effects/DamageCommand'
import { MovementCommand } from '../../effects/MovementCommand'
import { UtilityCommand } from '../../effects/UtilityCommand'
import { generateId, getCharacterDistance } from '@/utils/combat'
import { calculateSpellDC, rollSavingThrow } from '@/utils/character/savingThrowUtils'
import { SavePenaltySystem } from '@/systems/combat/SavePenaltySystem'
import { applyScaling } from './scaling'
import { withConcentrationLifecycle } from './concentration'
import { SpellBridgeContext } from './bridgeContext'

export class LightningLureBridgeCommand implements SpellCommand {
  public readonly id = generateId()
  public readonly description: string
  public readonly metadata: CommandMetadata

  constructor(
    private readonly spell: Spell,
    private readonly caster: CombatCharacter,
    private readonly context: CommandContext,
    public readonly movementEffect: MovementEffect,
    public readonly damageEffect: DamageEffect
  ) {
    this.description = `${spell.name} pulls a target and follows up with lightning damage if close enough`
    this.metadata = {
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: context.targets.map(target => target.id),
      effectType: 'lightning_lure_bridge',
      timestamp: Date.now()
    }
  }

  async execute(state: CombatState): Promise<CombatState> {
    const target = this.resolveTarget(state)
    if (!target) {
      return state
    }

    const spellDc = calculateSpellDC(this.caster)
    const saveResult = rollSavingThrow(target, 'Strength', spellDc, [])
    let nextState: CombatState = {
      ...state,
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${target.name} ${saveResult.success ? 'succeeds' : 'fails'} Strength save (${saveResult.total} vs DC ${spellDc}) against ${this.spell.name}.`,
          characterId: target.id,
          targetIds: [target.id]
        }
      ]
    }

    if (saveResult.success) {
      return nextState
    }

    const movementCommand = new MovementCommand(this.movementEffect, {
      ...this.context,
      targets: [target],
      selectedSpellTargets: this.context.selectedSpellTargets?.filter(selectedTarget =>
        selectedTarget.kind !== 'creature' || selectedTarget.id === target.id
      ) ?? [
        {
          kind: 'creature',
          id: target.id
        }
      ]
    })

    nextState = movementCommand.execute(nextState)

    const movedTarget = nextState.characters.find(character => character.id === target.id)
    if (!movedTarget) {
      return nextState
    }

    if (getCharacterDistance(this.caster, movedTarget) > 1) {
      return nextState
    }

    const damageCommand = new DamageCommand(
      {
        ...this.damageEffect,
        condition: {
          ...this.damageEffect.condition,
          type: 'always'
        }
      },
      {
        ...this.context,
        targets: [movedTarget],
        selectedSpellTargets: [
          {
            kind: 'creature',
            id: movedTarget.id
          }
        ]
      }
    )

    return await damageCommand.execute(nextState)
  }

  private resolveTarget(state: CombatState): CombatCharacter | undefined {
    return this.context.targets
      .map(target => state.characters.find(character => character.id === target.id) ?? target)
      .find(Boolean)
  }
}



export class ThunderwaveBridgeCommand implements SpellCommand {
  public readonly id = generateId()
  public readonly description: string
  public readonly metadata: CommandMetadata

  constructor(
    private readonly spell: Spell,
    private readonly caster: CombatCharacter,
    private readonly context: CommandContext,
    private readonly movementEffect: MovementEffect,
    private readonly damageEffect: DamageEffect,
    private readonly utilityEffects: UtilityEffect[]
  ) {
    this.description = `${spell.name} damages targets and pushes failed saves away from the caster`
    this.metadata = {
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: context.targets.map(target => target.id),
      effectType: 'thunderwave_bridge',
      timestamp: Date.now()
    }
  }

  async execute(state: CombatState): Promise<CombatState> {
    let nextState = state
    const spellDc = calculateSpellDC(this.caster)

    for (const snapshotTarget of this.context.targets) {
      const liveTarget = nextState.characters.find(character => character.id === snapshotTarget.id)
      if (!liveTarget) {
        continue
      }

      const savePenaltySystem = new SavePenaltySystem()
      const saveModifiers = savePenaltySystem.getActivePenalties(liveTarget)
      const saveResult = rollSavingThrow(liveTarget, 'Constitution', spellDc, saveModifiers)
      nextState = savePenaltySystem.consumeNextSavePenalties(nextState, liveTarget.id)
      nextState = {
        ...nextState,
        combatLog: [
          ...nextState.combatLog,
          {
            id: generateId(),
            timestamp: Date.now(),
            type: 'status',
            message: `${liveTarget.name} ${saveResult.success ? 'succeeds' : 'fails'} Constitution save (${saveResult.total} vs DC ${spellDc}) against ${this.spell.name}.`,
            characterId: liveTarget.id,
            targetIds: [liveTarget.id],
            data: {
              spellId: this.spell.id,
              saveType: 'Constitution',
              saveTotal: saveResult.total,
              saveSucceeded: saveResult.success,
              modifiersApplied: saveResult.modifiersApplied
            }
          }
        ]
      }

      let damageTarget = liveTarget
      if (!saveResult.success) {
        const movementCommand = new MovementCommand(this.movementEffect, {
          ...this.context,
          targets: [liveTarget],
          selectedSpellTargets: [{ kind: 'creature', id: liveTarget.id }]
        })
        nextState = movementCommand.execute(nextState)
        damageTarget = nextState.characters.find(character => character.id === liveTarget.id) ?? liveTarget
      }

      const damageCommand = new DamageCommand(
        {
          ...this.damageEffect,
          condition: {
            ...this.damageEffect.condition,
            type: 'always'
          }
        },
        {
          ...this.context,
          targets: [damageTarget],
          selectedSpellTargets: [{ kind: 'creature', id: damageTarget.id }],
          damageMultiplier: saveResult.success ? 0.5 : undefined
        }
      )

      nextState = await damageCommand.execute(nextState)
    }

    for (const utilityEffect of this.utilityEffects) {
      const utilityCommand = new UtilityCommand(utilityEffect, this.context)
      nextState = await utilityCommand.execute(nextState)
    }

    return nextState
  }
}



export function resolveLightningLureDamageDice(effect: DamageEffect, casterLevel: number): string {
  if (casterLevel >= 17) {
    return '4d8'
  }

  if (casterLevel >= 11) {
    return '3d8'
  }

  if (casterLevel >= 5) {
    return '2d8'
  }

  return effect.damage.dice
}



export function resolveThunderwavePushDistanceFeet(effect: MovementEffect): number {
  if (typeof effect.distance === 'number' && effect.distance > 0) {
    return effect.distance
  }

  const forcedMovementDistance = effect.forcedMovement?.maxDistance
  if (typeof forcedMovementDistance === 'string') {
    const parsedDistance = forcedMovementDistance.match(/(\d+)/)
    if (parsedDistance) {
      return Number(parsedDistance[1])
    }
  }

  return 10
}



export function resolveLightningLurePullDistanceFeet(effect: MovementEffect): number {
  if (typeof effect.distance === 'number' && effect.distance > 0) {
    return effect.distance
  }

  const forcedMovementDistance = effect.forcedMovement?.maxDistance
  if (typeof forcedMovementDistance === 'string') {
    const parsedDistance = forcedMovementDistance.match(/(\d+)/)
    if (parsedDistance) {
      return Number(parsedDistance[1])
    }
  }

  return 10
}

export function buildMovementCommands(input: SpellBridgeContext): SpellCommand[] | undefined {
  const { spell, caster, context, activeEffects, effectiveCastLevel } = input


    if (spell.id === 'lightning-lure') {
      const movementEffect = activeEffects.find((effect): effect is MovementEffect => effect.type === 'MOVEMENT')
      const damageEffect = activeEffects.find((effect): effect is DamageEffect => effect.type === 'DAMAGE')

      if (movementEffect && damageEffect) {
        const scaledMovementEffect = applyScaling(movementEffect, spell.level, effectiveCastLevel, caster.level) as MovementEffect
        const scaledDamageEffect = {
          ...damageEffect,
          damage: {
            ...damageEffect.damage,
            dice: resolveLightningLureDamageDice(damageEffect, caster.level)
          }
        } as DamageEffect
        const bridgeMovementEffect: MovementEffect = {
          ...scaledMovementEffect,
          distance: resolveLightningLurePullDistanceFeet(scaledMovementEffect)
        }

        const bridge = new LightningLureBridgeCommand(
          spell,
          caster,
          context,
          bridgeMovementEffect,
          scaledDamageEffect
        )

        return withConcentrationLifecycle([bridge], spell, caster, context)
      }
    }


    if (spell.id === 'thunderwave') {
      const movementEffect = activeEffects.find((effect): effect is MovementEffect => effect.type === 'MOVEMENT')
      const damageEffect = activeEffects.find((effect): effect is DamageEffect => effect.type === 'DAMAGE')
      const utilityEffects = activeEffects.filter(isUtilityEffect)

      if (movementEffect && damageEffect) {
        const scaledMovementEffect = applyScaling(movementEffect, spell.level, effectiveCastLevel, caster.level) as MovementEffect
        const scaledDamageEffect = applyScaling(damageEffect, spell.level, effectiveCastLevel, caster.level) as DamageEffect
        const bridgeMovementEffect: MovementEffect = {
          ...scaledMovementEffect,
          distance: resolveThunderwavePushDistanceFeet(scaledMovementEffect)
        }

        return withConcentrationLifecycle([
          new ThunderwaveBridgeCommand(
            spell,
            caster,
            context,
            bridgeMovementEffect,
            scaledDamageEffect,
            utilityEffects.map(effect => applyScaling(effect, spell.level, effectiveCastLevel, caster.level) as UtilityEffect)
          )
        ], spell, caster, context)
      }
    }

  return undefined
}
