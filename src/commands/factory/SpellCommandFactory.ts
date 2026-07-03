// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 12:03:05
 * Dependents: commands/index.ts
 * Imports: 31 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, SpellEffect, TargetConditionFilter, UtilityEffect, CreatedObject, isAttackRollModifierEffect, isDamageEffect, isHealingEffect, StatusConditionEffect, isUtilityEffect, resolveScalableNumber, type DamageEffect, type MovementEffect } from '@/types/spells'
import { ActiveFireEffect, CombatCharacter, CombatState, LightSource, SelectedSpellTarget, SpellObjectImpact } from '@/types/combat'

import { SpellCommand, CommandContext, CommandMetadata } from '../base/SpellCommand'
import { DamageCommand } from '../effects/DamageCommand'
import { HealingCommand } from '../effects/HealingCommand'
import { StatusConditionCommand } from '../effects/StatusConditionCommand'
import { StartConcentrationCommand, BreakConcentrationCommand, breakFriendsConcentrationForCaster } from '../effects/ConcentrationCommands'
import { MovementCommand } from '../effects/MovementCommand'
import { SummoningCommand } from '../effects/SummoningCommand'
import { TerrainCommand } from '../effects/TerrainCommand'
import { UtilityCommand } from '../effects/UtilityCommand'
import { DefensiveCommand } from '../effects/DefensiveCommand'
import { AttackRollModifierCommand } from '../effects/AttackRollModifierCommand'
import { ReactiveEffectCommand } from '../effects/ReactiveEffectCommand'
import { RegisterRiderCommand } from '../effects/RegisterRiderCommand'
import { NarrativeCommand } from '../effects/NarrativeCommand'
import { EnhanceAbilityCommand, type EnhanceAbilityChoiceMap } from '../effects/EnhanceAbilityCommand'
import { WeaponAttackCommand } from './AbilityCommandFactory'
import { GameState } from '@/types'
import { TargetValidationUtils } from '@/systems/spells/targeting/TargetValidationUtils'
import { Plane } from '@/types/planes'
import { calculateProficiencyBonus } from '@/utils/character/savingThrowUtils'
import { getAbilityModifierValue } from '@/utils/character/statUtils'
import { generateId, getCharacterDistance, resolveAttack, rollD20 } from '@/utils/combatUtils'
import { calculateSpellDC, rollSavingThrow } from '@/utils/character/savingThrowUtils'
import { combatEvents } from '@/systems/events/CombatEvents'
import { SavePenaltySystem } from '@/systems/combat/SavePenaltySystem'
import {
  buildTrueStrikeAttack,
  hasTrueStrikeImmediateAttackAugment,
  resolveTrueStrikeAttackTarget,
  resolveTrueStrikeWeaponSnapshot,
  validateTrueStrikeWeaponSnapshot
} from './trueStrikeAttackBridge'
import {
  buildBoomingBladeAttack,
  hasBoomingBladeWeaponAttackBridge,
  resolveBoomingBladeAttackTarget,
  resolveBoomingBladeWeaponSnapshot,
  validateBoomingBladeWeaponSnapshot
} from './boomingBladeAttackBridge'
import {
  buildGreenFlameBladeAttack,
  hasGreenFlameBladeWeaponAttackBridge,
  resolveGreenFlameBladeAttackTarget,
  resolveGreenFlameBladeWeaponSnapshot,
  validateGreenFlameBladeWeaponSnapshot
} from './greenFlameBladeAttackBridge'

type SpellWithPerTargetChoices = Spell & {
  perTargetChoicesByTargetId?: EnhanceAbilityChoiceMap
}

type SpellAttackInstance = {
  target?: CombatCharacter
  objectTarget?: Extract<SelectedSpellTarget, { kind: 'object' }>
}

class SpellAttackCommand implements SpellCommand {
  public readonly id = generateId()
  public readonly description: string
  public readonly metadata: CommandMetadata

  constructor(
    private readonly spell: Spell,
    private readonly caster: CombatCharacter,
    private readonly targets: CombatCharacter[],
    private readonly context: CommandContext,
    private readonly hitEffects: SpellEffect[],
    private readonly createHitCommand: (effect: SpellEffect, context: CommandContext) => SpellCommand | null
  ) {
    this.description = `${caster.name} makes a ${spell.attackType || 'spell'} spell attack with ${spell.name}`
    this.metadata = {
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: targets.map(target => target.id),
      effectType: 'spell_attack',
      timestamp: Date.now()
    }
  }

