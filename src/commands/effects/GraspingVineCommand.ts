// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/08/2026, 14:04:49
 * Dependents: commands/effects/GrantedActionCommand.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns Grasping Vine's composite initial and later attack events.
 *
 * The spell creates a vine at a selected point, makes one melee spell attack
 * immediately, and allows the caster to repeat that attack with a Bonus Action.
 * This command stores the vine as an active spell force and replays the same
 * authored damage, grapple, and pull rows for both event branches.
 *
 * Called by: SpellCommandFactory for the initial cast and GrantedActionCommand
 * for later Bonus Actions.
 * Depends on: the existing damage, condition, and movement commands so their
 * normal resistance, duration, collision, and logging rules remain authoritative.
 */

import type { CommandContext, CommandMetadata, SpellCommand } from '../base/SpellCommand'
import type { ActionCombatLogData, ActiveSpellForce, CombatCharacter, CombatState, Position } from '@/types/combat'
import type { DamageEffect, MovementEffect, SpellEffect, StatusConditionEffect } from '@/types/spells'
import { isDamageEffect } from '@/types/spells'
import { calculateProficiencyBonus, getAbilityModifierValue } from '@/utils/character'
import { generateId, resolveAttack, rollD20 } from '@/utils/combat'
import { DamageCommand } from './DamageCommand'
import { MovementCommand } from './MovementCommand'
import { StatusConditionCommand } from './StatusConditionCommand'

type GraspingVineExecutionMode = 'initial_cast' | 'repeat_bonus_action'

// ============================================================================
// Composite Vine Attack
// ============================================================================
// One command owns registration, attack range, hit resolution, and delegation
// to the three normal effect commands. This guarantees the initial and repeated
// branches execute the same source rows instead of slowly diverging.
// ============================================================================

export class GraspingVineCommand implements SpellCommand {
  public readonly id = generateId()
  public readonly description: string
  public readonly metadata: CommandMetadata

  constructor(
    private readonly context: CommandContext,
    private readonly effects: SpellEffect[],
    private readonly mode: GraspingVineExecutionMode
  ) {
    this.description = mode === 'initial_cast'
      ? `${context.caster.name} creates and attacks with Grasping Vine`
      : `${context.caster.name} repeats the Grasping Vine attack`
    this.metadata = {
      spellId: context.spellId,
      spellName: context.spellName,
      casterId: context.caster.id,
      casterName: context.caster.name,
      targetIds: context.targets.map(target => target.id),
      effectType: 'grasping_vine_composite_attack',
      timestamp: Date.now()
    }
  }

  async execute(state: CombatState): Promise<CombatState> {
    const caster = state.characters.find(character => character.id === this.context.caster.id)
    if (!caster) return state

    const forceResult = this.resolveActiveVine(state, caster)
    let nextState = forceResult.state
    const vine = forceResult.vine

    if (!vine) {
      return this.addLogEntry(nextState, caster, 'Grasping Vine has no active vine origin.', {
        sourceSpellId: this.context.spellId,
        notes: 'missing_active_vine'
      })
    }

    const targetSnapshot = this.context.targets[0]
    const target = targetSnapshot
      ? nextState.characters.find(character => character.id === targetSnapshot.id)
      : undefined

    // Point-first targeting can create the vine even if no creature was chosen.
    // Keep that state alive and explain why the immediate attack could not run.
    if (!target) {
      return this.addLogEntry(nextState, caster, 'Grasping Vine needs a creature target for its attack.', {
        sourceSpellId: this.context.spellId,
        notes: 'missing_target'
      })
    }

    if (this.distanceFeet(vine.position, target.position) > vine.reachFeet) {
      return this.addLogEntry(nextState, caster, `${target.name} is beyond Grasping Vine's ${vine.reachFeet}-foot reach.`, {
        sourceSpellId: this.context.spellId,
        targetId: target.id,
        notes: 'target_out_of_vine_range'
      })
    }

    const attackRoll = rollD20()
    const attackBonus = this.resolveSpellAttackBonus(caster)
    const targetArmorClass = target.armorClass ?? 10
    const attackResult = resolveAttack(attackRoll, attackBonus, targetArmorClass)

    nextState = this.addLogEntry(
      nextState,
      caster,
      `${caster.name}'s Grasping Vine attacks ${target.name}: ${attackRoll} + ${attackBonus} = ${attackResult.total} vs AC ${targetArmorClass}. ${attackResult.isHit ? 'HIT!' : 'MISS.'}`,
      {
        sourceSpellId: this.context.spellId,
        targetId: target.id,
        attackRoll,
        attackModifier: attackBonus,
        attackTotal: attackResult.total,
        targetArmorClass,
        isHit: attackResult.isHit,
        actionType: this.mode
      }
    )

    if (!attackResult.isHit) return nextState

    // A vine with a one-creature grapple cap releases its previous target when
    // a later hit grapples someone else. Both status and condition mirrors are
    // cleared before the new hit rows execute.
    nextState = this.releasePreviousGrapple(nextState, target.id)

    const attackEffects = vine.followUpEffects ?? this.effects
    for (const effect of attackEffects) {
      const effectContext: CommandContext = {
        ...this.context,
        targets: [nextState.characters.find(character => character.id === target.id) ?? target],
        selectedSpellTargets: [{ kind: 'creature', id: target.id }],
        effectOriginPosition: vine.position,
        isCritical: attackResult.isCritical
      }

      const command = this.createHitCommand(effect, effectContext)
      if (command) {
        nextState = await command.execute(nextState)
      }
    }

    return nextState
  }

