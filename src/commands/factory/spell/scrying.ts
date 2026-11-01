/**
 * @file scrying.ts
 * Resolves Scrying saves, sensors and target lockouts before ordinary utility effects.
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
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Spell, UtilityEffect, isUtilityEffect } from '@/types/spells'
import { ActiveSpellHelper, ActiveSpellTargetLockout, CombatCharacter, CombatState, SelectedSpellTarget } from '@/types/combat'
import { SpellCommand, CommandContext, CommandMetadata } from '../../base/SpellCommand'
import { StartConcentrationCommand, BreakConcentrationCommand } from '../../effects/ConcentrationCommands'
import { generateId } from '@/utils/combat'
import { calculateSpellDC, rollSavingThrow } from '@/utils/character/savingThrowUtils'
import type { SavingThrowModifier, SavingThrowResult } from '@/utils/character/savingThrowUtils'
import { resolveSpellDurationRounds } from './fire'
import { SpellBridgeContext } from './bridgeContext'

export type ScryingSelection = {
  mode: 'creature' | 'location'
  knowledge?: string
  connection?: string
  targetKnowsCasting: boolean
  voluntaryFailure: boolean
}



export const normalizeScryingChoice = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')



/** Reads the compact choice payload passed through the existing spell-input bridge. */
export const parseScryingSelection = (playerInput?: string): ScryingSelection => {
  const tokens = (playerInput ?? '')
    .split(';')
    .map(token => token.trim())
    .filter(Boolean)
  const selection: ScryingSelection = {
    mode: tokens.some(token => normalizeScryingChoice(token) === 'location target') ? 'location' : 'creature',
    targetKnowsCasting: false,
    voluntaryFailure: false
  }

  for (const token of tokens) {
    const separator = token.indexOf('=')
    if (separator < 0) continue
    const key = normalizeScryingChoice(token.slice(0, separator)).replace(/[ _-]/g, '')
    const value = token.slice(separator + 1).trim()
    if (key === 'knowledge' || key === 'familiarity') selection.knowledge = value
    if (key === 'connection' || key === 'physicalconnection') selection.connection = value
    if (key === 'targetknowscasting' || key === 'knowscasting') selection.targetKnowsCasting = value.toLowerCase() === 'true'
    if (key === 'voluntaryfailure' || key === 'voluntaryfail') selection.voluntaryFailure = value.toLowerCase() === 'true'
  }

  return selection
}



export const resolveScryingSaveModifiers = (
  effect: UtilityEffect,
  selection: ScryingSelection
): SavingThrowModifier[] => {
  const modifiers: SavingThrowModifier[] = []
  const sourceChoices = [
    { source: 'knowledge', selected: selection.knowledge },
    { source: 'connection', selected: selection.connection }
  ]

  for (const { source, selected } of sourceChoices) {
    if (!selected) continue
    const sourceModifier = effect.condition.saveModifiers?.find(modifier =>
      modifier.source?.toLowerCase() === source
    )
    const option = sourceModifier?.options?.find(candidate =>
      normalizeScryingChoice(candidate.label) === normalizeScryingChoice(selected)
    )
    if (option) {
      modifiers.push({
        flat: option.modifier,
        source: `Scrying ${source}: ${option.label}`
      })
    }
  }

  return modifiers
}



