import { describe, it, expect } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import { Spell, SpellEffect } from '@/types/spells'
import { CombatCharacter } from '@/types/combat'
import { GameState } from '@/types'
import { createMockCombatCharacter, createMockGameState } from '@/utils/factories'

describe('SpellCommandFactory - Conditional Endings', () => {
  it('should pass conditionalEndings to the CommandContext when present on an effect', async () => {
    // Mock spell with a conditional ending (simulating Hex or Hunter's Mark)
    const mockSpell: Spell = {
      id: 'mock-conditional-spell',
      name: 'Mock Conditional',
      level: 1,
      school: 'Divination' as any,
      castingTime: 'bonus_action' as any,
      range: { type: 'ranged', distance: 90 },
      duration: { type: 'timed', value: 1, unit: 'hour', concentration: true },
      components: { verbal: true, somatic: false, material: false },
      classes: [],
      subClasses: [],
      description: 'Mock',
      targeting: { type: 'creature', count: 1 } as any,
      effects: [
        {
          type: 'UTILITY',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          utilityType: 'other',
          conditionalEndings: [
            {
              trigger: 'target_drops_to_0_hp',
              scope: 'effect',
              description: 'Ends when target drops to 0 hp.'
            }
          ]
        } as unknown as SpellEffect
      ]
    }

    const caster: CombatCharacter = createMockCombatCharacter({ id: 'caster-1', name: 'Caster' })
    const target: CombatCharacter = createMockCombatCharacter({ id: 'target-1', name: 'Target' })
    const gameState: GameState = createMockGameState()

    // Create commands
    const commands = await SpellCommandFactory.createCommands(
      mockSpell,
      caster,
      [target],
      1,
      gameState
    )

    // commands will contain UtilityCommand, and because of concentration, StartConcentrationCommand.
    // Let's find the one that corresponds to the effect itself
    const effectCommand = commands.find(c => (c as any).context.conditionalEndings !== undefined)
    expect(effectCommand).toBeDefined()

    // Verify context has conditionalEndings bridged
    const context = (effectCommand as any).context
    expect(context.conditionalEndings).toBeDefined()
    expect(context.conditionalEndings.length).toBe(1)
    expect(context.conditionalEndings[0].trigger).toBe('target_drops_to_0_hp')
  })
})