  async execute(state: CombatState): Promise<CombatState> {
    let nextState = { ...state }
    const attackInstances = this.resolveAttackInstances(nextState)

    if (attackInstances.length === 0) {
      return nextState
    }

    nextState = await breakFriendsConcentrationForCaster(
      nextState,
      this.caster,
      this.context,
      'caster_makes_attack_roll',
      this.spell.name
    )

    const attackBonus = this.resolveSpellAttackBonus()
    const weaponType = this.resolveSpellAttackWeaponType()

    if (this.spell.id === 'primal-savagery') {
      nextState = {
        ...nextState,
        combatLog: [
          ...nextState.combatLog,
          {
            id: generateId(),
            timestamp: Date.now(),
            type: 'status',
            message: `${this.caster.name}'s teeth or fingernails sharpen for Primal Savagery.`,
            characterId: this.caster.id,
            data: {
              spellId: this.spell.id,
              transientTransformation: 'primal_savagery_sharpened',
              active: true
            }
          }
        ]
      }
    }

    for (let index = 0; index < attackInstances.length; index += 1) {
      const attackInstance = attackInstances[index]
      const liveTarget = attackInstance.target
        ? (nextState.characters.find(character => character.id === attackInstance.target?.id) ?? attackInstance.target)
        : null
      const objectTarget = attackInstance.objectTarget
      const targetName = liveTarget?.name ?? objectTarget?.name ?? objectTarget?.id ?? 'object'
      const targetId = liveTarget?.id ?? objectTarget?.id ?? 'object'
      const attackRoll = rollD20()
      const targetAC = liveTarget?.armorClass || 10
      const resolvedAttack = resolveAttack(attackRoll, attackBonus, targetAC)
      const total = attackRoll + attackBonus

      combatEvents.emit({
        type: 'unit_attack',
        attackerId: this.caster.id,
        targetId,
        isHit: resolvedAttack.isHit,
        isCrit: resolvedAttack.isCritical,
        attackType: 'spell',
        weaponType
      })

      nextState = {
        ...nextState,
        combatLog: [
          ...nextState.combatLog,
          {
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `${this.caster.name} casts ${this.spell.name} at ${targetName}. ${attackRoll} + ${attackBonus} = ${total} vs AC ${targetAC}. ${resolvedAttack.isHit ? (resolvedAttack.isCritical ? 'CRITICAL HIT!' : 'HIT!') : (resolvedAttack.isAutoMiss ? 'CRITICAL MISS!' : 'MISS.')}`,
            characterId: this.caster.id,
            targetIds: [targetId],
            data: {
              spellId: this.spell.id,
              attackType: 'spell',
              weaponType,
              isHit: resolvedAttack.isHit,
              isCrit: resolvedAttack.isCritical,
              rollResult: attackRoll,
              total,
              spellAttackInstanceIndex: index,
              spellAttackInstanceCount: attackInstances.length,
              spellAttackInstanceType: this.resolveAttackInstanceType(),
              primalSavageryDamageDice: this.spell.id === 'primal-savagery'
                ? this.resolvePrimaryDamageDice()
                : undefined
            }
          }
        ]
      }

      // Misses deliberately skip hit-conditioned effects but do not stop later
      // beam instances from resolving their own attack rolls.
      if (!resolvedAttack.isHit) {
        continue
      }

      if (objectTarget) {
        nextState = this.applyObjectHitEffects(nextState, objectTarget)
        continue
      }

      for (const effect of this.hitEffects) {
        const command = this.createHitCommand(effect, {
          ...this.context,
          targets: liveTarget ? [liveTarget] : [],
          isCritical: resolvedAttack.isCritical
        })

        if (command) {
          nextState = await command.execute(nextState)
        }
      }
    }

    if (this.spell.id === 'primal-savagery') {
      nextState = {
        ...nextState,
        combatLog: [
          ...nextState.combatLog,
          {
            id: generateId(),
            timestamp: Date.now(),
            type: 'status',
            message: `${this.caster.name}'s teeth or fingernails return to normal.`,
            characterId: this.caster.id,
            data: {
              spellId: this.spell.id,
              transientTransformation: 'primal_savagery_sharpened',
              active: false
            }
          }
        ]
      }
    }

    return nextState
  }

  private resolveAttackInstances(state: CombatState): SpellAttackInstance[] {
    const selectedAttackTargets = (this.context.selectedSpellTargets || [])
      .filter((selectedTarget): selectedTarget is Extract<SelectedSpellTarget, { kind: 'creature' | 'object' }> =>
        selectedTarget.kind === 'creature' || selectedTarget.kind === 'object'
      )

    const selectedInstances = selectedAttackTargets
      .map(selectedTarget => {
        if (selectedTarget.kind === 'object') {
          return { objectTarget: selectedTarget }
        }

        const liveTarget = state.characters.find(character => character.id === selectedTarget.id)
        const snapshotTarget = this.targets.find(target => target.id === selectedTarget.id)
        const target = liveTarget ?? snapshotTarget
        return target ? { target } : null
      })
      .filter((instance): instance is SpellAttackInstance => instance !== null)

    const baseInstances = selectedInstances.length > 0
      ? selectedInstances
      : this.targets.map(target => ({ target }))

    if (!this.usesBeamAttackAllocation() || baseInstances.length === 0) {
      return baseInstances.slice(0, 1)
    }

    const beamCount = this.resolveBeamCount()
    if (baseInstances.length >= beamCount) {
      return baseInstances.slice(0, beamCount)
    }

    // Eldritch Blast can assign multiple beam instances to the same target.
    // When the cast provides fewer explicit refs than beams, repeat the final
    // selected ref rather than de-duplicating away the spell's scaling.
    const paddedInstances = [...baseInstances]
    while (paddedInstances.length < beamCount) {
      paddedInstances.push(baseInstances[baseInstances.length - 1])
    }

    return paddedInstances
  }

  private usesBeamAttackAllocation(): boolean {
    return this.spell.targeting.type === 'multi' &&
      this.spell.targeting.instanceAllocation?.instanceType === 'beam' &&
      this.spell.targeting.instanceAllocation.assignment === 'same_or_different_targets'
  }

  private resolveBeamCount(): number {
    const maxTargets = this.spell.targeting.type === 'multi'
      ? this.spell.targeting.maxTargets
      : undefined

    if (maxTargets) {
      return Math.max(1, resolveScalableNumber(maxTargets, this.caster.level || 1))
    }

    return Math.max(1, this.spell.targeting.instanceAllocation?.baseCount ?? 1)
  }

  private resolveAttackInstanceType(): string {
    return this.usesBeamAttackAllocation()
      ? this.spell.targeting.instanceAllocation?.instanceType ?? 'attack'
      : 'attack'
  }