export const createScryingSensorState = (
  state: CombatState,
  spell: Spell,
  effect: UtilityEffect,
  caster: CombatCharacter,
  context: CommandContext,
  selection: ScryingSelection,
  target?: CombatCharacter
): CombatState => {
  const pointTarget = context.selectedSpellTargets?.find(
    (selectedTarget): selectedTarget is Extract<SelectedSpellTarget, { kind: 'point' }> => selectedTarget.kind === 'point'
  )
  const sensorState = effect.sensorState ?? {}
  const senses = Array.isArray(sensorState.senses)
    ? sensorState.senses.filter((sense): sense is string => typeof sense === 'string')
    : ['sight', 'hearing']
  const sensor: ActiveSpellHelper = {
    id: `spell_helper_scrying_sensor_${generateId()}`,
    spellId: spell.id,
    spellName: spell.name,
    casterId: caster.id,
    kind: 'scrying_sensor',
    entityType: 'invisible_remote_sensor',
    position: target?.position ?? pointTarget?.position ?? caster.position,
    size: 'Tiny',
    creature: false,
    occupiesSpace: false,
    active: true,
    createdTurn: state.turnState.currentTurn,
    expiresAtRound: state.turnState.currentTurn + resolveSpellDurationRounds(spell),
    remoteSensor: {
      mode: selection.mode === 'location' ? 'location_stationary' : 'creature_following',
      targetId: target?.id,
      followDistanceFeet: selection.mode === 'creature' ? 10 : undefined,
      senses,
      visibility: typeof sensorState.visibleTo === 'string' ? 'invisible' : undefined,
      visibleAs: typeof sensorState.visibleTo === 'string' ? sensorState.visibleTo : undefined
    }
  }
  const previousHelpers = state.activeSpellHelpers ?? []
  const retainedHelpers = previousHelpers.filter(helper =>
    helper.spellId !== spell.id || helper.casterId !== caster.id
  )
  return {
    ...state,
    activeSpellHelpers: [...retainedHelpers, sensor],
    combatLog: [
      ...state.combatLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        type: 'summon',
        message: selection.mode === 'location'
          ? `${caster.name} places an invisible Scrying sensor at the chosen location.`
          : `${caster.name} creates an invisible Scrying sensor within 10 feet of ${target?.name ?? 'the target'}.`,
        characterId: caster.id,
        targetIds: target ? [target.id] : undefined,
        data: {
          spellId: spell.id,
          spellHelperSurface: 'scrying_sensor',
          spellHelper: sensor,
          removedRecastHelpers: previousHelpers.length - retainedHelpers.length
        }
      }
    ]
  }
}



export const addScryingTargetLockout = (
  state: CombatState,
  spell: Spell,
  target: CombatCharacter
): CombatState => {
  const createdAtTimestamp = Date.now()
  const lockout: ActiveSpellTargetLockout = {
    id: `spell_target_lockout_scrying_${generateId()}`,
    spellId: spell.id,
    targetId: target.id,
    targetName: target.name,
    createdAtTimestamp,
    expiresAtTimestamp: createdAtTimestamp + 24 * 60 * 60 * 1000,
    reason: 'successful Wisdom save prevents Scrying retargeting for 24 hours'
  }
  const activeLockouts = (state.activeSpellTargetLockouts ?? []).filter(existing =>
    existing.expiresAtTimestamp > createdAtTimestamp &&
    !(existing.spellId === spell.id && existing.targetId === target.id)
  )
  return {
    ...state,
    activeSpellTargetLockouts: [...activeLockouts, lockout]
  }
}



/** Resolves Scrying's authored creature-save choices before generic utility narration. */
export class ScryingBridgeCommand implements SpellCommand {
  public readonly id = generateId()
  public readonly description: string
  public readonly metadata: CommandMetadata

  constructor(
    private readonly spell: Spell,
    private readonly effect: UtilityEffect,
    private readonly caster: CombatCharacter,
    private readonly context: CommandContext
  ) {
    this.description = `${spell.name} resolves the target's Wisdom save and authored save modifiers`
    this.metadata = {
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      casterName: caster.name,
      targetIds: context.targets.map(target => target.id),
      effectType: 'scrying_save',
      timestamp: Date.now()
    }
  }

