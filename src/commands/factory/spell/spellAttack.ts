/**
 * @file spellAttack.ts
 * Executes spell attack rolls, beam allocations and object-hit effects.
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
 * Last Sync: 02/11/2026, 20:18:49
 * Dependents: commands/factory/SpellCommandFactory.ts
 * Imports: 16 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { resolveDefensiveHitReaction } from '@/systems/combat/reactions/defensiveHitReaction';
import { rangedAttackPressure, RANGED_PRESSURE_REASON } from '@/systems/combat/rangedAttackPressure';
import { getExhaustionD20Penalty } from '@/utils/combat/physicsUtils';
import { Spell, SpellEffect, isDamageEffect, isUtilityEffect, resolveScalableNumber } from '@/types/spells'
import { CombatCharacter, CombatState, LightSource, SelectedSpellTarget, SpellObjectImpact } from '@/types/combat'
import { SpellCommand, CommandContext, CommandMetadata } from '../../base/SpellCommand'
import { breakFriendsConcentrationForCaster } from '../../effects/ConcentrationCommands'
import { calculateProficiencyBonus } from '@/utils/character/savingThrowUtils'
import { getAbilityModifierValue } from '@/utils/character/statUtils'
import { generateId, resolveAttack } from '@/utils/combat'
import { matchingAttackRollEffects, consumeMatchedAttackRollEffects } from '../../effects/AttackRollModifierCommand';
import { rollDice, rollD20 } from '@/systems/dice/rollers'
import { combatEvents } from '@/systems/events/CombatEvents'
import { hasTauntAttackDisadvantage } from '@/systems/combat/tauntConstraint'
import { buildActiveFireEffect } from './fire'
import { conditionAttackBenefits } from '@/utils/combat/statusConditionUtils'

export type SpellAttackInstance = {
  target?: CombatCharacter
  objectTarget?: Extract<SelectedSpellTarget, { kind: 'object' }>
}



export class SpellAttackCommand implements SpellCommand {
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

    const baseAttackBonus = this.resolveSpellAttackBonus()
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
      let liveTarget = attackInstance.target
        ? (nextState.characters.find(character => character.id === attackInstance.target?.id) ?? attackInstance.target)
        : null
      const objectTarget = attackInstance.objectTarget
      const targetName = liveTarget?.name ?? objectTarget?.name ?? objectTarget?.id ?? 'object'
      const targetId = liveTarget?.id ?? objectTarget?.id ?? 'object'
      const liveCaster = nextState.characters.find(character => character.id === this.caster.id) ?? this.caster
      // Every beam uses the current condition without changing its spell's
      // published base attack bonus or the raw face's critical behavior.
      const exhaustionPenalty = getExhaustionD20Penalty(liveCaster)
      let attackBonus = baseAttackBonus - exhaustionPenalty
      const exhaustionText = exhaustionPenalty > 0 ? ` (Exhaustion -${exhaustionPenalty})` : ''
      const closeCombatPressure = weaponType === 'ranged' && rangedAttackPressure(nextState, liveCaster)
      let hasDisadvantage = liveTarget
        // Spell attacks obey the same source-viability rule as weapon attacks.
        // The live roster prevents a missing or downed taunter from imposing a
        // stale penalty while status cleanup is still being reconciled.
        ? hasTauntAttackDisadvantage(liveCaster, liveTarget.id, nextState.characters)
        : false
      // Spell attacks use the same declared incoming/outgoing roll riders as
      // weapons. Match against the live actor on every beam, then consume only
      // after that roll; a miss and advantage cancellation still spend a mark.
      const classification = { attackType: 'spell' as const, weaponType }
      const outgoing = matchingAttackRollEffects(liveCaster, 'outgoing', classification, liveTarget?.id)
      const incoming = liveTarget ? matchingAttackRollEffects(liveTarget, 'incoming', classification) : []
      const targetConditionBenefits = liveTarget
        ? conditionAttackBenefits(liveCaster, liveTarget, nextState.mapData) : null
      let hasAdvantage = targetConditionBenefits?.advantage ?? false
      const riderReasons: string[] = targetConditionBenefits?.advantage
        ? [`Target ${targetConditionBenefits.condition}`] : []
      for (const effect of [...outgoing, ...incoming]) {
        const m = effect.mechanics!
        if (m.attackRollModifier === 'advantage') { hasAdvantage = true; riderReasons.push(effect.sourceName) }
        if (m.attackRollModifier === 'disadvantage') { hasDisadvantage = true; riderReasons.push(effect.sourceName) }
        if (m.attackRollModifier === 'bonus' || m.attackRollModifier === 'penalty') {
          const value = (m.attackRollDice ? rollDice(m.attackRollDice) : 0) + (m.attackRollValue ?? 0)
          const signed = m.attackRollModifier === 'penalty' ? -value : value
          attackBonus += signed
          riderReasons.push(`${effect.sourceName} ${signed >= 0 ? '+' : ''}${signed}`)
        }
      }
      hasDisadvantage ||= closeCombatPressure
      const attackRoll = rollD20({ advantage: hasAdvantage && !hasDisadvantage, disadvantage: hasDisadvantage && !hasAdvantage })
      const rollModeText = hasAdvantage && hasDisadvantage ? ' (Advantage and Disadvantage cancel out)'
        : hasAdvantage ? ' (with Advantage)' : hasDisadvantage ? ' (with Disadvantage)' : ''
      const riderText = riderReasons.length ? ` (${riderReasons.join(', ')})` : ''
      nextState = consumeMatchedAttackRollEffects(nextState, liveCaster.id, outgoing)
      if (liveTarget) nextState = consumeMatchedAttackRollEffects(nextState, liveTarget.id, incoming)
      const pressureText = closeCombatPressure ? ` (Disadvantage: ${RANGED_PRESSURE_REASON})` : ''
      let targetAC = liveTarget?.armorClass || 10
      let resolvedAttack = resolveAttack(attackRoll, attackBonus, targetAC)
      const total = attackRoll + attackBonus

      // Resolve the same when-hit defense as weapons before any beam damage.
      if (resolvedAttack.isHit && liveTarget) {
        const reactionTarget = nextState.characters.find(character => character.id === liveTarget!.id) ?? liveTarget;
        const defense = await resolveDefensiveHitReaction(nextState, liveCaster, reactionTarget, total, 0, this.context, resolvedAttack.isCritical);
        nextState = defense.state;
        liveTarget = defense.target;
        targetAC = defense.targetAC;
        resolvedAttack = { ...resolvedAttack, isHit: defense.isHit };
      }

      // Apply the same live condition rule as weapons after defenses settle.
      // Objects have no creature conditions; a miss never becomes a hit.
      const hitConditionBenefits = liveTarget
        ? conditionAttackBenefits(liveCaster, liveTarget, nextState.mapData) : null
      const conditionCritical = resolvedAttack.isHit && !resolvedAttack.isCritical && hitConditionBenefits?.criticalOnHit
        && hitConditionBenefits.condition && hitConditionBenefits.distanceFeet !== undefined
        ? { condition: hitConditionBenefits.condition, distanceFeet: hitConditionBenefits.distanceFeet } : undefined
      if (conditionCritical) resolvedAttack = { ...resolvedAttack, isCritical: true }
      const criticalReasonText = conditionCritical ? ` (${conditionCritical.condition}: hit within 5 ft is critical)` : ''

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
            message: `${this.caster.name} casts ${this.spell.name} at ${targetName}. ${attackRoll} + ${attackBonus} = ${total}${exhaustionText}${rollModeText}${pressureText}${riderText}${criticalReasonText} vs AC ${targetAC}. ${resolvedAttack.isHit ? (resolvedAttack.isCritical ? 'CRITICAL HIT!' : 'HIT!') : (resolvedAttack.isAutoMiss ? 'CRITICAL MISS!' : 'MISS.')}`,
            characterId: this.caster.id,
            targetIds: [targetId],
            data: {
              spellId: this.spell.id,
              attackType: 'spell',
              advantage: hasAdvantage, disadvantage: hasDisadvantage, closeCombatPressure,
              attackRollModifierSources: riderReasons,
              weaponType,
              isHit: resolvedAttack.isHit,
              isCrit: resolvedAttack.isCritical,
              conditionCritical,
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
        const command = this.createHitCommand(this.normalizeSourceHitEffect(effect, nextState), {
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
      .filter((instance): instance is NonNullable<typeof instance> => instance !== null)

    const baseInstances = selectedInstances.length > 0
      ? selectedInstances
      : this.targets.map(target => ({ target }))

    if (!this.usesBeamAttackAllocation() || baseInstances.length === 0) {
      return baseInstances.slice(0, 1) as SpellAttackInstance[]
    }

    const beamCount = this.resolveBeamCount()
    if (baseInstances.length >= beamCount) {
      return baseInstances.slice(0, beamCount) as SpellAttackInstance[]
    }

    // Eldritch Blast can assign multiple beam instances to the same target.
    // When the cast provides fewer explicit refs than beams, repeat the final
    // selected ref rather than de-duplicating away the spell's scaling.
    const paddedInstances = [...baseInstances]
    while (paddedInstances.length < beamCount) {
      paddedInstances.push(baseInstances[baseInstances.length - 1])
    }

    return paddedInstances as SpellAttackInstance[]
  }

  private usesBeamAttackAllocation(): boolean {
    return (this.spell.targeting.type as string) === 'multi' &&
      this.spell.targeting.instanceAllocation?.instanceType === 'beam' &&
      this.spell.targeting.instanceAllocation.assignment === 'same_or_different_targets'
  }

  private resolveBeamCount(): number {
    // Comparing the literal `type` directly (no `as string`) keeps the
    // discriminated union narrowing, so `maxTargets` resolves without a cast.
    const maxTargets = this.spell.targeting.type === 'multi'
      ? this.spell.targeting.maxTargets
      : undefined

    if (maxTargets) {
      return Math.max(1, resolveScalableNumber(maxTargets, this.caster.level || 1))
    }

    const baseCount = this.spell.targeting.instanceAllocation?.baseCount
    return Math.max(1, typeof baseCount === 'number' ? baseCount : 1)
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

  /** Translate only the two legacy aliases in the declared Guiding Bolt rider.
   * Its canonical effect stays unchanged. The ordinary rider owner still
   * handles advantage, consumption and expiry after a confirmed hit. */
  private normalizeSourceHitEffect(effect: SpellEffect, state: CombatState): SpellEffect {
    if (this.spell.id !== 'guiding-bolt' || !('attackRollModifier' in effect)) return effect
    const rider = effect.attackRollModifier
    if (!rider || typeof rider !== 'object') return effect
    const packet = rider as Record<string, unknown>
    const duration = packet.duration
    if (packet.modifier !== 'advantage' || packet.direction !== 'incoming' || packet.attackKind !== 'any'
      || !['next_attack_roll', 'next_attack'].includes(String(packet.consumption))
      || !duration || typeof duration !== 'object' || !('type' in duration) || !('value' in duration)
      || duration.type !== 'rounds' || duration.value !== 1) return effect
    return {
      ...effect, type: 'ATTACK_ROLL_MODIFIER',
      attackRollModifier: {
        modifier: 'advantage', direction: 'incoming', attackKind: 'any', consumption: 'next_attack',
        // A normal cast skips this caster turn's end, then expires next end.
        // A reaction cast off-turn expires at the first future caster end.
        duration: { type: 'caster_turn_end', value: state.turnState.currentCharacterId === this.caster.id ? 2 : 1 },
        ...(typeof packet.notes === 'string' ? { notes: packet.notes } : {}),
      },
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
    if (this.spell.id === 'primal-savagery' || this.spell.attackType === 'melee' || (this.spell.targeting.type as string) === 'melee') {
      return 'melee'
    }

    return 'ranged'
  }

  private resolvePrimaryDamageDice(): string | undefined {
    const damageEffect = this.hitEffects.find(isDamageEffect)
    return damageEffect?.damage.dice
  }
}



