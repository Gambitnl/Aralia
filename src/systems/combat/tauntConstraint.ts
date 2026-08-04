// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 04/08/2026, 01:59:29
 * Dependents: commands/effects/DamageCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useTurnManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file enforces structured taunt rules such as Compelled Duel.
 *
 * A taunt lives on the compelled target's status effect. These helpers keep
 * attack rolls, willing movement and early-end events on that same contract,
 * without restricting forced movement or teaching combat AI new strategy.
 */
import type { CombatCharacter, Position, StatusEffect } from '@/types/combat'
import type { TauntBreakEvent } from '@/types/spells'
import { getDistance } from '@/utils/combat'

export interface TauntBreakRecord {
  casterId: string
  targetId: string
  spellId?: string
  spellName: string
  event: TauntBreakEvent
}

export interface TauntBreakResult {
  characters: CombatCharacter[]
  breaks: TauntBreakRecord[]
}

type TauntEventContext =
  | { event: 'caster_attacks_other'; casterId: string; targetIds: string[] }
  | { event: 'caster_casts_spell_on_other_enemy'; casterId: string; targetIds: string[] }
  | { event: 'caster_ally_damages_target'; casterId: string; targetId: string }
  | { event: 'caster_ends_turn_outside_leash'; casterId: string }

const activeTaunts = (character: CombatCharacter): StatusEffect[] =>
  (character.statusEffects || []).filter(status => status.taunt && status.sourceCasterId)

/** Returns true when the compelled creature attacks anyone except its caster. */
export const hasTauntAttackDisadvantage = (
  attacker: CombatCharacter,
  targetId: string
): boolean => activeTaunts(attacker).some(status =>
  status.taunt?.disadvantageAgainstOthers === true &&
  status.sourceCasterId !== targetId
)

/**
 * Checks only voluntary move actions. Forced-movement commands do not call
 * this helper, so pushes and pulls remain allowed by design.
 */
export const validateTauntWillingMove = (
  character: CombatCharacter,
  destination: Position,
  characters: CombatCharacter[]
): { allowed: boolean; status?: StatusEffect; caster?: CombatCharacter } => {
  for (const status of activeTaunts(character)) {
    const leashRangeFeet = status.taunt?.leashRangeFeet
    const caster = characters.find(candidate => candidate.id === status.sourceCasterId)
    if (!caster || !leashRangeFeet || leashRangeFeet <= 0) {
      continue
    }

    if (getDistance(destination, caster.position) * 5 > leashRangeFeet) {
      return { allowed: false, status, caster }
    }
  }

  return { allowed: true }
}

const eventBreaksStatus = (
  status: StatusEffect,
  compelledTarget: CombatCharacter,
  characters: CombatCharacter[],
  context: TauntEventContext
): boolean => {
  if (!status.taunt?.breakEvents?.includes(context.event)) {
    return false
  }

  // Ally damage identifies the damaging ally in casterId; every other event
  // identifies the spell's caster directly.
  if (context.event !== 'caster_ally_damages_target' && status.sourceCasterId !== context.casterId) {
    return false
  }

  if (context.event === 'caster_attacks_other') {
    return context.targetIds.some(targetId => targetId !== compelledTarget.id)
  }

  if (context.event === 'caster_casts_spell_on_other_enemy') {
    const caster = characters.find(character => character.id === context.casterId)
    return context.targetIds.some(targetId => {
      const target = characters.find(character => character.id === targetId)
      return targetId !== compelledTarget.id && Boolean(caster && target && caster.team !== target.team)
    })
  }

  if (context.event === 'caster_ally_damages_target') {
    const caster = characters.find(character => character.id === status.sourceCasterId)
    const damager = characters.find(character => character.id === context.casterId)
    return context.targetId === compelledTarget.id &&
      Boolean(caster && damager && damager.id !== caster.id && damager.team === caster.team)
  }

  const caster = characters.find(character => character.id === status.sourceCasterId)
  const leashRangeFeet = status.taunt.leashRangeFeet
  return Boolean(caster && leashRangeFeet && getDistance(caster.position, compelledTarget.position) * 5 > leashRangeFeet)
}

/**
 * Ends matching taunts and their concentration owner in one immutable update.
 * All status IDs owned by that concentration record are removed, preserving
 * the existing concentration contract rather than creating a second ledger.
 */
export const breakTauntsForEvent = (
  characters: CombatCharacter[],
  context: TauntEventContext
): TauntBreakResult => {
  const matches = characters.flatMap(compelledTarget =>
    activeTaunts(compelledTarget)
      .filter(status => eventBreaksStatus(status, compelledTarget, characters, context))
      .map(status => ({ compelledTarget, status }))
  )

  if (matches.length === 0) {
    return { characters, breaks: [] }
  }

  const effectIdsToRemove = new Set(matches.flatMap(({ status }) => {
    const caster = characters.find(character => character.id === status.sourceCasterId)
    return caster?.concentratingOn?.spellId === status.sourceSpellId
      ? ((caster as any)?.concentratingOn?.effectIds ?? [status.id])
      : [status.id]
  }))
  const casterSpellKeys = new Set(matches.map(({ status }) => `${status.sourceCasterId}:${status.sourceSpellId ?? ''}`))

  const nextCharacters = characters.map(character => {
    const concentrationKey = `${character.id}:${character.concentratingOn?.spellId ?? ''}`
    return {
      ...character,
      statusEffects: (character.statusEffects || []).filter(status => !effectIdsToRemove.has(status.id)),
      concentratingOn: casterSpellKeys.has(concentrationKey) ? undefined : character.concentratingOn
    }
  })

  return {
    characters: nextCharacters,
    breaks: matches.map(({ compelledTarget, status }) => ({
      casterId: status.sourceCasterId as string,
      targetId: compelledTarget.id,
      spellId: status.sourceSpellId,
      spellName: status.source || 'Taunt',
      event: context.event
    }))
  }
}
