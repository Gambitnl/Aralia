import { describe, it, expect } from 'vitest'
import { ResistanceCalculator } from '../resistanceUtils'
import type { CombatCharacter } from '@/types'
import type { DamageType } from '@/types/spells'
import { createSpellZone } from '@/systems/spells/effects/triggerHandler'

const createTestChar = (
  name: string,
  resistances: DamageType[] = [],
  vulnerabilities: DamageType[] = [],
  immunities: DamageType[] = [],
  position = { x: 0, y: 0 },
  team: 'player' | 'enemy' = 'player'
): CombatCharacter => ({
  id: name,
  name,
  level: 1,
  class: { id: 'test', name: 'Test', description: '', hitDie: 8, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
  position,
  stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' },
  abilities: [],
  team,
  currentHP: 10,
  maxHP: 10,
  initiative: 0,
  statusEffects: [],
  actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, legendary: { used: 0, total: 0 }, movement: { used: 0, total: 30 }, freeActions: 1 },
  resistances,
  vulnerabilities,
  immunities
})

describe('ResistanceCalculator', () => {
  it('should return base damage when no resistances apply (default)', () => {
    const mockCharacter = {
        resistances: [],
        vulnerabilities: [],
        immunities: []
    } as unknown as CombatCharacter
    const damage = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damage).toBe(10)
  })

  it('should apply resistance (half damage)', () => {
    const mockCharacter = {
        resistances: ['Fire'],
        vulnerabilities: [],
        immunities: []
    } as unknown as CombatCharacter

    const damage = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damage).toBe(5) // floor(10 / 2)
  })

  it('should apply vulnerability (double damage)', () => {
    const mockCharacter = {
        resistances: [],
        vulnerabilities: ['Fire'],
        immunities: []
    } as unknown as CombatCharacter

    const damage = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damage).toBe(20) // 10 * 2
  })

  it('should apply both resistance and vulnerability (cancel out effectively)', () => {
    // XGtE Rule: They cancel out, damage is unchanged.
    const mockCharacter = {
        resistances: ['Fire'],
        vulnerabilities: ['Fire'],
        immunities: []
    } as unknown as CombatCharacter

    // Test with even number (previously worked by accident: floor(10/2)*2 = 10)
    const damageEven = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damageEven).toBe(10)

    // Test with odd number (previously failed: floor(25/2)*2 = 24)
    const damageOdd = ResistanceCalculator.applyResistances(25, 'Fire', mockCharacter)
    expect(damageOdd).toBe(25)
  })

  it('should apply immunity (zero damage) regardless of others', () => {
    const mockCharacter = {
        resistances: ['Fire'],
        vulnerabilities: ['Fire'],
        immunities: ['Fire']
    } as unknown as CombatCharacter

    const damage = ResistanceCalculator.applyResistances(100, 'Fire', mockCharacter)
    expect(damage).toBe(0)
  })

  it('should apply temporary resistance from active status effects (e.g. Barbarian Rage)', () => {
    const mockCharacter = {
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      statusEffects: [
        {
          id: 'rage',
          name: 'Rage',
          type: 'buff',
          duration: 10,
          modifiers: {
            resistance: ['Bludgeoning', 'Piercing', 'Slashing']
          }
        }
      ]
    } as unknown as CombatCharacter

    // Barbarian taking physical slashing damage while raging
    const damageSlashing = ResistanceCalculator.applyResistances(10, 'Slashing', mockCharacter)
    expect(damageSlashing).toBe(5) // floor(10 / 2)

    // Barbarian taking physical piercing damage while raging
    const damagePiercing = ResistanceCalculator.applyResistances(15, 'Piercing', mockCharacter)
    expect(damagePiercing).toBe(7) // floor(15 / 2)

    // Fire damage is not resisted by standard Rage
    const damageFire = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damageFire).toBe(10)
  })

  it('should apply temporary immunity from active status effects', () => {
    const mockCharacter = {
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      statusEffects: [
        {
          id: 'death_ward',
          name: 'Death Ward',
          type: 'buff',
          duration: 1,
          modifiers: {
            immunity: ['Necrotic']
          }
        }
      ]
    } as unknown as CombatCharacter

    const damageNecrotic = ResistanceCalculator.applyResistances(50, 'Necrotic', mockCharacter)
    expect(damageNecrotic).toBe(0)
  })

  it('should apply temporary vulnerability from active status effects', () => {
    const mockCharacter = {
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      statusEffects: [
        {
          id: 'curse',
          name: 'Curse',
          type: 'debuff',
          duration: 3,
          modifiers: {
            vulnerability: ['Cold']
          }
        }
      ]
    } as unknown as CombatCharacter

    const damageCold = ResistanceCalculator.applyResistances(10, 'Cold', mockCharacter)
    expect(damageCold).toBe(20) // 10 * 2
  })

  it('should apply temporary resistance from activeEffects (active spell effects)', () => {
    const mockCharacter = {
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      activeEffects: [
        {
          id: 'protection_from_energy_fire',
          spellId: 'protection_from_energy',
          casterId: 'caster-1',
          sourceName: 'Protection from Energy',
          type: 'buff',
          duration: { type: 'rounds', value: 10 },
          startTime: 1,
          mechanics: {
            damageResistance: ['Fire']
          }
        }
      ]
    } as unknown as CombatCharacter

    const damageFire = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damageFire).toBe(5) // floor(10 / 2)
  })

  it('should apply temporary immunity from activeEffects', () => {
    const mockCharacter = {
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      activeEffects: [
        {
          id: 'spell_immunity_acid',
          spellId: 'acid_shield',
          casterId: 'caster-1',
          sourceName: 'Acid Shield',
          type: 'buff',
          duration: { type: 'rounds', value: 10 },
          startTime: 1,
          mechanics: {
            damageImmunity: ['Acid']
          }
        }
      ]
    } as unknown as CombatCharacter

    const damageAcid = ResistanceCalculator.applyResistances(100, 'Acid', mockCharacter)
    expect(damageAcid).toBe(0)
  })

  it('should apply temporary vulnerability from activeEffects', () => {
    const mockCharacter = {
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      activeEffects: [
        {
          id: 'vulnerability_curse',
          spellId: 'curse',
          casterId: 'caster-1',
          sourceName: 'Curse',
          type: 'debuff',
          duration: { type: 'rounds', value: 10 },
          startTime: 1,
          mechanics: {
            damageVulnerability: ['Cold']
          }
        }
      ]
    } as unknown as CombatCharacter

    const damageCold = ResistanceCalculator.applyResistances(10, 'Cold', mockCharacter)
    expect(damageCold).toBe(20) // 10 * 2
  })

  it('should halve damage while the target stands inside a resistance-granting zone', () => {
    const caster = createTestChar('Caster')
    const target = createTestChar('Target', [], [], [], { x: 1, y: 0 })
    const zone = createSpellZone(
      'protective-aura',
      caster.id,
      caster.position,
      { shape: 'sphere', size: 20 },
      [
        {
          type: 'DEFENSIVE',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          defenseType: 'resistance',
          damageType: ['Fire'],
          duration: { type: 'minutes', value: 10 },
          description: 'Fire resistance aura'
        } as any
      ],
      1,
      10,
      undefined,
      undefined,
      ['point']
    )

    const damageFire = ResistanceCalculator.applyResistances(10, 'Fire', target, caster, false, {
      spellZones: [zone],
      characters: [caster, target]
    })

    expect(damageFire).toBe(5)
  })

  it('should not apply zone resistance once the target moves outside the area', () => {
    const caster = createTestChar('Caster')
    const targetOutside = createTestChar('Target', [], [], [], { x: 5, y: 0 })
    const zone = createSpellZone(
      'protective-aura',
      caster.id,
      caster.position,
      { shape: 'sphere', size: 20 },
      [
        {
          type: 'DEFENSIVE',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          defenseType: 'resistance',
          damageType: ['Fire'],
          duration: { type: 'minutes', value: 10 },
          description: 'Fire resistance aura'
        } as any
      ],
      1,
      10,
      undefined,
      undefined,
      ['point']
    )

    const damageFire = ResistanceCalculator.applyResistances(10, 'Fire', targetOutside, caster, false, {
      spellZones: [zone],
      characters: [caster, targetOutside]
    })

    expect(damageFire).toBe(10)
  })

  it('should grant immunity while the target stands inside an immunity zone', () => {
    const caster = createTestChar('Caster')
    const target = createTestChar('Target', [], [], [], { x: 1, y: 0 })
    const zone = createSpellZone(
      'silent-field',
      caster.id,
      caster.position,
      { shape: 'sphere', size: 20 },
      [
        {
          type: 'DEFENSIVE',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          defenseType: 'immunity',
          damageType: ['Thunder'],
          duration: { type: 'minutes', value: 10 },
          description: 'Thunder immunity field'
        } as any
      ],
      1,
      10,
      undefined,
      undefined,
      ['point']
    )

    const damageThunder = ResistanceCalculator.applyResistances(22, 'Thunder', target, caster, false, {
      spellZones: [zone],
      characters: [caster, target]
    })

    expect(damageThunder).toBe(0)
  })
})
