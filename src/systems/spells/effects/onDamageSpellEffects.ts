// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/08/2026, 14:02:18
 * Dependents: commands/effects/DamageCommand.ts, hooks/combat/engine/useCombatEngine.ts, utils/combat/resistanceUtils.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file resolves spell effects that fire when an affected creature takes damage.
 *
 * Elemental Bane is the first live spell using this owner. Cast commands store a
 * structured status on the target, then both command-driven and combat-engine
 * damage paths call this file before applying the final damage. Keeping the event
 * decision here prevents those two damage paths from drifting apart.
 *
 * Called by: DamageCommand and useCombatEngine.
 * Depends on: combat status records for durable per-turn usage state.
 */

import type { CombatCharacter, StatusEffect } from '@/types/combat'
import type { DamageType } from '@/types/spells'

// ============================================================================
// Damage Type Matching
// ============================================================================
// Spell data uses title-case damage names while combat events may use lower-case
// names. Compare normalized text without changing the canonical spell payload.
// ============================================================================

const normalizeDamageType = (damageType: string): string => damageType.trim().toLowerCase()

export const suppressesResistanceToDamageType = (
  character: CombatCharacter,
  damageType: string
): boolean => {
  const normalizedDamageType = normalizeDamageType(damageType)

  return character.statusEffects?.some(status =>
    status.resistanceSuppression?.damageTypes.some(
      suppressedType => normalizeDamageType(suppressedType) === normalizedDamageType
    )
  ) === true
}

// ============================================================================
// On-Damage Rider Resolution
// ============================================================================
// A qualifying status returns its extra dice and is marked with the current
// combat turn. The caller still owns rolling and applying damage, so resistance,
// immunity, temporary hit points, and concentration all stay in their normal path.
// ============================================================================

export interface OnDamageSpellEffectResolution {
  character: CombatCharacter
  damageDice?: string
  damageType?: DamageType
  sourceSpellId?: string
  sourceName?: string
}

export const resolveOnDamageSpellEffect = (
  character: CombatCharacter,
  triggeringDamageType: string | undefined,
  currentTurn: number,
  triggeringDamageDealt: number
): OnDamageSpellEffectResolution => {
  // A creature must actually take typed damage before a source rule such as
  // Elemental Bane can wake. Immunity and zero-damage outcomes do not consume it.
  if (!triggeringDamageType || triggeringDamageDealt <= 0) {
    return { character }
  }

  const normalizedDamageType = normalizeDamageType(triggeringDamageType)
  const matchingStatus = character.statusEffects?.find(status => {
    const rider = status.onDamageSpellEffect
    if (!rider) return false

    const riderDamageType = rider.damageType === 'triggering_damage_type'
      ? normalizedDamageType
      : normalizeDamageType(rider.damageType)
    const chosenDamageTypes = status.resistanceSuppression?.damageTypes
    const matchesChosenDamageType = !chosenDamageTypes?.length || chosenDamageTypes.some(
      damageType => normalizeDamageType(damageType) === normalizedDamageType
    )
    const hasAlreadyTriggered = rider.frequency === 'first_per_turn' && rider.lastTriggeredTurn === currentTurn

    return matchesChosenDamageType && riderDamageType === normalizedDamageType && !hasAlreadyTriggered
  })

  if (!matchingStatus?.onDamageSpellEffect) {
    return { character }
  }

  const nextStatuses = character.statusEffects.map(status =>
    status.id === matchingStatus.id
      ? markOnDamageStatusTriggered(status, currentTurn)
      : status
  )

  return {
    character: {
      ...character,
      statusEffects: nextStatuses
    },
    damageDice: matchingStatus.onDamageSpellEffect.damageDice,
    damageType: triggeringDamageType as DamageType,
    sourceSpellId: matchingStatus.sourceSpellId,
    sourceName: matchingStatus.source
  }
}

const markOnDamageStatusTriggered = (status: StatusEffect, currentTurn: number): StatusEffect => ({
  ...status,
  onDamageSpellEffect: status.onDamageSpellEffect
    ? {
        ...status.onDamageSpellEffect,
        lastTriggeredTurn: currentTurn
      }
    : undefined
})
