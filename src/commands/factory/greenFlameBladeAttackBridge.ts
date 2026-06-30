// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/06/2026, 13:45:05
 * Dependents: commands/factory/AbilityCommandFactory.ts, commands/factory/SpellCommandFactory.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns Green-Flame Blade into a real melee weapon attack with a
 * hit-gated fire leap.
 *
 * The spell already carries the exact secondary-target metadata in its live
 * JSON. This bridge keeps the cast scoped to a weapon attack while resolving
 * the secondary target and tiered fire damage in one narrow place.
 */

import { Ability, CombatCharacter, SelectedSpellTarget } from '@/types/combat'
import { Item } from '@/types/items'
import { DamageEffect, isDamageEffect, Spell, SpellEffect } from '@/types/spells'
import { calculateProficiencyBonus } from '@/utils/character/savingThrowUtils'
import { getAbilityModifierValue } from '@/utils/character/statUtils'
import { getDistance } from '@/utils/combatUtils'
import { isWeaponProficient } from '@/utils/character/weaponUtils'

type EquippedItemSnapshot = Partial<Record<'MainHand' | 'OffHand', Item>>

export interface GreenFlameBladeAttackBuildResult {
  attackAbility: GreenFlameBladeRuntimeAbility
  attackTarget: CombatCharacter
  weaponSnapshot: Item
}

export interface GreenFlameBladeWeaponValidation {
  valid: boolean
  reason?: string
}

export interface GreenFlameBladeRuntimeAbility extends Ability {
  greenFlameBladeSecondaryTargetId?: string
  greenFlameBladeSecondaryEffect?: SpellEffect
}

// Keep the bridge narrow so only Green-Flame Blade gets the weapon-attack
// treatment and the older blade cantrip bridges stay intact.
export const hasGreenFlameBladeWeaponAttackBridge = (spell: Spell): boolean =>
  spell.id === 'green-flame-blade' &&
  spell.effects.some(effect => isDamageEffect(effect))

export const resolveGreenFlameBladeWeaponSnapshot = (caster: CombatCharacter): Item | undefined => {
  const equippedItems = (caster as CombatCharacter & { equippedItems?: EquippedItemSnapshot }).equippedItems
  return equippedItems?.MainHand
}

export const resolveGreenFlameBladeAttackTarget = (
  selectedSpellTargets: SelectedSpellTarget[] | undefined,
  targets: CombatCharacter[],
  casterId: string
): CombatCharacter | undefined => {
  const selectedCreatureId = selectedSpellTargets
    ?.find((target): target is Extract<SelectedSpellTarget, { kind: 'creature' }> =>
      target.kind === 'creature' && target.id !== casterId
    )
    ?.id

  if (selectedCreatureId) {
    return targets.find(target => target.id === selectedCreatureId)
  }

  return targets.find(target => target.id !== casterId)
}

