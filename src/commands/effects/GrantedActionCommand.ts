// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/07/2026, 14:04:24
 * Dependents: commands/factory/AbilityCommandFactory.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CommandContext } from '../base/SpellCommand'
import { CombatState, LightSource, Position, SelectedSpellTarget, SpellObjectImpact } from '../../types/combat'
import type { DamageEffect, DamageType, UtilityEffect } from '../../types/spells'
import { generateId } from '../../utils/idGenerator'
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

    if (this.context.spellId === 'dancing-lights' && actionLabel.toLowerCase() === 'move') {
      return this.executeDancingLightsMove(state, actor)
    }

    if (this.context.spellId === 'conjure-fey' && actionLabel === 'teleport_fey_spirit_and_make_melee_spell_attack') {
      return this.executeConjureFeyTeleport(state, actor, actionLabel)
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

  private executeConjureFeyTeleport(
    state: CombatState,
    actor: CombatState['characters'][0],
    actionLabel: string
  ): CombatState {
    const destination = this.context.selectedSpellTargets?.find(
      (target): target is Extract<SelectedSpellTarget, { kind: 'point' }> => target.kind === 'point'
    )
    const activeSpirit = state.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === this.context.spellId &&
      character.summonMetadata?.casterId === actor.id
    )

    if (!activeSpirit) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} has no Fey Spirit to teleport.`,
        characterId: actor.id,
        data: {
          spellId: this.context.spellId,
          grantedAction: actionLabel,
          rejectedConjureFeyTeleport: 'no_active_spirit'
        }
      })
    }

    if (!destination) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} needs a visible unoccupied destination for the Fey Spirit.`,
        characterId: actor.id,
        data: {
          spellId: this.context.spellId,
          grantedAction: actionLabel,
          rejectedConjureFeyTeleport: 'missing_destination'
        }
      })
    }

    const rangeLimit = this.options.rangeLimit ?? 30
    if (this.distanceFeet(activeSpirit.position, destination.position) > rangeLimit) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} cannot teleport the Fey Spirit more than ${rangeLimit} feet.`,
        characterId: actor.id,
        data: {
          spellId: this.context.spellId,
          grantedAction: actionLabel,
          rejectedConjureFeyTeleport: 'destination_out_of_range',
          rangeLimit
        }
      })
    }

    const occupied = state.characters.some(character =>
      character.id !== activeSpirit.id &&
      character.position.x === destination.position.x &&
      character.position.y === destination.position.y
    )
    if (occupied) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} cannot teleport the Fey Spirit into an occupied space.`,
        characterId: actor.id,
        data: {
          spellId: this.context.spellId,
          grantedAction: actionLabel,
          rejectedConjureFeyTeleport: 'destination_occupied',
          destination: destination.position
        }
      })
    }

    const nextState: CombatState = {
      ...state,
      characters: state.characters.map(character =>
        character.id === activeSpirit.id
          ? {
              ...character,
              position: destination.position
            }
          : character
      )
    }

    // Conjure Fey's later turns move the spirit first, then let the caster make
    // the same spirit-origin attack. The existing summon attack button owns the
    // attack roll and command budget; this bridge preserves the missing
    // teleport half so the live actor is actually in the new origin space.
    return this.addLogEntry(nextState, {
      type: 'action',
      message: `${actor.name} teleports the Fey Spirit up to ${rangeLimit} feet and prepares its spirit attack.`,
      characterId: actor.id,
      targetIds: this.context.targets.map(target => target.id),
      data: {
        spellId: this.context.spellId,
        grantedAction: actionLabel,
        grantedActionCost: this.options.actionCost,
        grantedActionFrequency: this.options.frequency,
        grantedActionRangeLimit: rangeLimit,
        teleportedSummonId: activeSpirit.id,
        destination: destination.position,
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

  private resolveAttackTarget(state: CombatState): {
    kind: 'creature';
    target: CombatState['characters'][0];
  } | {
    kind: 'object';
    target: Extract<SelectedSpellTarget, { kind: 'object' }>;
  } | null {
    const selectedObjectTarget = this.context.selectedSpellTargets?.find(
      (target): target is Extract<SelectedSpellTarget, { kind: 'object' }> => target.kind === 'object'
    )

    if (selectedObjectTarget) {
      return {
        kind: 'object',
        target: selectedObjectTarget
      }
    }

    const selectedCreatureTarget = this.context.selectedSpellTargets?.find(
      (target): target is Extract<SelectedSpellTarget, { kind: 'creature' }> => target.kind === 'creature'
    )

    if (selectedCreatureTarget) {
      const liveCreature = state.characters.find(character => character.id === selectedCreatureTarget.id)
      if (liveCreature) {
        return {
          kind: 'creature',
          target: liveCreature
        }
      }
    }

    const fallbackCreature = this.getTargets(state)[0]
    return fallbackCreature
      ? {
          kind: 'creature',
          target: fallbackCreature
        }
      : null
  }

  private executeDancingLightsMove(state: CombatState, actor: CombatState['characters'][0]): CombatState {
    const destinationPoints = this.context.selectedSpellTargets
      ?.filter((target): target is Extract<SelectedSpellTarget, { kind: 'point' }> => target.kind === 'point')
      .map(target => target.position) ?? []

    if (destinationPoints.length === 0) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} needs a destination point to move Dancing Lights.`,
        characterId: actor.id,
        data: {
          spellId: this.context.spellId,
          grantedAction: 'Move',
          rejectedDancingLightsMove: 'missing_destination'
        }
      })
    }

    const ownedLights = (state.activeLightSources || []).filter(light =>
      light.sourceSpellId === this.context.spellId &&
      light.casterId === actor.id
    )

    if (ownedLights.length === 0) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} has no Dancing Lights to move.`,
        characterId: actor.id,
        data: {
          spellId: this.context.spellId,
          grantedAction: 'Move',
          rejectedDancingLightsMove: 'no_active_lights'
        }
      })
    }

    const sortedLights = [...ownedLights].sort((left, right) => (left.clusterIndex ?? 0) - (right.clusterIndex ?? 0))
    const nextPositions = destinationPoints.length >= sortedLights.length
      ? destinationPoints.slice(0, sortedLights.length)
      : this.translateDancingLightsCluster(sortedLights, destinationPoints[0])

    const rangeLimit = this.options.rangeLimit ?? sortedLights[0]?.maxMoveDistanceFeet ?? 60
    const overMoveLimit = sortedLights.find((light, index) =>
      this.distanceFeet(light.position ?? light.originPosition ?? actor.position, nextPositions[index]) > rangeLimit
    )
    if (overMoveLimit) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} cannot move Dancing Lights more than ${rangeLimit} feet.`,
        characterId: actor.id,
        data: {
          spellId: this.context.spellId,
          grantedAction: 'Move',
          rejectedDancingLightsMove: 'move_distance',
          rangeLimit
        }
      })
    }

    const leashDistanceFeet = sortedLights[0]?.leashDistanceFeet ?? 20
    if (!this.positionsSatisfyDancingLightsLeash(nextPositions, leashDistanceFeet)) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `Dancing Lights must stay within ${leashDistanceFeet} feet of another light.`,
        characterId: actor.id,
        data: {
          spellId: this.context.spellId,
          grantedAction: 'Move',
          rejectedDancingLightsMove: 'leash',
          leashDistanceFeet
        }
      })
    }

    const spellRangeFeet = sortedLights[0]?.vanishesBeyondRangeFeet ?? 120
    const nextLightsById = new Map(sortedLights.map((light, index): [string, LightSource | null] => {
      const nextPosition = nextPositions[index]
      if (this.distanceFeet(actor.position, nextPosition) > spellRangeFeet) {
        return [light.id, null]
      }

      return [light.id, {
        ...light,
        position: nextPosition,
        originPosition: destinationPoints[0]
      }]
    }))

    const nextLightSources = (state.activeLightSources || [])
      .map(light => nextLightsById.has(light.id) ? nextLightsById.get(light.id) ?? null : light)
      .filter((light): light is LightSource => light !== null)

    const vanishedCount = sortedLights.length - [...nextLightsById.values()].filter(Boolean).length

    return this.addLogEntry({
      ...state,
      activeLightSources: nextLightSources
    }, {
      type: 'action',
      message: vanishedCount > 0
        ? `${actor.name} moves Dancing Lights; ${vanishedCount} light${vanishedCount === 1 ? '' : 's'} vanish beyond range.`
        : `${actor.name} moves Dancing Lights.`,
      characterId: actor.id,
      data: {
        spellId: this.context.spellId,
        grantedAction: 'Move',
        movedDancingLights: sortedLights.map(light => light.id),
        vanishedDancingLights: vanishedCount,
        destination: destinationPoints[0]
      }
    })
  }

  private translateDancingLightsCluster(lights: LightSource[], destination: Position): Position[] {
    const origin = lights[0]?.originPosition ?? lights[0]?.position ?? destination
    return lights.map(light => {
      const current = light.position ?? origin
      return {
        x: destination.x + (current.x - origin.x),
        y: destination.y + (current.y - origin.y)
      }
    })
  }

  private positionsSatisfyDancingLightsLeash(positions: Position[], leashDistanceFeet: number): boolean {
    if (positions.length <= 1) {
      return true
    }

    return positions.every((position, index) =>
      positions.some((otherPosition, otherIndex) =>
        otherIndex !== index && this.distanceFeet(position, otherPosition) <= leashDistanceFeet
      )
    )
  }

  private distanceFeet(from: Position, to: Position): number {
    return Math.hypot(to.x - from.x, to.y - from.y) * 5
  }

  private async executeAttackDamagePayload(
    state: CombatState,
    actionLabel: string
  ): Promise<CombatState> {
    const actor = this.getCaster(state)
    const targetSelection = this.resolveAttackTarget(state)

    // Target-selecting granted actions cannot resolve their damage without a
    // selected live target. Keep the failure visible in the combat log instead
    // of silently doing nothing.
    if (!targetSelection) {
      return this.addLogEntry(state, {
        type: 'status',
        message: `${actor.name} uses ${actionLabel}, but no valid target is selected.`,
        characterId: actor.id,
        data: this.createLogData(actionLabel)
      })
    }

    const targetName = targetSelection.kind === 'creature'
      ? targetSelection.target.name
      : targetSelection.target.name ?? targetSelection.target.object?.name ?? targetSelection.target.id
    const targetId = targetSelection.kind === 'creature'
      ? targetSelection.target.id
      : targetSelection.target.id
    const targetArmorClass = targetSelection.kind === 'creature'
      ? targetSelection.target.armorClass
      : 10

    const d20 = rollD20()
    const attackModifier = this.calculateSpellAttackModifier(actor)
    const attackResult = resolveAttack(d20, attackModifier, targetArmorClass)
    let currentState = this.addLogEntry(state, {
      type: 'action',
      message: `${actor.name} uses ${actionLabel} against ${targetName}. ${d20} + ${attackModifier} = ${attackResult.total} vs AC ${targetArmorClass}. ${attackResult.isHit ? (attackResult.isCritical ? 'CRITICAL HIT!' : 'HIT!') : (attackResult.isAutoMiss ? 'CRITICAL MISS!' : 'MISS.')}`,
      characterId: actor.id,
      targetIds: [targetId],
      data: {
        ...this.createLogData(actionLabel),
        attackRoll: d20,
        attackModifier,
        attackTotal: attackResult.total,
        targetArmorClass,
        isHit: attackResult.isHit,
        isCritical: attackResult.isCritical,
        isAutoMiss: attackResult.isAutoMiss
      }
    })

    // Hit damage is delegated to DamageCommand so resistance, concentration,
    // death-save, elemental-state, and summon-disappearance rules stay in the
    // same runtime path as ordinary spell damage.
    if (attackResult.isHit && this.options.damageDice && this.options.damageType) {
      if (targetSelection.kind === 'object') {
        const objectImpact: SpellObjectImpact = {
          id: generateId(),
          objectId: targetSelection.target.id,
          objectName: targetSelection.target.name ?? targetSelection.target.object?.name,
          position: targetSelection.target.position,
          sourceSpellId: this.context.spellId,
          sourceSpellName: this.context.spellName,
          casterId: actor.id,
          damage: {
            dice: this.resolveDamageDice(actor),
            type: this.options.damageType
          },
          createdTurn: state.turnState.currentTurn,
          expiresAtRound: state.turnState.currentTurn + 1
        }

        currentState = {
          ...currentState,
          spellObjectImpacts: [
            ...(currentState.spellObjectImpacts || []),
            objectImpact
          ],
          combatLog: [
            ...currentState.combatLog,
            {
              id: generateId(),
              timestamp: Date.now(),
              type: 'damage',
              message: `${targetName} takes ${objectImpact.damage.dice} ${objectImpact.damage.type} damage from ${actionLabel}.`,
              characterId: actor.id,
              targetIds: [targetId],
              data: {
                ...this.createLogData(actionLabel),
                objectImpact
              }
            }
          ]
        }
      } else {
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
          targets: [targetSelection.target],
          isCritical: attackResult.isCritical,
          attackType: this.options.attackType === 'melee_spell_attack' ? 'melee' : 'ranged'
        })

        currentState = await damageCommand.execute(currentState)
      }
    }

    currentState = this.reduceSpellZoneWallLength(currentState)

    return this.addWallLengthReductionLog(currentState, actor.id, targetId, actionLabel)
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