  execute(state: CombatState): CombatState {
    const selection = parseScryingSelection(this.context.playerInput)
    const target = state.characters.find(character => character.id === this.context.targets[0]?.id)
    if (selection.mode === 'location') {
      const sensorState = createScryingSensorState(state, this.spell, this.effect, this.caster, this.context, selection)
      return this.spell.duration.concentration
        ? new StartConcentrationCommand(this.spell, this.context).execute(sensorState)
        : sensorState
    }
    if (!target) {
      return {
        ...state,
        combatLog: [
          ...state.combatLog,
          {
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `${this.spell.name} creature mode needs a creature target.`,
            characterId: this.caster.id,
            data: { spellId: this.spell.id, rejectedReason: 'missing_creature_target' }
          }
        ]
      }
    }

    const now = Date.now()
    const activeLockouts = (state.activeSpellTargetLockouts ?? []).filter(lockout =>
      lockout.expiresAtTimestamp > now
    )
    const targetLockout = activeLockouts.find(lockout =>
      lockout.spellId === this.spell.id && lockout.targetId === target.id
    )
    if (targetLockout) {
      return {
        ...state,
        activeSpellTargetLockouts: activeLockouts,
        combatLog: [
          ...state.combatLog,
          {
            id: generateId(),
            timestamp: now,
            type: 'action',
            message: `${target.name} cannot be targeted by ${this.spell.name} again for 24 hours after succeeding on the Wisdom save.`,
            characterId: this.caster.id,
            targetIds: [target.id],
            data: {
              spellId: this.spell.id,
              rejectedReason: 'target_locked_out_24_hours',
              lockoutExpiresAtTimestamp: targetLockout.expiresAtTimestamp
            }
          }
        ]
      }
    }

    const caster = state.characters.find(character => character.id === this.caster.id) ?? this.caster
    const spellDc = calculateSpellDC(caster)
    const saveModifiers = resolveScryingSaveModifiers(this.effect, selection)
    const voluntaryFailureRule = this.effect.condition.saveOutcomeOverrides?.find(override =>
      override.outcome === 'voluntary_failure'
    )
    const successRule = this.effect.condition.saveOutcomeOverrides?.find(override =>
      override.outcome === 'success'
    )
    const voluntaryFailure = Boolean(
      voluntaryFailureRule &&
      selection.targetKnowsCasting &&
      selection.voluntaryFailure
    )
    const saveResult: SavingThrowResult = voluntaryFailure
      ? {
          success: false,
          roll: 0,
          total: 0,
          dc: spellDc,
          natural20: false,
          natural1: false,
          modifiersApplied: saveModifiers.map(modifier => ({
            source: modifier.source,
            value: modifier.flat ?? 0
          }))
        }
      : rollSavingThrow(target, 'Wisdom', spellDc, saveModifiers)
    const outcomeOverride = voluntaryFailure
      ? 'voluntary_failure'
      : saveResult.success
        ? (successRule ? 'success_no_effect_24_hours' : undefined)
        : undefined
    const nextState: CombatState = {
      ...state,
      combatLog: [
        ...state.combatLog,
        {
          id: generateId(),
          timestamp: Date.now(),
          type: 'status',
          message: voluntaryFailure
            ? `${target.name} voluntarily fails the Wisdom save against ${this.spell.name}.`
            : `${target.name} ${saveResult.success ? 'succeeds' : 'fails'} the Wisdom save (${saveResult.total} vs DC ${spellDc}) against ${this.spell.name}.`,
          characterId: target.id,
          targetIds: [target.id],
          data: {
            spellId: this.spell.id,
            saveType: 'Wisdom',
            saveTotal: saveResult.total,
            saveSucceeded: saveResult.success,
            modifiersApplied: saveResult.modifiersApplied,
            saveOutcomeOverride: outcomeOverride
          }
        }
      ]
    }

    if (saveResult.success) {
      return addScryingTargetLockout(nextState, this.spell, target)
    }

    const resolvedState = createScryingSensorState(nextState, this.spell, this.effect, caster, this.context, selection, target)
    return this.spell.duration.concentration
      ? new StartConcentrationCommand(this.spell, this.context).execute(resolvedState)
      : resolvedState
  }
}

export function buildScryingCommands(input: SpellBridgeContext): SpellCommand[] | undefined {
  const { spell, caster, context, activeEffects } = input


    // Scrying owns both creature-save and location-sensor resolution; keep it
    // ahead of generic utility narration so the active sensor state survives.
    if (spell.id === 'scrying') {
      const scryingEffect = activeEffects.find(isUtilityEffect)
      if (scryingEffect) {
        const commands: SpellCommand[] = []
        if (spell.duration.concentration && caster.concentratingOn) {
          commands.push(new BreakConcentrationCommand(context))
        }
        commands.push(new ScryingBridgeCommand(spell, scryingEffect, caster, context))
        return commands
      }
    }

  return undefined
}