export const resolveGreenFlameBladeSecondaryTarget = (
  selectedSpellTargets: SelectedSpellTarget[] | undefined,
  targets: CombatCharacter[],
  primaryTargetId: string,
  casterId: string,
  primaryTarget: CombatCharacter
): CombatCharacter | undefined => {
  const selectedCreatureIds = selectedSpellTargets
    ?.filter((target): target is Extract<SelectedSpellTarget, { kind: 'creature' }> =>
      target.kind === 'creature' && target.id !== casterId && target.id !== primaryTargetId
    )
    .map(target => target.id) ?? []

  for (const candidateId of selectedCreatureIds) {
    const candidate = targets.find(target => target.id === candidateId)
    if (!candidate) {
      continue
    }

    // Green-Flame Blade measures its leap from the hit target, not the caster.
    // The live grid uses one tile per 5 feet, so the spell's 5-foot limit is a
    // one-tile adjacency check in this combat layer.
    if (getDistance(primaryTarget.position, candidate.position) <= 1) {
      return candidate
    }
  }

  return undefined
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

const isRangedWeapon = (weapon: Item): boolean =>
  Boolean(
    weapon.category?.toLowerCase().includes('ranged') ||
    weapon.properties?.some(property => property.toLowerCase() === 'ranged')
  )

export const validateGreenFlameBladeWeaponSnapshot = (
  caster: CombatCharacter,
  weaponSnapshot: Item | undefined
): GreenFlameBladeWeaponValidation => {
  if (!weaponSnapshot) {
    return {
      valid: false,
      reason: 'Green-Flame Blade needs a melee weapon snapshot from the caster\'s main hand.'
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

const resolveSpellcastingAbilityModifier = (caster: CombatCharacter): number => {
  const abilityName = caster.spellcastingAbility
    ? (caster.spellcastingAbility.charAt(0).toUpperCase() + caster.spellcastingAbility.slice(1))
    : (caster.class?.spellcasting?.ability || 'Intelligence')

  const abilityScore = caster.stats[abilityName.toLowerCase() as keyof CombatCharacter['stats']] ?? 10
  return getAbilityModifierValue(Number(abilityScore))
}

const resolveCustomFormulaDice = (effect: DamageEffect, casterLevel: number): string | undefined => {
  const customFormula = effect.scaling?.customFormula
  if (typeof customFormula !== 'string' || customFormula.trim() === '') {
    return undefined
  }

  const tierDice = [...customFormula.matchAll(/(\d+)d(\d+)/g)]
    .map(match => `${match[1]}d${match[2]}`)

  if (tierDice.length === 0) {
    return undefined
  }

  if (casterLevel >= 17) {
    return tierDice[2] ?? tierDice[tierDice.length - 1]
  }

  if (casterLevel >= 11) {
    return tierDice[1] ?? tierDice[tierDice.length - 1]
  }

  if (casterLevel >= 5) {
    return tierDice[0] ?? tierDice[tierDice.length - 1]
  }

  return undefined
}

const appendFlatModifierToDice = (dice: string, modifier: number): string => {
  if (modifier === 0) {
    return dice
  }

  const sign = modifier > 0 ? '+' : ''
  return `${dice}${sign}${modifier}`
}

const resolvePrimaryDamageEffect = (spell: Spell, casterLevel: number): DamageEffect | undefined => {
  const primaryEffect = spell.effects.find((effect): effect is DamageEffect =>
    isDamageEffect(effect) && !effect.secondaryTargeting
  )

  if (!primaryEffect) {
    return undefined
  }

  const scaledDice = resolveCustomFormulaDice(primaryEffect, casterLevel)
  if (!scaledDice || scaledDice === '0') {
    return primaryEffect
  }

  return {
    ...primaryEffect,
    damage: {
      ...primaryEffect.damage,
      dice: scaledDice
    }
  }
}

const resolveSecondaryDamageEffect = (
  spell: Spell,
  caster: CombatCharacter,
  casterLevel: number
): DamageEffect | undefined => {
  const secondaryEffect = spell.effects.find((effect): effect is DamageEffect =>
    isDamageEffect(effect) && Boolean(effect.secondaryTargeting)
  )

  if (!secondaryEffect) {
    return undefined
  }

  const spellcastingModifier = resolveSpellcastingAbilityModifier(caster)
  const scaledDice = resolveCustomFormulaDice(secondaryEffect, casterLevel)

  if (!scaledDice) {
    return {
      ...secondaryEffect,
      damage: {
        ...secondaryEffect.damage,
        dice: String(spellcastingModifier)
      }
    }
  }

  return {
    ...secondaryEffect,
    damage: {
      ...secondaryEffect.damage,
      dice: appendFlatModifierToDice(scaledDice, spellcastingModifier)
    }
  }
}

// Keep the attack synthesis narrow: weapon damage stays on the primary hit,
// while the leap damage is stored separately for the hit-only spend path.
export const buildGreenFlameBladeAttack = (
  spell: Spell,
  caster: CombatCharacter,
  weaponSnapshot: Item,
  attackTarget: CombatCharacter,
  selectedSpellTargets: SelectedSpellTarget[] | undefined,
  targets: CombatCharacter[]
): GreenFlameBladeAttackBuildResult => {
  const strengthModifier = getAbilityModifierValue(caster.stats.strength || 10)
  const attackBonus = strengthModifier + calculateProficiencyBonus(caster.level || 1)
  const primaryDamageEffect = resolvePrimaryDamageEffect(spell, caster.level || 1)
  const secondaryDamageEffect = resolveSecondaryDamageEffect(spell, caster, caster.level || 1)
  const secondaryTarget = secondaryDamageEffect
    ? resolveGreenFlameBladeSecondaryTarget(selectedSpellTargets, targets, attackTarget.id, caster.id, attackTarget)
    : undefined

  const attackAbility: GreenFlameBladeRuntimeAbility = {
    id: `${spell.id}-attack`,
    name: spell.name,
    description: spell.description,
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_any',
    range: 5,
    effects: [
      {
        type: 'damage',
        value: 0,
        dice: weaponSnapshot.damageDice ? appendFlatModifierToDice(weaponSnapshot.damageDice, strengthModifier) : String(strengthModifier),
        damageType: weaponSnapshot.damageType || 'slashing'
      },
      ...(primaryDamageEffect
        ? [{
            type: 'damage' as const,
            value: 0,
            dice: primaryDamageEffect.damage.dice,
            damageType: primaryDamageEffect.damage.type
          }]
        : [])
    ],
    weapon: weaponSnapshot,
    isProficient: true,
    attackBonus,
    isMagical: true,
    sourceSpellId: spell.id,
    spell,
    greenFlameBladeSecondaryTargetId: secondaryTarget?.id,
    greenFlameBladeSecondaryEffect: secondaryTarget ? secondaryDamageEffect : undefined
  }

  return {
    attackAbility,
    attackTarget,
    weaponSnapshot
  }
}

export const isGreenFlameBladeRuntimeAbility = (ability: Ability): ability is GreenFlameBladeRuntimeAbility =>
  ability.sourceSpellId === 'green-flame-blade' &&
  Array.isArray((ability as GreenFlameBladeRuntimeAbility).effects)