  private applyObjectHitEffects(
    state: CombatState,
    objectTarget: Extract<SelectedSpellTarget, { kind: 'object' }>
  ): CombatState {
    let nextState = state
    const damageEffect = this.hitEffects.find(isDamageEffect)
    const utilityEffect = this.hitEffects.find(isUtilityEffect)
    const expiresAtRound = state.turnState.currentTurn + 1

    if (damageEffect) {
      const impact: SpellObjectImpact = {
        id: generateId(),
        objectId: objectTarget.id,
        objectName: objectTarget.name ?? objectTarget.object?.name,
        position: objectTarget.position,
        sourceSpellId: this.spell.id,
        sourceSpellName: this.spell.name,
        casterId: this.caster.id,
        damage: {
          dice: damageEffect.damage.dice,
          type: damageEffect.damage.type
        },
        createdTurn: state.turnState.currentTurn,
        expiresAtRound
      }

      nextState = {
        ...nextState,
        spellObjectImpacts: [
          ...(nextState.spellObjectImpacts || []),
          impact
        ],
        combatLog: [
          ...nextState.combatLog,
          {
            id: generateId(),
            timestamp: Date.now(),
            type: 'damage',
            message: `${this.spell.name} hits ${objectTarget.name ?? objectTarget.id} for ${damageEffect.damage.dice} ${damageEffect.damage.type} object damage.`,
            characterId: this.caster.id,
            targetIds: [objectTarget.id],
            data: {
              spellId: this.spell.id,
              objectImpact: impact
            }
          }
        ]
      }

      nextState = this.applyObjectIgnition(nextState, objectTarget, damageEffect)
    }

    if (utilityEffect?.light && ((utilityEffect.light.brightRadius ?? 0) > 0 || (utilityEffect.light.dimRadius ?? 0) > 0)) {
      const lightSource: LightSource = {
        id: generateId(),
        sourceSpellId: this.spell.id,
        casterId: this.caster.id,
        brightRadius: utilityEffect.light.brightRadius,
        dimRadius: utilityEffect.light.dimRadius ?? 0,
        attachedTo: 'point',
        position: objectTarget.position,
        color: utilityEffect.light.color,
        opaqueCoverBlocks: utilityEffect.light.opaqueCoverBlocks === true,
        createdTurn: state.turnState.currentTurn,
        expiresAtRound
      }

      nextState = {
        ...nextState,
        activeLightSources: [
          ...(nextState.activeLightSources || []),
          lightSource
        ],
        combatLog: [
          ...nextState.combatLog,
          {
            id: generateId(),
            timestamp: Date.now(),
            type: 'status',
            message: `${objectTarget.name ?? objectTarget.id} sheds ${utilityEffect.light.dimRadius ?? 0} ft dim light from ${this.spell.name}.`,
            characterId: this.caster.id,
            targetIds: [objectTarget.id],
            data: {
              spellId: this.spell.id,
              lightSource
            }
          }
        ]
      }
    }

    return nextState
  }

