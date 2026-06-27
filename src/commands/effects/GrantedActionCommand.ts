import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { CombatState } from '../../types/combat'
import type { DamageEffect, DamageType, UtilityEffect } from '../../types/spells'
import { rollD20, resolveAttack } from '../../utils/combatUtils'
import { getAbilityModifierValue } from '../../utils/character/statUtils'
import { calculateProficiencyBonus } from '../../utils/character/savingThrowUtils'
import { DamageCommand } from './DamageCommand'
import { BreakConcentrationCommand } from './ConcentrationCommands'

/**
 * This command records a spell-granted follow-up action being used.
 *
 * Several spells create later player options after the initial cast, such as
 * manipulating an illusion or firing a sustained beam. The exact spell-specific
 * payload still belongs to later runtime slices, but this command makes the
 * granted action a real executable combat action instead of a JSON-only note.
 *
 * Called by: AbilityCommandFactory for generated granted-action abilities.
 * Depends on: AbilityPalette creating a temporary ability from Ability.grantedActions.
 */

export interface GrantedActionCommandOptions {
  actionLabel?: string;
  actionCost?: 'action' | 'bonus_action' | 'reaction';
  frequency?: 'once' | 'each_turn' | 'while_active';
  rangeLimit?: number;
  prerequisites?: ('target_object_within_spell_range' | 'target_within_spell_range' | 'not_applicable')[];
  attackType?: 'ranged_spell_attack' | 'melee_spell_attack' | 'not_applicable';
  areaShape?: 'Cone' | 'Line' | 'Sphere' | 'Cube' | 'Cylinder' | 'not_applicable';
  areaSize?: number | 'not_applicable';
  areaSizeUnit?: 'feet' | 'miles' | 'not_applicable';
  damageDice?: string;
  damageType?: DamageType;
  saveType?: 'Strength' | 'Dexterity' | 'Constitution' | 'Intelligence' | 'Wisdom' | 'Charisma';
  saveEffect?: 'none' | 'half' | 'negates_condition';
  damageAbilityModifier?: 'spellcasting_ability' | 'not_applicable';
  wallLengthReduction?: number;
  endsWhenLengthZero?: boolean;
  notes?: string;
}

function createGrantedActionEffect(options: GrantedActionCommandOptions): UtilityEffect {
  // The shared command base expects a spell effect shape. This lightweight
  // utility effect keeps the command in the normal spell-command pipeline while
  // the concrete execute method below writes the player-visible action record.
  return {
    type: 'UTILITY',
    utilityType: 'other',
    description: options.notes ?? options.actionLabel ?? 'Uses a spell-granted follow-up action',
    trigger: { type: 'immediate' },
    condition: { type: 'always' }
  }
}

export class GrantedActionCommand extends BaseEffectCommand {
  constructor(
    protected context: CommandContext,
    private options: GrantedActionCommandOptions = {}
  ) {
    super(createGrantedActionEffect(options), context)
  }

  async execute(state: CombatState): Promise<CombatState> {
    const actor = this.getCaster(state)
    const actionLabel = this.options.actionLabel ?? this.context.spellName
    const targetIds = this.context.targets.map(target => target.id)

    // Some granted actions, such as Wall of Light's beam, include enough
    // structured payload to resolve a real spell attack and delegate hit damage
    // to the existing damage engine. Actions without that payload still fall
    // back to the generic log record below so illusion/manipulation buttons do
    // not become inert while their bespoke behavior waits for later slices.
    if (this.hasAttackDamagePayload()) {
      return this.executeAttackDamagePayload(state, actionLabel)
    }

    // The concrete mechanics for individual granted actions are intentionally
    // not invented here. Logging the execution gives the turn system and player
    // a real action record while keeping spell-specific payloads explicit gaps.
    return this.addLogEntry(state, {
      type: 'action',
      message: `${actor.name} uses ${actionLabel}`,
      characterId: actor.id,
      targetIds,
      data: {
        spellId: this.context.spellId,
        grantedAction: actionLabel,
        grantedActionCost: this.options.actionCost,
        grantedActionFrequency: this.options.frequency,
        grantedActionRangeLimit: this.options.rangeLimit,
        grantedActionPrerequisites: this.options.prerequisites,
        grantedActionAttackType: this.options.attackType,
        grantedActionAreaShape: this.options.areaShape,
        grantedActionAreaSize: this.options.areaSize,
        grantedActionAreaSizeUnit: this.options.areaSizeUnit,
        grantedActionDamageDice: this.options.damageDice,
        grantedActionDamageType: this.options.damageType,
        grantedActionSaveType: this.options.saveType,
        grantedActionSaveEffect: this.options.saveEffect,
        grantedActionDamageAbilityModifier: this.options.damageAbilityModifier,
        grantedActionWallLengthReduction: this.options.wallLengthReduction,
        grantedActionEndsWhenLengthZero: this.options.endsWhenLengthZero,
        notes: this.options.notes
      }
    })
  }