export function shouldUseSpellAttackCommand(spell: Spell, activeEffects: SpellEffect[]): boolean {
  const hasExplicitSpellAttackType = ['melee', 'ranged'].includes(spell.attackType ?? '')
  // Legacy authored/test spells can predate structured targeting metadata.
  // Treat an absent targeting packet as "not explicitly melee" and let their
  // effects continue through the generic command path instead of crashing.
  const hasMeleeHitTargeting = (spell.targeting?.type as string) === 'melee'
  const isPrimalSavagery = spell.id === 'primal-savagery'
  // Guiding Bolt's canonical packet declares a ranged spell attack in its
  // description and hit-only effects, but currently has blank attackType.
  // Keep this explicit identity bridge beside the existing Primal Savagery
  // bridge; do not guess an attack type for every unrelated hit-gated spell.
  const isGuidingBolt = spell.id === 'guiding-bolt'
  const hasObjectIgnitionHitRider = activeEffects.some(effect =>
    isDamageEffect(effect) &&
    effect.condition?.type === 'hit' &&
    effect.createdObjects?.some(createdObject =>
      createdObject.ignitesTouchedObjects === true &&
      createdObject.appearsIn === 'target_object'
    )
  )

  if (!hasExplicitSpellAttackType && !hasMeleeHitTargeting && !hasObjectIgnitionHitRider && !isPrimalSavagery && !isGuidingBolt) {
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