  private resolveActiveVine(
    state: CombatState,
    caster: CombatCharacter
  ): { state: CombatState; vine?: ActiveSpellForce } {
    const existingVine = state.activeSpellForces?.find(force =>
      force.spellId === this.context.spellId &&
      force.casterId === caster.id &&
      force.kind === 'grasping_vine' &&
      force.active
    )

    if (this.mode === 'repeat_bonus_action') {
      return { state, vine: existingVine }
    }

    const pointTarget = this.context.selectedSpellTargets?.find(
      (target): target is Extract<NonNullable<CommandContext['selectedSpellTargets']>[number], { kind: 'point' }> => target.kind === 'point'
    )
    const position = pointTarget?.position
    if (!position) {
      return { state }
    }

    const damageEffect = this.effects.find(isDamageEffect)
    const retainedForces = (state.activeSpellForces ?? []).filter(force =>
      force.spellId !== this.context.spellId || force.casterId !== caster.id
    )
    const vine: ActiveSpellForce = {
      id: `spell_force_grasping_vine_${generateId()}`,
      spellId: this.context.spellId,
      spellName: this.context.spellName,
      casterId: caster.id,
      kind: 'grasping_vine',
      entityType: 'conjured_vine',
      position,
      reachFeet: this.resolveRepeatRangeFeet(damageEffect),
      moveDistanceFeet: 0,
      moveAction: 'stationary',
      repeatAttack: 'Bonus Action on later turns',
      damage: damageEffect ? `${damageEffect.damage.dice} ${damageEffect.damage.type}` : '4d8 Bludgeoning',
      occupiesSpace: false,
      active: true,
      createdTurn: state.turnState.currentTurn,
      expiresAtRound: state.turnState.currentTurn + this.resolveDurationRounds(),
      followUpEffects: this.effects
    }

    const nextState: CombatState = {
      ...state,
      activeSpellForces: [...retainedForces, vine]
    }

    return {
      state: this.addLogEntry(nextState, caster, `${caster.name} creates Grasping Vine at the selected point.`, {
        sourceSpellId: this.context.spellId,
        destination: position,
        actionType: this.mode
      }),
      vine
    }
  }

  private createHitCommand(effect: SpellEffect, context: CommandContext): SpellCommand | null {
    if (isDamageEffect(effect)) {
      return new DamageCommand(this.asImmediateDamage(effect), context)
    }

    if (effect.type === 'STATUS_CONDITION') {
      return new StatusConditionCommand(effect as StatusConditionEffect, context)
    }

    if (effect.type === 'MOVEMENT') {
      return new MovementCommand(effect as MovementEffect, context)
    }

    return null
  }

  private asImmediateDamage(effect: DamageEffect): DamageEffect {
    return {
      ...effect,
      trigger: {
        ...effect.trigger,
        type: 'immediate'
      }
    }
  }

  private releasePreviousGrapple(state: CombatState, nextTargetId: string): CombatState {
    return {
      ...state,
      characters: state.characters.map(character => {
        if (character.id === nextTargetId) return character

        const statusEffects = character.statusEffects.filter(status =>
          !(status.name === 'Grappled' && status.source === this.context.spellName && status.sourceCasterId === this.context.caster.id)
        )
        const conditions = character.conditions?.filter(condition =>
          !(condition.name === 'Grappled' && condition.source === this.context.spellName && condition.sourceCasterId === this.context.caster.id)
        )

        if (statusEffects.length === character.statusEffects.length && conditions?.length === character.conditions?.length) {
          return character
        }

        return {
          ...character,
          statusEffects,
          conditions
        }
      })
    }
  }

  private resolveSpellAttackBonus(caster: CombatCharacter): number {
    const explicitBonus = (caster as CombatCharacter & { spellAttackBonus?: number }).spellAttackBonus
    if (typeof explicitBonus === 'number') return explicitBonus

    const abilityName = caster.spellcastingAbility ?? caster.class?.spellcasting?.ability ?? 'Intelligence'
    const abilityScore = Number(caster.stats[abilityName.toLowerCase() as keyof CombatCharacter['stats']] ?? 10)
    return getAbilityModifierValue(abilityScore) + calculateProficiencyBonus(caster.level || 1)
  }

  private resolveRepeatRangeFeet(damageEffect: DamageEffect | undefined): number {
    const repeatAction = damageEffect?.trigger.repeatAction as { range?: unknown } | undefined
    return typeof repeatAction?.range === 'number' ? repeatAction.range : 30
  }

  private resolveDurationRounds(): number {
    const duration = this.context.effectDuration
    if (!duration || typeof duration.value !== 'number') return 10
    if (duration.type === 'rounds') return duration.value
    if (duration.type === 'minutes') return duration.value * 10
    return 10
  }

  private distanceFeet(from: Position, to: Position): number {
    return Math.hypot(to.x - from.x, to.y - from.y) * 5
  }

  private addLogEntry(
    state: CombatState,
    caster: CombatCharacter,
    message: string,
    data: ActionCombatLogData
  ): CombatState {
    return {
      ...state,
      combatLog: [
        ...(state.combatLog ?? []),
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message,
          characterId: caster.id,
          targetIds: this.context.targets.map(target => target.id),
          data
        }
      ]
    }
  }
}
