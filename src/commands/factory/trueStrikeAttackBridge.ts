/**
 * This file turns True Strike's structured attack augment into a real weapon attack.
 *
 * The spell data already describes the weapon requirement, the cast-time attack,
 * the spellcasting-ability substitution, and the Radiant-vs-normal choice. This
 * helper keeps that logic in one small place so the spell command factory and the
 * self-target selection flow can share the same validation and synthesis rules.
 *
 * Called by: SpellCommandFactory and useAbilitySystem.
 * Depends on: shared spell, combat, item, and weapon-proficiency types/utilities.
 */

// ============================================================================
// True Strike Bridge Helpers
// ============================================================================
// This section contains the tiny amount of shared logic needed to keep the
// True Strike cast atomic: find the cast weapon, find the attack target, check
// that the caster is allowed to use the weapon, and synthesize an attack
// ability the existing weapon attack command can execute.
// ============================================================================

import { Ability, CombatCharacter, SelectedSpellTarget } from '@/types/combat'
import { Item } from '@/types/items'
import { Spell, UtilityEffect } from '@/types/spells'
import { calculateProficiencyBonus } from '@/utils/character/savingThrowUtils'
import { getAbilityModifierValue } from '@/utils/character/statUtils'
import { isWeaponProficient } from '@/utils/character/weaponUtils'

type EquippedItemSnapshot = Partial<Record<'MainHand' | 'OffHand', Item>>

export interface TrueStrikeWeaponValidation {
  valid: boolean
  reason?: string
}

export interface TrueStrikeAttackBuildResult {
  attackAbility: Ability
  attackTarget: CombatCharacter
  weaponSnapshot: Item
  chosenDamageType: 'Radiant' | string
}

// Keep the bridge narrowly scoped to True Strike so the new runtime path does
// not silently widen to other attack augments before their command contracts are
// reviewed.
export const hasTrueStrikeImmediateAttackAugment = (spell: Spell): boolean => {
  if (spell.id !== 'true-strike') {
    return false
  }

  return spell.effects.some(effect =>
    effect.type === 'UTILITY' &&
    Array.isArray(effect.attackAugments) &&
    effect.attackAugments.some(augment =>
      augment.grantedAttack?.timing === 'during_cast' &&
      augment.grantedAttack.usesCastingWeapon === true
    )
  )
}

// Read the cast weapon from the current combatant snapshot if the live object
// already carries equipment. The combat character type does not yet expose this
// field, but the runtime character objects used by the combat hook often do.
export const resolveTrueStrikeWeaponSnapshot = (caster: CombatCharacter): Item | undefined => {
  const equippedItems = (caster as CombatCharacter & { equippedItems?: EquippedItemSnapshot }).equippedItems
  return equippedItems?.MainHand
}