  private applyObjectIgnition(
    state: CombatState,
    objectTarget: Extract<SelectedSpellTarget, { kind: 'object' }>,
    damageEffect: SpellEffect
  ): CombatState {
    if (!isDamageEffect(damageEffect)) {
      return state
    }

    const ignitionObject = damageEffect.createdObjects?.find(createdObject =>
      createdObject.ignitesTouchedObjects === true &&
      createdObject.appearsIn === 'target_object'
    )

    if (!ignitionObject) {
      return state
    }

    const selectedObject = objectTarget.object
    const isWornOrCarried = selectedObject?.isWornOrCarried === true

    if (ignitionObject.excludesWornOrCarriedObjects && isWornOrCarried) {
      return {
        ...state,
        combatLog: [
          ...state.combatLog,
          {
            id: generateId(),
            timestamp: Date.now(),
            type: 'status',
            message: `${objectTarget.name ?? objectTarget.id} is not ignited by ${this.spell.name} because it is worn or carried.`,
            characterId: this.caster.id,
            targetIds: [objectTarget.id],
            data: {
              spellId: this.spell.id,
              suppressedFireEffect: {
                objectId: objectTarget.id,
                reason: 'worn_or_carried'
              }
            }
          }
        ]
      }
    }

    const fireEffect = buildActiveFireEffect({
      spell: this.spell,
      caster: this.caster,
      createdObject: ignitionObject,
      position: objectTarget.position,
      currentTurn: state.turnState.currentTurn,
      kind: 'ignited_object',
      objectId: objectTarget.id,
      objectName: objectTarget.name ?? selectedObject?.name,
      damage: damageEffect.damage
    })

    return {
      ...state,
      activeFireEffects: [
        ...(state.activeFireEffects || []),
        fireEffect
      ],
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${objectTarget.name ?? objectTarget.id} starts burning from ${this.spell.name}.`,
          characterId: this.caster.id,
          targetIds: [objectTarget.id],
          data: {
            spellId: this.spell.id,
            fireEffect
          }
        }
      ]
    }
  }

  private resolveSpellAttackBonus(): number {
    const explicitSpellAttackBonus = (this.caster as CombatCharacter & { spellAttackBonus?: number }).spellAttackBonus
    if (typeof explicitSpellAttackBonus === 'number') {
      return explicitSpellAttackBonus
    }

    const spellcastingAbility = this.caster.spellcastingAbility
      ? this.caster.spellcastingAbility
      : (this.caster.class?.spellcasting?.ability || 'Intelligence').toLowerCase()
    const abilityScore = this.caster.stats[spellcastingAbility as keyof CombatCharacter['stats']] ?? 10

    return getAbilityModifierValue(Number(abilityScore)) + calculateProficiencyBonus(this.caster.level || 1)
  }

  private resolveSpellAttackWeaponType(): 'melee' | 'ranged' {
    if (this.spell.id === 'primal-savagery' || this.spell.attackType === 'melee' || this.spell.targeting.type === 'melee') {
      return 'melee'
    }

    return 'ranged'
  }

  private resolvePrimaryDamageDice(): string | undefined {
    const damageEffect = this.hitEffects.find(isDamageEffect)
    return damageEffect?.damage.dice
  }
}

class FireArtifactCommand implements SpellCommand {
  public readonly id = generateId()
  public readonly description: string
  public readonly metadata: CommandMetadata

  constructor(
    private readonly spell: Spell,
    private readonly caster: CombatCharacter,
    private readonly context: CommandContext,
    private readonly createdObject: CreatedObject,
    private readonly damage?: { dice: string; type: string }
  ) {
    this.description = `${spell.name} creates a fire artifact`
    this.metadata = {
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: [],
      effectType: 'fire_artifact',
      timestamp: Date.now()
    }
  }

  async execute(state: CombatState): Promise<CombatState> {
    const point = this.context.selectedSpellTargets?.find(selectedTarget => selectedTarget.kind === 'point')
    const position = point?.position ?? this.caster.position
    const fireEffect = buildActiveFireEffect({
      spell: this.spell,
      caster: this.caster,
      createdObject: this.createdObject,
      position,
      currentTurn: state.turnState.currentTurn,
      kind: 'hazard',
      damage: this.damage
    })

    return {
      ...state,
      activeFireEffects: [
        ...(state.activeFireEffects || []),
        fireEffect
      ],
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: `${this.spell.name} creates ${this.createdObject.name} at (${position.x}, ${position.y}).`,
          characterId: this.caster.id,
          data: {
            spellId: this.spell.id,
            fireEffect
          }
        }
      ]
    }
  }
}

class LightningLureBridgeCommand implements SpellCommand {
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

class ThunderwaveBridgeCommand implements SpellCommand {
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

function resolveLightningLureDamageDice(effect: DamageEffect, casterLevel: number): string {
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

function resolveThunderwavePushDistanceFeet(effect: MovementEffect): number {
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

function resolveLightningLurePullDistanceFeet(effect: MovementEffect): number {
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

function buildActiveFireEffect(args: {
  spell: Spell
  caster: CombatCharacter
  createdObject: CreatedObject
  position: { x: number; y: number }
  currentTurn: number
  kind: ActiveFireEffect['kind']
  objectId?: string
  objectName?: string
  damage?: { dice: string; type: string }
}): ActiveFireEffect {
  const { spell, caster, createdObject, position, currentTurn, kind, objectId, objectName, damage } = args
  const expiresAtRound = createdObject.expiresWithSpell
    ? currentTurn + resolveSpellDurationRounds(spell)
    : undefined

  return {
    id: generateId(),
    spellId: spell.id,
    sourceName: spell.name,
    casterId: caster.id,
    position,
    createdTurn: currentTurn,
    expiresAtRound,
    kind,
    objectId,
    objectName,
    objectType: createdObject.objectType,
    damage,
    area: {
      shape: createdObject.affectedVolumeShape,
      sizeFeet: createdObject.affectedVolumeSizeFeet
    },
    ignitesTouchedObjects: createdObject.ignitesTouchedObjects === true,
    excludesWornOrCarriedObjects: createdObject.excludesWornOrCarriedObjects === true
  }
}

function resolveSpellDurationRounds(spell: Spell): number {
  if (spell.duration.type !== 'timed') {
    return 1
  }

  switch (spell.duration.unit) {
    case 'round':
      return spell.duration.value
    case 'minute':
      return spell.duration.value * 10
    default:
      return 1
  }
}

export class SpellCommandFactory {
  /**
   * Create all commands for a spell
   */
  static async createCommands(
    spell: Spell,
    caster: CombatCharacter,
    targets: CombatCharacter[],
    castAtLevel: number,
    gameState: GameState,
    playerInput?: string,
    currentPlane?: Plane,
    requestReaction?: (attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_take_damage', options: any[]) => Promise<string | null>,
    selectedSpellTargets?: SelectedSpellTarget[]
  ): Promise<SpellCommand[]> {
    const commands: SpellCommand[] = []

    // PLANESHIFTER: Apply Planar Empowerment
    // If the plane empowers this school of magic, cast as if 1 level higher.
    let effectiveCastLevel = castAtLevel;
    let planarMod = 0;

    if (currentPlane && spell.school) {
      const { getPlanarSpellModifier } = await import('@/utils/planarUtils')
      planarMod = getPlanarSpellModifier(spell.school, currentPlane)

      if (planarMod > 0) {
        effectiveCastLevel += planarMod
        console.debug(`[Planeshifter] Planar empowerment active: ${spell.name} cast at level ${effectiveCastLevel} (+${planarMod})`)
      }
    }

    const context: CommandContext = {
      spellId: spell.id,
      spellName: spell.name,
      spellSchool: spell.school, // Use the spell school directly
      castAtLevel: effectiveCastLevel, // Updated below
      caster,
      targets,
      // Keep command context ready for object and point spells while preserving
      // the existing creature-target array that current commands execute from.
      selectedSpellTargets: selectedSpellTargets ?? this.createCreatureTargetRefs(targets),
      // Preserve the already-collected UI/AI choice for commands that need to
      // choose among structured options at execution time, such as Command.
      playerInput,
      gameState,
      effectDuration: spell.duration.type === 'timed' && spell.duration.unit
        ? {
          type: spell.duration.unit === 'round' ? 'rounds' : spell.duration.unit === 'minute' ? 'minutes' : 'special',
          value: spell.duration.value
        }
        : undefined,
      attackType: spell.attackType,
      currentPlane // Pass to context
    }

    // Start with the full effect list, then let special bridges narrow it when
    // one runtime owner must handle an effect exclusively. This avoids routing
    // the same spell payload through two commands that can overwrite each
    // other's target-state changes.
    let activeEffects = spell.effects;
    const perTargetChoicesByTargetId = (spell as SpellWithPerTargetChoices).perTargetChoicesByTargetId
    const enhanceAbilityEffect = activeEffects.find(isUtilityEffect)
    if (enhanceAbilityEffect && this.isEnhanceAbilityPerTargetChoice(spell, perTargetChoicesByTargetId)) {
      // Enhance Ability is a utility spell in data, but it has a real combat
      // mechanic once the caster has assigned choices. Build one explicit
      // command before generic utility logging so each target receives the
      // chosen ability-check advantage.
      commands.push(new EnhanceAbilityCommand(enhanceAbilityEffect, context, perTargetChoicesByTargetId))
      activeEffects = activeEffects.filter(effect => effect !== enhanceAbilityEffect)
    }

    if (spell.arbitrationType && spell.arbitrationType !== 'mechanical') {
      const { aiSpellArbitrator } = await import('@/systems/spells/ai/AISpellArbitrator')

      const arbitrationResult = await aiSpellArbitrator.arbitrate({
        spell,
        caster,
        targets,
        combatState: {
          isActive: true,
          characters: [caster, ...targets],
          turnState: {
            currentTurn: 0,
            turnOrder: [],
            currentCharacterId: null,
            phase: 'planning',
            actionsThisTurn: []
          },
          selectedCharacterId: null,
          selectedAbilityId: null,
          actionMode: 'select',
          validTargets: [],
          validMoves: [],
          combatLog: [],
          reactiveTriggers: [],
          activeLightSources: [],
          currentPlane
        },
        gameState,
        playerInput
      })

      if (!arbitrationResult.allowed) {
        console.warn(`Arbitration failed: ${arbitrationResult.reason}`)
        return []
      }

      // If AI provides a narrative, add it as a command
      if (arbitrationResult.narrativeOutcome) {
        commands.push(new NarrativeCommand(arbitrationResult.narrativeOutcome, context));
      }

      // Handle arbitrationResult.mechanicalEffects if the AI modified the spell logic
      if (arbitrationResult.mechanicalEffects) {
        for (const effectData of arbitrationResult.mechanicalEffects) {
          const effect = effectData as SpellEffect
          const scaledEffect = this.applyScaling(effect, spell.level, effectiveCastLevel, caster.level)
          const command = this.createCommand(scaledEffect, context)
          if (command) {
            commands.push(command)
          }
        }
      }
    }


    // Mode-choice spells keep every possible option in spell JSON so the
    // spellbook and creator can show the full menu. Combat should only turn the
    // selected option into commands, so the optional playerInput narrows the
    // effect list before command creation.
    if (spell.modeChoice && playerInput) {
      const chosenOption = spell.modeChoice.options.find(opt =>
        opt.label.toLowerCase() === playerInput.toLowerCase()
      );
      if (chosenOption && chosenOption.effectIndices) {
        // Drop invalid indices instead of crashing the simulator. A real-data
        // regression test guards the spell files so this fallback stays a last
        // resort rather than hiding bad package data.
        activeEffects = chosenOption.effectIndices.map(index => spell.effects[index]).filter(Boolean);
      }
    }

    // Booming Blade is a blade cantrip: the spell cast is only real if it
    // creates a weapon attack first. Keep this bridge ahead of generic damage
    // command creation so the thunder payload stays gated behind hit or miss.
    if (spell.id === 'booming-blade' && hasBoomingBladeWeaponAttackBridge(spell)) {
      const weaponSnapshot = resolveBoomingBladeWeaponSnapshot(caster)
      const attackTarget = resolveBoomingBladeAttackTarget(selectedSpellTargets, targets, caster.id)
      const validation = validateBoomingBladeWeaponSnapshot(caster, weaponSnapshot)

      if (!weaponSnapshot || !attackTarget || !validation.valid) {
        const reason = validation.reason ?? 'Booming Blade needs a valid melee weapon and a creature target.'
        return [
          new NarrativeCommand(reason, context)
        ]
      }

      const builtAttack = buildBoomingBladeAttack(
        spell,
        caster,
        weaponSnapshot,
        attackTarget
      )

      const attackContext: CommandContext = {
        ...context,
        targets: [attackTarget],
        selectedSpellTargets: [
          {
            kind: 'creature',
            id: attackTarget.id
          }
        ],
        weaponProperties: weaponSnapshot.properties,
        isMagical: true
      }

      return this.withConcentrationLifecycle([
        new WeaponAttackCommand(builtAttack.attackAbility, caster, [attackTarget], attackContext)
      ], spell, caster, context)
    }

    // Green-Flame Blade is the sibling blade cantrip with a secondary fire
    // leap. Keep its hit gate separate from Booming Blade so the weapon attack
    // can resolve first and the leap can spend only after a confirmed hit.
    if (spell.id === 'green-flame-blade' && hasGreenFlameBladeWeaponAttackBridge(spell)) {
      const weaponSnapshot = resolveGreenFlameBladeWeaponSnapshot(caster)
      const attackTarget = resolveGreenFlameBladeAttackTarget(selectedSpellTargets, targets, caster.id)
      const validation = validateGreenFlameBladeWeaponSnapshot(caster, weaponSnapshot)

      if (!weaponSnapshot || !attackTarget || !validation.valid) {
        const reason = validation.reason ?? 'Green-Flame Blade needs a valid melee weapon and a creature target.'
        return [
          new NarrativeCommand(reason, context)
        ]
      }

      const builtAttack = buildGreenFlameBladeAttack(
        spell,
        caster,
        weaponSnapshot,
        attackTarget,
        selectedSpellTargets,
        targets
      )

      const attackContext: CommandContext = {
        ...context,
        targets: [attackTarget],
        selectedSpellTargets: [
          {
            kind: 'creature',
            id: attackTarget.id
          }
        ],
        weaponProperties: weaponSnapshot.properties,
        isMagical: true
      }

      return this.withConcentrationLifecycle([
        new WeaponAttackCommand(builtAttack.attackAbility, caster, [attackTarget], attackContext)
      ], spell, caster, context)
    }

    // True Strike is a neighboring cast-time weapon-attack cantrip, but it has
    // a different contract: the spell alters the weapon attack's ability and
    // damage type instead of leaving a target-side movement rider.
    if (spell.id === 'true-strike') {
      const trueStrikeEffect = activeEffects.find(
        effect => isUtilityEffect(effect) && effect.attackAugments?.some(augment =>
          augment.grantedAttack?.timing === 'during_cast' &&
          augment.grantedAttack.usesCastingWeapon === true
        )
      ) as UtilityEffect | undefined

      if (trueStrikeEffect && hasTrueStrikeImmediateAttackAugment(spell)) {
        const weaponSnapshot = resolveTrueStrikeWeaponSnapshot(caster)
        const attackTarget = resolveTrueStrikeAttackTarget(selectedSpellTargets, targets, caster.id)
        const augment = trueStrikeEffect.attackAugments?.find(attackAugment =>
          attackAugment.grantedAttack?.timing === 'during_cast' &&
          attackAugment.grantedAttack.usesCastingWeapon === true
        )
        const validation = validateTrueStrikeWeaponSnapshot(caster, weaponSnapshot, augment?.weaponRequirement)

        if (!weaponSnapshot || !attackTarget || !validation.valid) {
          const reason = validation.reason ?? 'True Strike needs a valid weapon and a creature target.'
          return [
            new NarrativeCommand(reason, context)
          ]
        }

        const builtAttack = buildTrueStrikeAttack(
          spell,
          caster,
          weaponSnapshot,
          attackTarget,
          playerInput
        )

        const attackContext: CommandContext = {
          ...context,
          targets: [attackTarget],
          selectedSpellTargets: [
            {
              kind: 'creature',
              id: attackTarget.id
            }
          ],
          weaponProperties: weaponSnapshot.properties,
          isMagical: true
        }

        return this.withConcentrationLifecycle([
          new WeaponAttackCommand(builtAttack.attackAbility, caster, [attackTarget], attackContext)
        ], spell, caster, context)
      }
    }

    if (spell.id === 'lightning-lure') {
      const movementEffect = activeEffects.find((effect): effect is MovementEffect => effect.type === 'MOVEMENT')
      const damageEffect = activeEffects.find((effect): effect is DamageEffect => effect.type === 'DAMAGE')

      if (movementEffect && damageEffect) {
        const scaledMovementEffect = this.applyScaling(movementEffect, spell.level, effectiveCastLevel, caster.level) as MovementEffect
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

        return this.withConcentrationLifecycle([bridge], spell, caster, context)
      }
    }

    if (spell.id === 'thunderwave') {
      const movementEffect = activeEffects.find((effect): effect is MovementEffect => effect.type === 'MOVEMENT')
      const damageEffect = activeEffects.find((effect): effect is DamageEffect => effect.type === 'DAMAGE')
      const utilityEffects = activeEffects.filter(isUtilityEffect)

      if (movementEffect && damageEffect) {
        const scaledMovementEffect = this.applyScaling(movementEffect, spell.level, effectiveCastLevel, caster.level) as MovementEffect
        const scaledDamageEffect = this.applyScaling(damageEffect, spell.level, effectiveCastLevel, caster.level) as DamageEffect
        const bridgeMovementEffect: MovementEffect = {
          ...scaledMovementEffect,
          distance: resolveThunderwavePushDistanceFeet(scaledMovementEffect)
        }

        return this.withConcentrationLifecycle([
          new ThunderwaveBridgeCommand(
            spell,
            caster,
            context,
            bridgeMovementEffect,
            scaledDamageEffect,
            utilityEffects.map(effect => this.applyScaling(effect, spell.level, effectiveCastLevel, caster.level) as UtilityEffect)
          )
        ], spell, caster, context)
      }
    }

    if (this.shouldUseSpellAttackCommand(spell, activeEffects)) {
      const hitEffects = activeEffects.map(effect => this.applyScaling(effect, spell.level, effectiveCastLevel, caster.level))
      return this.withConcentrationLifecycle([
        new SpellAttackCommand(spell, caster, targets, context, hitEffects, (effect, hitContext) => this.createCommand(effect, hitContext))
      ], spell, caster, context)
    }

    const fireArtifactCommand = this.createFireArtifactCommand(spell, caster, context, activeEffects, effectiveCastLevel)
    if (fireArtifactCommand) {
      commands.push(fireArtifactCommand)
    }

    for (const effect of activeEffects) {
      const scaledEffect = this.applyScaling(effect, spell.level, effectiveCastLevel, caster.level)

      // Support for condition removal (e.g. Lesser Restoration) without changing UtilityCommand
      if (scaledEffect.conditionRemoval && scaledEffect.conditionRemoval.length > 0) {
        const removalEffect: SpellEffect = {
          ...scaledEffect,
          type: 'STATUS_CONDITION',
          statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 0 } }, // Dummy condition, conditionRemoval logic fires first
          conditionRemoval: scaledEffect.conditionRemoval
        } as StatusConditionEffect;
        const removalCommand = this.createCommand(removalEffect, context);
        if (removalCommand) {
          commands.push(removalCommand);
        }
      }

      // Support for option-specific status payloads (e.g. Command's Grovel option)
      if (scaledEffect.type === 'UTILITY' && scaledEffect.controlOptions && playerInput) {
        const chosenOption = scaledEffect.controlOptions.find(opt =>
          opt.name.toLowerCase() === playerInput.toLowerCase() ||
          opt.effect.toLowerCase() === playerInput.toLowerCase()
        );
        if (chosenOption && chosenOption.statusCondition) {
          const statusEffect: SpellEffect = {
            ...scaledEffect,
            type: 'STATUS_CONDITION',
            statusCondition: chosenOption.statusCondition
          } as StatusConditionEffect;
          const statusCommand = this.createCommand(statusEffect, context);
          if (statusCommand) {
            commands.push(statusCommand);
          }
        }
      }

      const command = this.createCommand(scaledEffect, context)
      if (command) {
        commands.push(command)
      }
    }

    return this.withConcentrationLifecycle(commands, spell, caster, context)
  }

  // ... (rest of the file remains same)

  private static withConcentrationLifecycle(
    commands: SpellCommand[],
    spell: Spell,
    caster: CombatCharacter,
    context: CommandContext
  ): SpellCommand[] {
    if (!spell.duration.concentration) {
      return commands
    }

    // Concentration setup must wrap every successful spell command path, not
    // only the generic effect loop. Spell attacks and bridge commands often
    // return early after building a single runtime command, so they need the
    // same break-then-start contract to avoid stale concentration artifacts.
    const lifecycleCommands = [...commands]
    if (caster.concentratingOn) {
      lifecycleCommands.unshift(new BreakConcentrationCommand(context))
    }

    lifecycleCommands.push(new StartConcentrationCommand(spell, context))
    return lifecycleCommands
  }

  private static isEnhanceAbilityPerTargetChoice(
    spell: Spell,
    choicesByTargetId: EnhanceAbilityChoiceMap | undefined
  ): choicesByTargetId is EnhanceAbilityChoiceMap {
    return spell.id === 'enhance-ability' &&
      !!spell.targeting.perTargetChoice &&
      !!choicesByTargetId &&
      Object.keys(choicesByTargetId).length > 0
  }

  private static shouldUseSpellAttackCommand(spell: Spell, activeEffects: SpellEffect[]): boolean {
    const hasExplicitSpellAttackType = ['melee', 'ranged'].includes(spell.attackType ?? '')
    const hasMeleeHitTargeting = spell.targeting.type === 'melee'
    const isPrimalSavagery = spell.id === 'primal-savagery'
    const hasObjectIgnitionHitRider = activeEffects.some(effect =>
      isDamageEffect(effect) &&
      effect.condition?.type === 'hit' &&
      effect.createdObjects?.some(createdObject =>
        createdObject.ignitesTouchedObjects === true &&
        createdObject.appearsIn === 'target_object'
      )
    )

    if (!hasExplicitSpellAttackType && !hasMeleeHitTargeting && !hasObjectIgnitionHitRider && !isPrimalSavagery) {
      return false
    }

    if (activeEffects.length === 0) {
      return false
    }

    return activeEffects.every(effect =>
      effect.trigger.type === 'immediate' &&
      effect.condition?.type === 'hit'
    )
  }

  /**
   * Create a single command from an effect, filtering targets if necessary
   */
  private static isPersistentAreaZoneTrigger(effect: SpellEffect): boolean {
    return [
      'on_enter_area',
      'on_exit_area',
      'on_end_turn_in_area',
      'on_move_in_area'
    ].includes(effect.trigger.type)
  }

  private static isScheduledRuntimeTrigger(effect: SpellEffect): boolean {
    return ['turn_start', 'turn_end'].includes(effect.trigger.type)
  }

  private static createCommand(
    effect: SpellEffect,
    context: CommandContext
  ): SpellCommand | null {
    // Check for target filtering
    if (effect.condition?.targetFilter || context.targets.length > 0) {
      // We need to filter targets.
      // The CommandContext has `targets`. The command itself might use them.
      // Most commands use `context.targets`.
      // If we filter here, we should pass a modified context.

      let filteredTargets = context.targets;

      const targetFilter = effect.condition?.targetFilter;
      if (targetFilter) {
        filteredTargets = context.targets.filter(t => TargetValidationUtils.matchesFilter(t, targetFilter));

        if (filteredTargets.length === 0 && context.targets.length > 0) {
          // All targets filtered out
          return null;
        }
      }

      // Create a new context with filtered targets if they changed.
      // This intentionally performs a shallow context copy so callers can observe
      // only the filtered target set without mutating shared command state.
      if (filteredTargets.length !== context.targets.length) {
        context = {
          ...context,
          targets: filteredTargets,
          // If a creature filter removes targets, mirror that reduction in the
          // rich target envelope so future object/point commands do not see stale
          // creature refs that legacy command execution already rejected.
          selectedSpellTargets: this.filterSelectedTargetsForCreatures(context.selectedSpellTargets, filteredTargets)
        };
      }
    }

    if (['on_target_move', 'on_target_attack', 'on_target_cast', 'on_caster_action'].includes(effect.trigger.type)) {
      return new ReactiveEffectCommand(effect, context)
    }

    if (effect.trigger.type === 'on_attack_hit') {
      return new RegisterRiderCommand(effect, context)
    }

    if (this.isPersistentAreaZoneTrigger(effect)) {
      // Area-zone triggers are registered by useAbilitySystem/createSpellZoneFromAoEParams.
      // Returning null here prevents delayed zone effects from also resolving immediately.
      return null
    }

    if (this.isScheduledRuntimeTrigger(effect)) {
      // Bare turn-start/end effects are registered by useAbilitySystem as target-bound
      // scheduled effects. They should not resolve during the initial cast.
      return null
    }

    // Pass conditional endings to the command context to provide a runtime bridge
    if (effect.conditionalEndings && effect.conditionalEndings.length > 0) {
      context = { ...context, conditionalEndings: effect.conditionalEndings }
    }

    switch (effect.type) {
      case 'DAMAGE':
        return new DamageCommand(effect, context)

      case 'HEALING':
        return new HealingCommand(effect, context)

      case 'STATUS_CONDITION':
        return new StatusConditionCommand(effect, context)

      case 'ATTACK_ROLL_MODIFIER':
        return new AttackRollModifierCommand(effect, context)

      case 'MOVEMENT':
        return new MovementCommand(effect, context)
      case 'SUMMONING':
        return new SummoningCommand(effect, context)
      case 'TERRAIN':
        return new TerrainCommand(effect, context)
      case 'UTILITY':
        return new UtilityCommand(effect, context)
      case 'DEFENSIVE':
        return new DefensiveCommand(effect, context)

      default:
        console.warn(`Unknown effect type: ${effect.type}`)
        return null
    }
  }

  /**
   * Apply scaling formulas to effect
   * TODO #15(TechDebt): This manual scaling logic duplicates `resolveScalableNumber` from `src/types/spells.ts`.
   * We should refactor this to use the shared utility, especially for resolving numeric values.
   */
  private static applyScaling(
    effect: SpellEffect,
    baseSpellLevel: number,
    castAtLevel: number,
    casterLevel: number
  ): SpellEffect {
    if (!effect.scaling) return effect

    let scaled = { ...effect }

    if (effect.scaling.type === 'slot_level') {
      const levelsAbove = castAtLevel - baseSpellLevel
      if (levelsAbove > 0) {
        scaled = this.applySlotLevelScaling(scaled, levelsAbove)
      }
    }

    if (effect.scaling.type === 'character_level') {
      const tiers = [5, 11, 17]
      scaled = this.applyCharacterLevelScaling(scaled, casterLevel, tiers)
    }

    return scaled
  }

  /**
   * Apply slot level scaling (e.g., +1d6 per level)
   */
  private static applySlotLevelScaling(
    effect: SpellEffect,
    levelsAbove: number
  ): SpellEffect {
    const bonusPerLevel = effect.scaling!.bonusPerLevel

    if (!bonusPerLevel) return effect

    const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)

    if (diceMatch) {
      const [, count, size] = diceMatch
      const originalDice = effect.damage.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, levelsAbove)

      return this.applyScaledDamageDice(effect, newDice)
    }

    if (diceMatch && isHealingEffect(effect)) {
      const [, count, size] = diceMatch
      const originalDice = effect.healing.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, levelsAbove)
      return {
        ...effect,
        healing: { ...effect.healing, dice: newDice }
      }
    }

    if (isUtilityEffect(effect) && effect.createdObjects?.length) {
      // Creation spells can scale resources rather than dice. Scale those
      // explicit created-object fields before UtilityCommand emits inventory so
      // upcast water/food supplies reach the same runtime path as base casts.
      return {
        ...effect,
        createdObjects: effect.createdObjects.map(createdObject => ({
          ...createdObject,
          count: createdObject.countScaling?.type === 'slot_level'
            ? createdObject.count + (createdObject.countScaling.bonusPerLevel * levelsAbove)
            : createdObject.count,
          levels: createdObject.levelScaling?.type === 'slot_level'
            ? (createdObject.levels ?? 0) + (createdObject.levelScaling.bonusPerLevel * levelsAbove)
            : createdObject.levels,
          inventoryQuantity: createdObject.inventoryQuantityScaling?.type === 'slot_level'
            ? (createdObject.inventoryQuantity ?? createdObject.count) + (createdObject.inventoryQuantityScaling.bonusPerLevel * levelsAbove)
            : createdObject.inventoryQuantity
        }))
      }
    }

    return effect
  }

  private static createFireArtifactCommand(
    spell: Spell,
    caster: CombatCharacter,
    context: CommandContext,
    activeEffects: SpellEffect[],
    effectiveCastLevel: number
  ): SpellCommand | null {
    for (const effect of activeEffects) {
      if (!isDamageEffect(effect)) {
        continue
      }

      const createdObject = effect.createdObjects?.find(object =>
        object.ignitesTouchedObjects === true &&
        object.appearsIn === 'spell_area'
      )

      if (!createdObject) {
        continue
      }

      const scaledEffect = this.applyScaling(effect, spell.level, effectiveCastLevel, caster.level)
      const damage = isDamageEffect(scaledEffect) ? scaledEffect.damage : effect.damage

      return new FireArtifactCommand(spell, caster, context, createdObject, damage)
    }

    return null
  }

  /**
   * Apply character level scaling (cantrips)
   */
  private static applyCharacterLevelScaling(
    effect: SpellEffect,
    casterLevel: number,
    scalingLevels: number[]
  ): SpellEffect {
    const tier = scalingLevels.filter(l => casterLevel >= l).length

    if (tier === 0 || !effect.scaling) return effect

    const scalingTiers = effect.scaling.scalingTiers
    if (scalingTiers) {
      const tierKeys = Object.keys(scalingTiers).map(Number).sort((a, b) => a - b)
      const qualifiedTier = tierKeys.filter(l => casterLevel >= l).pop()

      if (qualifiedTier !== undefined) {
        const tierDice = scalingTiers[String(qualifiedTier)]
        if (tierDice && /^\d+d\d+$/.test(tierDice)) {
          return this.applyScaledDamageDice(effect, tierDice)
        }
      }
    }

    const bonusPerLevel = effect.scaling.bonusPerLevel
    if (!bonusPerLevel) return effect

    const diceMatch = bonusPerLevel.match(/\+(\d+)d(\d+)/)

    if (diceMatch) {
      const [, count, size] = diceMatch
      const originalDice = effect.damage.dice || '0d0'
      const newDice = this.addDice(originalDice, `${count}d${size}`, tier)
      return this.applyScaledDamageDice(effect, newDice)
    }

    return effect
  }

  /**
   * Preserve Frostbite-style nested damage riders when scaling cantrips.
   * Top-level damage rows still scale the same way, but attack-roll modifier
   * rows can carry their own damage payload and should not be left behind.
   */
  private static applyScaledDamageDice(effect: SpellEffect, dice: string): SpellEffect {
    if (isDamageEffect(effect)) {
      return {
        ...effect,
        damage: {
          ...effect.damage,
          dice,
          type: effect.damage.type
        }
      }
    }

    if (isAttackRollModifierEffect(effect) && effect.damage) {
      return {
        ...effect,
        damage: {
          ...effect.damage,
          dice,
          type: effect.damage.type
        }
      }
    }

    return effect
  }

  /**
   * Helper: Add dice notation
   * TODO #16(Refactor): Move to `src/utils/diceUtils.ts`.
   * This dice notation parsing and addition logic is generic and should be reusable
   * across the system (e.g. for item scaling or rider damage calculation).
   * Consider sharing this logic via a shared utility if the same path appears
   * in additional scaling or effects pipelines.
   */
  private static addDice(base: string, bonus: string, multiplier: number): string {
    const parseMatch = (s: string) => {
      const match = s.match(/(\d+)d(\d+)/)
      return match ? { count: parseInt(match[1]), size: parseInt(match[2]) } : null
    }

    const baseDice = parseMatch(base)
    const bonusDice = parseMatch(bonus)

    if (!baseDice || !bonusDice) return base
    if (baseDice.size !== bonusDice.size) {
      console.warn('Cannot add dice with different sizes')
      return base
    }

    const newCount = baseDice.count + (bonusDice.count * multiplier)
    return `${newCount}d${baseDice.size}`
  }

  /**
   * Build the rich target envelope for the current creature-only command path.
   *
   * Object and point refs enter through the optional factory argument, but most
   * existing callers still pass only CombatCharacter targets. This adapter keeps
   * those callers visible to future command code without changing their behavior.
   */
  private static createCreatureTargetRefs(targets: CombatCharacter[]): SelectedSpellTarget[] {
    return targets.map(target => ({ kind: 'creature', id: target.id }))
  }

  /**
   * Keep selected creature refs aligned with filtered command targets.
   *
   * Filters such as "Undead only" apply to creature targets. Non-creature refs
   * are preserved because object and point eligibility belongs to the object
   * targeting resolver, not creature taxonomy filters.
   */
  private static filterSelectedTargetsForCreatures(
    selectedSpellTargets: SelectedSpellTarget[] | undefined,
    filteredTargets: CombatCharacter[]
  ): SelectedSpellTarget[] | undefined {
    if (!selectedSpellTargets) {
      return undefined
    }

    const filteredCreatureIds = new Set(filteredTargets.map(target => target.id))

    return selectedSpellTargets.filter(selectedTarget =>
      selectedTarget.kind !== 'creature' || filteredCreatureIds.has(selectedTarget.id)
    )
  }
}
