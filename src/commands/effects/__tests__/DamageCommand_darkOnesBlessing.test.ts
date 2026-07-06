import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DamageCommand } from '../DamageCommand'
import { CombatState, CombatCharacter } from '../../../types/combat'
import { SpellEffect } from '../../../types/spells'
import { CommandContext } from '../../base/SpellCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../../utils/core/factories'
import * as combatUtils from '../../../utils/combat/combatUtils'

vi.mock('../../../utils/combat/combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/combat/combatUtils')>()
  return {
    ...actual,
    rollDice: vi.fn(),
    rollDamage: vi.fn(),
  }
})

// Deterministic dice: sum of every face (e.g. "2d6" -> 12), so a modest damage
// effect reliably drops a low-HP target to 0 for the kill-trigger tests.
const sumFaces = (dice: string): number => {
  const match = dice.match(/^(\d*)d(\d+)$/i)
  if (!match) return 0
  const count = Number(match[1] || 1)
  const sides = Number(match[2])
  return count * sides
}

const alwaysDamage = (dice: string, type = 'Fire'): SpellEffect => ({
  type: 'DAMAGE',
  damage: { dice, type },
  trigger: { type: 'immediate' },
  condition: { type: 'always' }
})

describe("DamageCommand — Dark One's Blessing (Fiend warlock, level 3)", () => {
  let mockState: CombatState
  let warlock: CombatCharacter
  let enemy: CombatCharacter
  let context: CommandContext

  beforeEach(() => {
    vi.mocked(combatUtils.rollDice).mockImplementation((dice: string) => (dice === '1d20' ? 10 : sumFaces(dice)))
    vi.mocked(combatUtils.rollDamage).mockImplementation((dice: string) => sumFaces(dice))

    // Cha modifier +3 (16) + warlock level 3 = 6 temporary hit points.
    warlock = createMockCombatCharacter({
      id: 'warlock-1',
      name: 'BelphaERomil',
      team: 'player',
      level: 3,
      currentHP: 18,
      maxHP: 18,
      tempHP: 0,
      darkOnesBlessingTempHp: 6
    })

    enemy = createMockCombatCharacter({
      id: 'enemy-1',
      name: 'Goblin',
      team: 'enemy',
      position: { x: 1, y: 1 },
      currentHP: 8,
      maxHP: 8,
      armorClass: 12
    })

    mockState = createMockCombatState({ characters: [warlock, enemy], combatLog: [] })

    context = {
      spellId: 'eldritch-blast',
      spellName: 'Eldritch Blast',
      caster: warlock,
      targets: [enemy],
      gameState: createMockGameState(),
      castAtLevel: 1
    }
  })

  it('grants the caster temporary HP when their damage reduces an enemy to 0 HP', async () => {
    const command = new DamageCommand(alwaysDamage('2d6'), context)
    const newState = await command.execute(mockState)

    const slainEnemy = newState.characters.find(c => c.id === 'enemy-1')!
    const caster = newState.characters.find(c => c.id === 'warlock-1')!

    expect(slainEnemy.currentHP).toBe(0)
    expect(caster.tempHP).toBe(6)
    expect(caster.temporaryHitPointSource?.spellId).toBe('dark_ones_blessing')

    const blessingLog = newState.combatLog.find(l => l.data?.feature === 'dark_ones_blessing')
    expect(blessingLog).toBeDefined()
    expect(blessingLog?.message).toContain('temporary hit points')
  })

  it('does NOT grant temporary HP when the enemy survives the hit', async () => {
    // 1d4 -> 4 damage against an 8-HP goblin leaves it standing.
    const command = new DamageCommand(alwaysDamage('1d4'), context)
    const newState = await command.execute(mockState)

    const survivor = newState.characters.find(c => c.id === 'enemy-1')!
    const caster = newState.characters.find(c => c.id === 'warlock-1')!

    expect(survivor.currentHP).toBeGreaterThan(0)
    expect(caster.tempHP ?? 0).toBe(0)
    expect(newState.combatLog.some(l => l.data?.feature === 'dark_ones_blessing')).toBe(false)
  })

  it('does not fire for a caster without Dark One\'s Blessing', async () => {
    const plainCaster = createMockCombatCharacter({
      id: 'warlock-1',
      name: 'Belphaeromil',
      team: 'player',
      level: 3,
      currentHP: 18,
      maxHP: 18,
      tempHP: 0
      // no darkOnesBlessingTempHp
    })
    mockState = createMockCombatState({ characters: [plainCaster, enemy], combatLog: [] })
    context = { ...context, caster: plainCaster }

    const command = new DamageCommand(alwaysDamage('2d6'), context)
    const newState = await command.execute(mockState)

    const caster = newState.characters.find(c => c.id === 'warlock-1')!
    expect(newState.characters.find(c => c.id === 'enemy-1')!.currentHP).toBe(0)
    expect(caster.tempHP ?? 0).toBe(0)
    expect(newState.combatLog.some(l => l.data?.feature === 'dark_ones_blessing')).toBe(false)
  })

  it('does not stack — keeps the larger of existing temp HP and the blessing', async () => {
    // Caster already has 9 temp HP; the 6-point blessing must not overwrite it.
    warlock = createMockCombatCharacter({
      id: 'warlock-1',
      name: 'Belphaeromil',
      team: 'player',
      level: 3,
      currentHP: 18,
      maxHP: 18,
      tempHP: 9,
      darkOnesBlessingTempHp: 6
    })
    mockState = createMockCombatState({ characters: [warlock, enemy], combatLog: [] })
    context = { ...context, caster: warlock }

    const command = new DamageCommand(alwaysDamage('2d6'), context)
    const newState = await command.execute(mockState)

    const caster = newState.characters.find(c => c.id === 'warlock-1')!
    expect(caster.tempHP).toBe(9)
    expect(newState.combatLog.some(l => l.data?.feature === 'dark_ones_blessing')).toBe(false)
  })

  it('does not fire when the reduced-to-0 creature is a summon', async () => {
    const summon = createMockCombatCharacter({
      id: 'enemy-1',
      name: 'Spectral Wolf',
      team: 'enemy',
      position: { x: 1, y: 1 },
      currentHP: 8,
      maxHP: 8,
      isSummon: true
    })
    mockState = createMockCombatState({ characters: [warlock, summon], combatLog: [] })
    context = { ...context, targets: [summon] }

    const command = new DamageCommand(alwaysDamage('2d6'), context)
    const newState = await command.execute(mockState)

    const caster = newState.characters.find(c => c.id === 'warlock-1')!
    expect(caster.tempHP ?? 0).toBe(0)
    expect(newState.combatLog.some(l => l.data?.feature === 'dark_ones_blessing')).toBe(false)
  })
})
