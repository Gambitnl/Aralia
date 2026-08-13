// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 12/08/2026, 06:33:24
 * Dependents: commands/effects/DamageCommand.ts, commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts, components/DesignPreview/steps/PreviewCombatScenarios.tsx, components/DesignPreview/steps/scenarioControls/tauntForcedTargetingScenarioControls.ts, hooks/combat/useActionExecutor.ts, hooks/combat/useTurnManager.ts
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
 * attack rolls, willing movement, source viability, expiry, and early-end
 * events on that same contract, without restricting forced movement or
 * teaching combat AI new strategy.
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

export type TauntCleanupReason =
  | 'expired'
  | 'source_missing'
  | 'source_downed'
  | 'source_incapacitated'

export interface TauntCleanupRecord {
  casterId: string
  targetId: string
  spellId?: string
  spellName: string
  reason: TauntCleanupReason
}

export interface TauntCleanupResult {
  characters: CombatCharacter[]
  cleanups: TauntCleanupRecord[]
}

type TauntEventContext =
  | { event: 'caster_attacks_other'; casterId: string; targetIds: string[] }
  | { event: 'caster_casts_spell_on_other_enemy'; casterId: string; targetIds: string[] }
  | { event: 'caster_ally_damages_target'; casterId: string; targetId: string }
  | { event: 'caster_ends_turn_outside_leash'; casterId: string }

// A zero-round marker is already expired even if a caller has not yet run the
// turn-boundary cleanup pass. Excluding it here prevents one stale attack or
// movement penalty between duration expiry and state reconciliation.
const activeTaunts = (character: CombatCharacter): StatusEffect[] =>
  (character.statusEffects || []).filter(status => (
    status.taunt &&
    status.sourceCasterId &&
    status.duration > 0
  ))

// Incapacitation ends concentration, so a downed, Unconscious, or otherwise
// Incapacitated source cannot keep a source-bound taunt active. This helper is
// shared by attack, movement, and explicit cleanup to prevent rule drift.
const sourceCanMaintainTaunt = (source: CombatCharacter | undefined): boolean => (
  Boolean(source) &&
  (source?.currentHP ?? 1) > 0 &&
  !(source?.conditions ?? []).some(condition => (
    condition.name === 'Incapacitated' || condition.name === 'Unconscious'
  )) &&
  !(source?.statusEffects ?? []).some(status => (
    status.name === 'Incapacitated' || status.name === 'Unconscious'
  ))
)

/** Returns true when the compelled creature attacks anyone except its caster. */
export const hasTauntAttackDisadvantage = (
  attacker: CombatCharacter,
  targetId: string,
  characters?: CombatCharacter[]
): boolean => activeTaunts(attacker).some(status =>
  (!characters || sourceCanMaintainTaunt(
    characters.find(character => character.id === status.sourceCasterId)
  )) &&
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
    if (!caster || !sourceCanMaintainTaunt(caster) || !leashRangeFeet || leashRangeFeet <= 0) {
      continue
    }

    if (getDistance(destination, caster.position) * 5 > leashRangeFeet) {
      return { allowed: false, status, caster }
    }
  }

  return { allowed: true }
}

// ============================================================================
// Source And Duration Cleanup
// ============================================================================
// Normal turn processing may remove an expired status before this helper runs.
// When the marker is still present, this pass removes only invalid taunts and
// their matching concentration owner; unrelated statuses and spells survive.
// ============================================================================

const getTauntCleanupReason = (
  status: StatusEffect,
  characters: CombatCharacter[]
): TauntCleanupReason | null => {
  if (status.duration <= 0) {
    return 'expired'
  }

  const source = characters.find(character => character.id === status.sourceCasterId)
  if (!source) {
    return 'source_missing'
  }
  if ((source.currentHP ?? 1) <= 0) {
    return 'source_downed'
  }
  if (!sourceCanMaintainTaunt(source)) {
    return 'source_incapacitated'
  }

  return null
}

/**
 * Removes taunts whose duration or living source can no longer sustain them.
 * A caller can run this after HP, condition, removal, or turn-duration changes;
 * the result is unchanged when every current taunt is still valid.
 */
export const clearInvalidTaunts = (
  characters: CombatCharacter[]
): TauntCleanupResult => {
  const cleanups = characters.flatMap(target => (
    (target.statusEffects ?? [])
      .filter(status => status.taunt && status.sourceCasterId)
      .map(status => ({
        target,
        status,
        reason: getTauntCleanupReason(status, characters)
      }))
      .filter((entry): entry is typeof entry & { reason: TauntCleanupReason } => (
        entry.reason !== null
      ))
  ))

  if (cleanups.length === 0) {
    return { characters, cleanups: [] }
  }

  const statusIdsToRemove = new Set(cleanups.map(({ status }) => status.id))
  const casterSpellKeys = new Set(cleanups.map(({ status }) => (
    `${status.sourceCasterId}:${status.sourceSpellId ?? ''}`
  )))

  const nextCharacters = characters.map(character => {
    const concentrationKey = `${character.id}:${character.concentratingOn?.spellId ?? ''}`
    return {
      ...character,
      statusEffects: (character.statusEffects ?? []).filter(status => (
        !statusIdsToRemove.has(status.id)
      )),
      concentratingOn: casterSpellKeys.has(concentrationKey)
        ? undefined
        : character.concentratingOn
    }
  })

  return {
    characters: nextCharacters,
    cleanups: cleanups.map(({ target, status, reason }) => ({
      casterId: status.sourceCasterId as string,
      targetId: target.id,
      spellId: status.sourceSpellId,
      spellName: status.source || 'Taunt',
      reason
    }))
  }
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
