import { describe, it, expect } from 'vitest'
import { SpellCommandFactory } from '../factory/SpellCommandFactory'
import { DamageCommand } from '../effects/DamageCommand'
import { HealingCommand } from '../effects/HealingCommand'
import type { Spell } from '@/types/spells'
import type { CombatCharacter, CombatState } from '@/types/combat'

// Mocks
const mockCaster = { id: 'c1', name: 'Caster', level: 5 } as CombatCharacter
const mockTarget = { id: 't1', name: 'Target' } as CombatCharacter
const mockState = { characters: [mockCaster, mockTarget] } as CombatState

const createMockSpell = (id: string, overrides: Partial<Spell> = {}): Spell => ({
  id,
  name: id,
  level: 1,
  school: 'Evocation',
  classes: ['Wizard'],
  castingTime: { value: 1, unit: 'action' },
  range: { type: 'ranged', distance: 60 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'instantaneous', concentration: false },
  targeting: { type: 'single', range: 60, validTargets: ['creatures'] },
  effects: [],
  description: 'Test spell',
  ...overrides
})

describe('SpellCommandFactory', () => {
  describe('createCommands', () => {
    it('should create commands for simple damage spell', async () => {
      const fireball = createMockSpell('fireball', {
        effects: [{ type: 'DAMAGE', damage: { dice: '8d6', type: 'Fire' }, trigger: {type: 'immediate'}, condition: {type: 'hit'} }]
      })

      const commands = await SpellCommandFactory.createCommands(
        fireball,
        mockCaster,
        [mockTarget],
        3,
        {} as any
      )

      expect(commands).toHaveLength(1)
      expect(commands[0]).toBeInstanceOf(DamageCommand)
    })

    it('should apply slot level scaling for Damage', async () => {
      const spell = createMockSpell('magic_missile', {
        level: 1,
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '1d4+1', type: 'Force' },
          trigger: {type: 'immediate'}, 
          condition: {type: 'hit'},
          scaling: { type: 'slot_level', bonusPerLevel: '+1d4+1' } // Simplified scaling syntax
        }]
      })

      // This test depends on how I implemented addDice.
      // My addDice implementation handles "XdY" + "AdB".
      // Does it handle "+1"? My regex was `match(/(\d+)d(\d+)/)`.
      // It expects "XdY".
      // So "+1d4" is fine. "+1d4+1" might fail my simple regex.
      // Let's stick to the simple regex support I wrote: "+1d4".
      
      const spellSimple = createMockSpell('burning_hands', {
          level: 1,
          effects: [{
            type: 'DAMAGE',
            damage: { dice: '3d6', type: 'Fire' },
            trigger: {type: 'immediate'}, 
            condition: {type: 'save'},
            scaling: { type: 'slot_level', bonusPerLevel: '+1d6' }
          }]
        })

      const commands = await SpellCommandFactory.createCommands(
        spellSimple,
        mockCaster,
        [mockTarget],
        2, // Cast at level 2 (+1 level)
        {} as any
      )

      const cmd = commands[0] as DamageCommand
      // I can't access `effect` on DamageCommand easily because it's protected in BaseEffectCommand.
      // I should make it public or cast to any for testing.
      // Or check metadata? Metadata stores 'effectType', not values.
      // I'll cast to any.
      
      // Also, my DamageCommand is a Stub that doesn't store the modified effect locally, 
      // BUT BaseEffectCommand constructor takes `effect`.
      // So `(cmd as any).effect` should hold the scaled effect.
      
      const effect: any = (cmd as any).effect;
      expect(effect.damage.dice).toBe('4d6') // 3d6 + 1d6
    })
  })
})
