// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 13:19:32
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns Booming Blade's spell data into a real melee weapon attack.
 *
 * Booming Blade has two linked parts: a weapon hit during the cast, then a
 * target-side thunder rider if the hit creature willingly moves before the next
 * turn. Keeping that bridge here lets the spell command factory reuse the
 * ordinary weapon attack command while still preserving the delayed movement
 * payload from the live spell JSON.
 *
 * Called by: SpellCommandFactory and WeaponAttackCommand.
 * Depends on: combat/item/spell types and character proficiency/stat helpers.
 */

import { Ability, CombatCharacter, SelectedSpellTarget, type AbilityEffect } from '@/types/combat'
import { Item } from '@/types/items'
import { DamageEffect, isDamageEffect, Spell, SpellEffect } from '@/types/spells'
import { calculateProficiencyBonus } from '@/utils/character/savingThrowUtils'
import { isWeaponProficient } from '@/utils/character/weaponUtils'

type EquippedItemSnapshot = Partial<Record<'MainHand' | 'OffHand', Item>>

export interface BoomingBladeAttackBuildResult {
  attackAbility: Ability
  attackTarget: CombatCharacter
  weaponSnapshot: Item
  movementEffects: SpellEffect[]
}

export interface BoomingBladeWeaponValidation {
  valid: boolean
  reason?: string
}

export interface BoomingBladeRuntimeAbility extends Ability {
  boomingBladeMovementEffects?: SpellEffect[]
  boomingBladeDurationRounds?: number
}

// ============================================================================
// Booming Blade Recognition and Validation
// ============================================================================
// These helpers keep the bridge strictly scoped to Booming Blade and reject bad
// cast material before the spell spends an action on a fake weapon attack.
// ============================================================================

export const hasBoomingBladeWeaponAttackBridge = (spell: Spell): boolean =>
  spell.id === 'booming-blade' &&
  spell.effects.some(effect => isDamageEffect(effect) && effect.trigger?.type === 'on_target_move')

export const resolveBoomingBladeWeaponSnapshot = (caster: CombatCharacter): Item | undefined => {
  const equippedItems = (caster as CombatCharacter & { equippedItems?: EquippedItemSnapshot }).equippedItems
  return equippedItems?.MainHand
}

export const resolveBoomingBladeAttackTarget = (
  selectedSpellTargets: SelectedSpellTarget[] | undefined,
  targets: CombatCharacter[],
  casterId: string
): CombatCharacter | undefined => {
  const selectedCreatureId = selectedSpellTargets
    ?.find((target): target is Extract<SelectedSpellTarget, { kind: 'creature' }> => target.kind === 'creature' && target.id !== casterId)
    ?.id

  if (selectedCreatureId) {
    return targets.find(target => target.id === selectedCreatureId)
  }

  return targets.find(target => target.id !== casterId)
}

export const validateBoomingBladeWeaponSnapshot = (
  caster: CombatCharacter,
  weaponSnapshot: Item | undefined
): BoomingBladeWeaponValidation => {
  if (!weaponSnapshot) {
    return {
      valid: false,
      reason: 'Booming Blade needs a melee weapon snapshot from the caster\'s main hand.'
    }
  }

  if (weaponSnapshot.type !== 'weapon') {
    return {
      valid: false,
      reason: `${weaponSnapshot.name} is not a weapon.`
    }
  }

  if (isRangedWeapon(weaponSnapshot)) {
    return {
      valid: false,
      reason: `${weaponSnapshot.name} is not a melee weapon.`
    }
  }

  const weaponValueCp = resolveWeaponValueCp(weaponSnapshot)
  if (typeof weaponValueCp !== 'number' || weaponValueCp < 10) {
    return {
      valid: false,
      reason: `${weaponSnapshot.name} must be worth at least 10 CP.`
    }
  }

  const proficient = isWeaponProficient(caster as unknown as Parameters<typeof isWeaponProficient>[0], weaponSnapshot)
  if (!proficient) {
    return {
      valid: false,
      reason: `${caster.name} is not proficient with ${weaponSnapshot.name}.`
    }
  }

  return { valid: true }
}

// ============================================================================
// Booming Blade Attack Synthesis
// ============================================================================
// This section translates the live spell rows into the attack button shape that
// WeaponAttackCommand already knows how to roll, hit, miss, damage, and log.
// ============================================================================