// Pick the selected creature target that is not the caster. True Strike still
// self-targets as a spell, but the attack target is the creature the player just
// pointed at in the same cast flow.
export const resolveTrueStrikeAttackTarget = (
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

// The weapon requirement stays explicit so a bad weapon snapshot can reject the
// cast before the action is spent.
export const validateTrueStrikeWeaponSnapshot = (
  caster: CombatCharacter,
  weaponSnapshot: Item | undefined,
  weaponRequirement?: NonNullable<UtilityEffect['attackAugments']>[number]['weaponRequirement']
): TrueStrikeWeaponValidation => {
  if (!weaponSnapshot) {
    return {
      valid: false,
      reason: 'True Strike needs a weapon snapshot from the caster\'s main hand.'
    }
  }

  if (weaponSnapshot.type !== 'weapon') {
    return {
      valid: false,
      reason: `${weaponSnapshot.name} is not a weapon.`
    }
  }

  const minimumValueCp = weaponRequirement?.minimumValueCp ?? 1
  const weaponValueCp = resolveWeaponValueCp(weaponSnapshot)
  if (typeof weaponValueCp !== 'number' || weaponValueCp < minimumValueCp) {
    return {
      valid: false,
      reason: `${weaponSnapshot.name} must be worth at least ${minimumValueCp} CP.`
    }
  }

  // The current proficiency helper already understands the game's weapon
  // proficiency buckets, so reuse it here instead of re-building a second
  // weapon taxonomy just for this spell.
  const proficient = isWeaponProficient(caster as unknown as Parameters<typeof isWeaponProficient>[0], weaponSnapshot)
  if (!proficient && weaponRequirement?.proficiencyRequired !== false) {
    return {
      valid: false,
      reason: `${caster.name} is not proficient with ${weaponSnapshot.name}.`
    }
  }

  return { valid: true }
}

// Build the spellcasting modifier once so the attack roll and the base damage
// packet both use the same ability score the spell text calls for.
const resolveSpellcastingAbilityModifier = (caster: CombatCharacter): number => {
  const abilityName = caster.spellcastingAbility
    ? (caster.spellcastingAbility.charAt(0).toUpperCase() + caster.spellcastingAbility.slice(1))
    : (caster.class?.spellcasting?.ability || 'Intelligence')

  const abilityScore = caster.stats[abilityName.toLowerCase() as keyof CombatCharacter['stats']] ?? 10
  return getAbilityModifierValue(Number(abilityScore))
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

const appendFlatModifierToDice = (dice: string, modifier: number): string => {
  if (modifier === 0) {
    return dice
  }

  const sign = modifier > 0 ? '+' : ''
  return `${dice}${sign}${modifier}`
}

const resolveTrueStrikeCantripScalingDice = (casterLevel: number): string | undefined => {
  if (casterLevel >= 17) return '3d6'
  if (casterLevel >= 11) return '2d6'
  if (casterLevel >= 5) return '1d6'
  return undefined
}

const resolveTrueStrikeDamageType = (
  weaponSnapshot: Item,
  chosenDamageType: 'Radiant' | string
): string => {
  if (chosenDamageType === 'Radiant') {
    return 'Radiant'
  }

  return weaponSnapshot.damageType || 'physical'
}

export const buildTrueStrikeAttack = (
  spell: Spell,
  caster: CombatCharacter,
  weaponSnapshot: Item,
  attackTarget: CombatCharacter,
  playerInput?: string
): TrueStrikeAttackBuildResult => {
  const spellcastingModifier = resolveSpellcastingAbilityModifier(caster)
  const proficiencyBonus = calculateProficiencyBonus(caster.level || 1)
  const attackBonus = spellcastingModifier + proficiencyBonus
  const chosenDamageType = resolveTrueStrikeDamageChoice(spell, playerInput)
  const baseDamageDice = appendFlatModifierToDice(weaponSnapshot.damageDice || '1d4', spellcastingModifier)
  const baseDamageType = resolveTrueStrikeDamageType(weaponSnapshot, chosenDamageType)
  const scalingDice = resolveTrueStrikeCantripScalingDice(caster.level)

  const attackAbility: Ability = {
    id: `${spell.id}-attack`,
    name: spell.name,
    description: spell.description,
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: resolveTrueStrikeAttackRange(weaponSnapshot),
    effects: [
      {
        type: 'damage',
        value: 0,
        dice: baseDamageDice,
        damageType: baseDamageType
      },
      ...(scalingDice
        ? [{
            type: 'damage' as const,
            value: 0,
            dice: scalingDice,
            damageType: 'Radiant'
          }]
        : [])
    ],
    weapon: weaponSnapshot,
    isProficient: true,
    attackBonus,
    isMagical: true
  }

  return {
    attackAbility,
    attackTarget,
    weaponSnapshot,
    chosenDamageType
  }
}

// Damage-type selection currently defaults to Radiant when the caller does not
// supply an explicit choice. That keeps the attack executable today while still
// honoring the structured choice if a UI or test passes it through.
export const resolveTrueStrikeDamageChoice = (spell: Spell, playerInput?: string): 'Radiant' | string => {
  const choice = playerInput?.trim().toLowerCase()

  if (!choice) {
    return 'Radiant'
  }

  if (choice.includes('normal')) {
    return 'weapon_normal'
  }

  if (choice.includes('radiant')) {
    return 'Radiant'
  }

  const damageTypeChoice = spell.effects
    .filter((effect): effect is UtilityEffect => effect.type === 'UTILITY')
    .flatMap(effect => effect.attackAugments ?? [])
    .map(augment => augment.damageTypeChoice)
    .find((choiceBlock): choiceBlock is NonNullable<UtilityEffect['attackAugments']>[number]['damageTypeChoice'] => !!choiceBlock)

  const chosenOption = damageTypeChoice?.options.find(option =>
    option.label.toLowerCase() === choice ||
    option.type.toLowerCase() === choice
  )

  if (!chosenOption) {
    return 'Radiant'
  }

  return chosenOption.type === 'weapon_normal' ? 'weapon_normal' : chosenOption.type
}

// Build the attack's grid reach from the weapon's own properties so ranged and
// reach weapons keep their normal attack classification.
const resolveTrueStrikeAttackRange = (weaponSnapshot: Item): number => {
  if (weaponSnapshot.properties?.some(property => property.toLowerCase() === 'range' || property.toLowerCase().startsWith('range:'))) {
    const rangeProperty = weaponSnapshot.properties.find(property => property.toLowerCase().startsWith('range:'))
    if (rangeProperty) {
      const match = rangeProperty.match(/range:(\d+)/i)
      if (match?.[1]) {
        return Math.max(1, Math.floor(Number(match[1]) / 5))
      }
    }
    return 2
  }

  if (weaponSnapshot.properties?.some(property => property.toLowerCase() === 'reach')) {
    return 2
  }

  return 1
}