  get description(): string {
    return `${this.context.caster.name} uses ${this.options.actionLabel ?? 'a spell-granted action'}`
  }

  private hasAttackDamagePayload(): boolean {
    // A granted action becomes a concrete attack only when both the attack model
    // and the damage payload are explicit. This avoids turning descriptive
    // notes into mechanics by accident.
    return (
      this.options.attackType === 'ranged_spell_attack' ||
      this.options.attackType === 'melee_spell_attack'
    ) && !!this.options.damageDice && !!this.options.damageType
  }

  private async executeAttackDamagePayload(
    state: CombatState,
    actionLabel: string
  ): Promise<CombatState> {
    const actor = this.getCaster(state)
    const target = this.getTargets(state)[0]

    // Target-selecting granted actions cannot resolve their damage without a
    // selected live target. Keep the failure visible in the combat log instead
    // of silently doing nothing.
    if (!target) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} uses ${actionLabel}, but no valid target is selected.`,
        characterId: actor.id,
        data: this.createLogData(actionLabel)
      })
    }

    const d20 = rollD20()
    const attackModifier = this.calculateSpellAttackModifier(actor)
    const attackResult = resolveAttack(d20, attackModifier, target.armorClass)
    let currentState = this.addLogEntry(state, {
      type: 'action',
      message: `${actor.name} uses ${actionLabel} against ${target.name}. ${d20} + ${attackModifier} = ${attackResult.total} vs AC ${target.armorClass}. ${attackResult.isHit ? (attackResult.isCritical ? 'CRITICAL HIT!' : 'HIT!') : (attackResult.isAutoMiss ? 'CRITICAL MISS!' : 'MISS.')}`,
      characterId: actor.id,
      targetIds: [target.id],
      data: {
        ...this.createLogData(actionLabel),
        attackRoll: d20,
        attackModifier,
        attackTotal: attackResult.total,
        targetArmorClass: target.armorClass,
        isHit: attackResult.isHit,
        isCritical: attackResult.isCritical,
        isAutoMiss: attackResult.isAutoMiss
      }
    })

    // Hit damage is delegated to DamageCommand so resistance, concentration,
    // death-save, elemental-state, and summon-disappearance rules stay in the
    // same runtime path as ordinary spell damage.
    if (attackResult.isHit && this.options.damageDice && this.options.damageType) {
      const damageEffect: DamageEffect = {
        type: 'DAMAGE',
        trigger: { type: 'immediate' },
        condition: { type: 'hit' },
        damage: {
          dice: this.resolveDamageDice(actor),
          type: this.options.damageType
        }
      }

      const damageCommand = new DamageCommand(damageEffect, {
        ...this.context,
        targets: [target],
        isCritical: attackResult.isCritical,
        attackType: this.options.attackType === 'melee_spell_attack' ? 'melee' : 'ranged'
      })

      currentState = await damageCommand.execute(currentState)
    }

    currentState = this.reduceSpellZoneWallLength(currentState)

    return this.addWallLengthReductionLog(currentState, actor.id, target.id, actionLabel)
  }

  private calculateSpellAttackModifier(actor: CombatState['characters'][0]): number {
    // Spell attacks use the same caster ability and proficiency formula as
    // spell save DCs: proficiency plus the class spellcasting ability modifier.
    return calculateProficiencyBonus(actor.level || 1) + this.calculateSpellcastingAbilityModifier(actor)
  }

  private calculateSpellcastingAbilityModifier(actor: CombatState['characters'][0]): number {
    const abilityName = actor.class?.spellcasting?.ability || 'Intelligence'
    const abilityScore = (actor.stats[abilityName.toLowerCase() as keyof typeof actor.stats] || 10) as number
    return getAbilityModifierValue(abilityScore)
  }

  private addWallLengthReductionLog(
    state: CombatState,
    actorId: string,
    targetId: string,
    actionLabel: string
  ): CombatState {
    // Wall of Light reduces its wall length whether the beam hits or misses.
    // The zone state is mutated before this log is written so the log can report
    // the new remaining length when a matching spell-created wall zone exists.
    if (!this.options.wallLengthReduction) {
      return state
    }

    const matchingZone = state.spellZones?.find(zone =>
      zone.spellId === this.context.spellId &&
      zone.casterId === this.context.caster.id &&
      zone.areaOfEffect?.shape?.toLowerCase() === 'wall'
    )

    return this.addLogEntry(state, {
      type: 'status',
      message: matchingZone?.remainingWallLength !== undefined
        ? `${actionLabel} reduces ${this.context.spellName}'s wall length by ${this.options.wallLengthReduction} feet; ${matchingZone.remainingWallLength} feet remain.`
        : `${actionLabel} reduces ${this.context.spellName}'s wall length by ${this.options.wallLengthReduction} feet.`,
      characterId: actorId,
      targetIds: [targetId],
      data: this.createLogData(actionLabel)
    })
  }

  private createLogData(actionLabel: string): Record<string, unknown> {
    return {
      spellId: this.context.spellId,
      grantedAction: actionLabel,
      grantedActionCost: this.options.actionCost,
      grantedActionFrequency: this.options.frequency,
      grantedActionRangeLimit: this.options.rangeLimit,
      grantedActionPrerequisites: this.options.prerequisites,
      grantedActionAttackType: this.options.attackType,
      grantedActionAreaShape: this.options.areaShape,
      grantedActionAreaSize: this.options.areaSize,
      grantedActionAreaSizeUnit: this.options.areaSizeUnit,
      grantedActionDamageDice: this.options.damageDice,
      grantedActionDamageType: this.options.damageType,
      grantedActionSaveType: this.options.saveType,
      grantedActionSaveEffect: this.options.saveEffect,
      grantedActionDamageAbilityModifier: this.options.damageAbilityModifier,
      grantedActionWallLengthReduction: this.options.wallLengthReduction,
      grantedActionEndsWhenLengthZero: this.options.endsWhenLengthZero,
      notes: this.options.notes
    }
  }

  private reduceSpellZoneWallLength(state: CombatState): CombatState {
    // If a granted action declares no wall reduction, or this command state has
    // no live zones, leave state untouched. This keeps illusion and familiar
    // granted actions away from wall-specific behavior.
    if (!this.options.wallLengthReduction || !state.spellZones?.length) {
      return state
    }

    let removedAtZero = false
    const nextZones = state.spellZones.flatMap(zone => {
      // Match the caster-owned wall created by the source spell. This avoids
      // shrinking another caster's copy of the same spell in crowded combats.
      const isMatchingWall = zone.spellId === this.context.spellId &&
        zone.casterId === this.context.caster.id &&
        zone.areaOfEffect?.shape?.toLowerCase() === 'wall'

      if (!isMatchingWall) {
        return [zone]
      }

      const startingLength = zone.remainingWallLength ?? zone.areaOfEffect?.size ?? this.options.wallLengthReduction ?? 0
      const remainingWallLength = Math.max(0, startingLength - this.options.wallLengthReduction)

      if (remainingWallLength <= 0 && this.options.endsWhenLengthZero) {
        removedAtZero = true
        return []
      }

      return [{
        ...zone,
        remainingWallLength,
        originalWallLength: zone.originalWallLength ?? zone.areaOfEffect?.size,
        endsWhenLengthZero: this.options.endsWhenLengthZero
      }]
    })

    const stateWithReducedZones = {
      ...state,
      spellZones: nextZones,
      combatLog: removedAtZero
        ? [
          ...state.combatLog,
          {
            id: `${this.id}-wall-ended`,
            timestamp: Date.now(),
            type: 'status',
            message: `${this.context.spellName}'s wall length reaches 0 feet, so the wall zone ends.`,
            characterId: this.context.caster.id,
            data: this.createLogData(this.options.actionLabel ?? this.context.spellName)
          }
        ]
        : state.combatLog
    }

    return this.clearMatchingConcentrationForEndedWall(stateWithReducedZones, removedAtZero)
  }

  private resolveDamageDice(actor: CombatState['characters'][0]): string {
    if (this.options.damageAbilityModifier !== 'spellcasting_ability') {
      return this.options.damageDice ?? '0'
    }

    // Flame Blade and similar conjured spell attacks add the caster's
    // spellcasting modifier to damage. Add it to the dice expression at the
    // command boundary so DamageCommand still owns resistance, criticals,
    // concentration, and damage logging.
    const modifier = this.calculateSpellcastingAbilityModifier(actor)
    const sign = modifier >= 0 ? '+' : ''
    return `${this.options.damageDice ?? '0'}${sign}${modifier}`
  }

  private clearMatchingConcentrationForEndedWall(
    state: CombatState,
    removedAtZero: boolean
  ): CombatState {
    // Wall of Light says the spell ends when repeated beams consume the whole
    // wall. Reuse the existing concentration-break cleanup path so related
    // active effects, lights, and summons do not outlive the ended spell. The
    // spell-id guard prevents a stale granted-action button from canceling a
    // different concentration spell the caster may have started later.
    if (!removedAtZero || !this.options.endsWhenLengthZero) {
      return state
    }

    const caster = this.getCaster(state)
    if (caster.concentratingOn?.spellId !== this.context.spellId) {
      return state
    }

    const breakCommand = new BreakConcentrationCommand({
      ...this.context,
      caster,
      targets: []
    })

    return breakCommand.execute(state)
  }
}