export const buildBoomingBladeAttack = (
  spell: Spell,
  caster: CombatCharacter,
  weaponSnapshot: Item,
  attackTarget: CombatCharacter
): BoomingBladeAttackBuildResult => {
  const strengthModifier = getAbilityModifier(caster.stats.strength)
  const attackBonus = strengthModifier + calculateProficiencyBonus(caster.level || 1)
  const immediateThunderEffect = resolveImmediateThunderEffect(spell, caster.level || 1)
  const movementEffects = resolveMovementEffects(spell, caster.level || 1)
  const weaponDamageDice = appendFlatModifierToDice(weaponSnapshot.damageDice || '1d4', strengthModifier)

  const effects = [
    {
      type: 'damage' as const,
      value: 0,
      dice: weaponDamageDice,
      damageType: (weaponSnapshot.damageType || 'slashing') as AbilityEffect['damageType']
    },
    ...(immediateThunderEffect
      ? [{
          type: 'damage' as const,
          value: 0,
          dice: immediateThunderEffect.damage.dice,
          damageType: immediateThunderEffect.damage.type as AbilityEffect['damageType']
        }]
      : [])
  ] satisfies Ability['effects']

  const attackAbility: BoomingBladeRuntimeAbility = {
    id: `${spell.id}-attack`,
    name: spell.name,
    description: spell.description,
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_any',
    range: resolveMeleeWeaponReach(weaponSnapshot),
    effects,
    weapon: weaponSnapshot,
    isProficient: true,
    attackBonus,
    isMagical: true,
    sourceSpellId: spell.id,
    spell,
    boomingBladeMovementEffects: movementEffects,
    boomingBladeDurationRounds: 1
  }

  return {
    attackAbility,
    attackTarget,
    weaponSnapshot,
    movementEffects
  }
}

export const isBoomingBladeRuntimeAbility = (ability: Ability): ability is BoomingBladeRuntimeAbility =>
  ability.sourceSpellId === 'booming-blade' &&
  Array.isArray((ability as BoomingBladeRuntimeAbility).boomingBladeMovementEffects)

const resolveImmediateThunderEffect = (spell: Spell, casterLevel: number): DamageEffect | undefined => {
  const immediateEffect = spell.effects.find((effect): effect is DamageEffect =>
    isDamageEffect(effect) &&
    effect.trigger?.type === 'immediate' &&
    effect.damage.type === 'Thunder'
  )

  if (!immediateEffect) {
    return undefined
  }

  const scaledDice = resolveCustomFormulaDice(immediateEffect, casterLevel)
  if (!scaledDice || scaledDice === '0') {
    return undefined
  }

  return {
    ...immediateEffect,
    damage: {
      ...immediateEffect.damage,
      dice: scaledDice
    }
  }
}

const resolveMovementEffects = (spell: Spell, casterLevel: number): SpellEffect[] =>
  spell.effects
    .filter((effect): effect is DamageEffect => isDamageEffect(effect) && effect.trigger?.type === 'on_target_move')
    .map(effect => {
      const movementEffect: DamageEffect = {
        ...effect,
        damage: {
          ...effect.damage,
          dice: resolveCustomFormulaDice(effect, casterLevel) ?? effect.damage.dice
        }
      }

      return movementEffect
    })

const resolveCustomFormulaDice = (effect: DamageEffect, casterLevel: number): string | undefined => {
  const customFormula = (effect.scaling as { customFormula?: string } | undefined)?.customFormula
  if (typeof customFormula !== 'string' || customFormula.trim() === '') {
    return effect.damage.dice
  }

  const tiers = JSON.parse(customFormula) as Record<string, string>
  const matchingTier = [17, 11, 5]
    .find(level => casterLevel >= level && typeof tiers[String(level)] === 'string')

  return matchingTier ? tiers[String(matchingTier)] : effect.damage.dice
}

const resolveMeleeWeaponReach = (weaponSnapshot: Item): number =>
  weaponSnapshot.properties?.some(property => property.toLowerCase() === 'reach') ? 2 : 1

const isRangedWeapon = (weaponSnapshot: Item): boolean =>
  weaponSnapshot.properties?.some(property => property.toLowerCase() === 'range' || property.toLowerCase().startsWith('range:')) === true ||
  weaponSnapshot.category?.toLowerCase().includes('ranged') === true

const getAbilityModifier = (score: number): number =>
  Math.floor((score - 10) / 2)

const appendFlatModifierToDice = (dice: string, modifier: number): string => {
  if (modifier === 0) {
    return dice
  }

  const sign = modifier > 0 ? '+' : ''
  return `${dice}${sign}${modifier}`
}

const resolveWeaponValueCp = (weapon: Item): number | undefined => {
  if (typeof weapon.costInGp === 'number' && Number.isFinite(weapon.costInGp)) {
    return Math.max(0, Math.round(weapon.costInGp * 100))
  }

  if (typeof weapon.value === 'number' && Number.isFinite(weapon.value)) {
    return Math.max(0, weapon.value)
  }

  if (typeof weapon.cost === 'string') {
    const match = weapon.cost.trim().match(/^(\d+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)$/i)
    if (!match) {
      return undefined
    }

    const amount = Number(match[1])
    const unit = match[2].toLowerCase()
    const multiplier = unit === 'cp'
      ? 1
      : unit === 'sp'
        ? 10
        : unit === 'ep'
          ? 50
          : unit === 'gp'
            ? 100
            : 1000

    return Math.round(amount * multiplier)
  }

  return undefined
}
