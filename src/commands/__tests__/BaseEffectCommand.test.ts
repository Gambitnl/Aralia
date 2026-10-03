import { describe, it, expect } from 'vitest'

import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { SpellEffect, HealingEffect } from '../../types/spells'
import type { CommandContext } from '../base/SpellCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '../../utils/core'
import type { CombatCharacter, CombatState } from '../../types/combat'

class StateFreshnessProbeCommand extends BaseEffectCommand {
  public getLiveCaster(state: CombatState): CombatCharacter {
    return this.getCaster(state)
  }

  public getLiveTargets(state: CombatState): CombatCharacter[] {
    return this.getTargets(state)
  }

  public execute(state: CombatState): CombatState {
    return state
  }

  public get description(): string {
    return 'State freshness probe command'
  }
}

describe('BaseEffectCommand live state resolution', () => {
  const caster = createMockCombatCharacter({ id: 'caster', name: 'Original Caster' })
  const targets = [createMockCombatCharacter({ id: 'target-1', name: 'Original Target' })]
  const context: CommandContext = {
    spellId: 'freshness-probe',
    spellName: 'State Freshness Probe',
    caster,
    targets,
    gameState: createMockGameState(),
    castAtLevel: 1
  }

  const effect = {
    type: 'HEALING',
    healing: { dice: '1d1' },
    trigger: { type: 'immediate' },
    condition: { type: 'always' }
  } as unknown as HealingEffect

  it('resolves caster and targets from the live state, not snapshots', () => {
    const snapshotCaster = createMockCombatCharacter({
      id: 'caster-1',
      name: 'Caster Snapshot',
      currentHP: 20
    })
    const snapshotTarget = createMockCombatCharacter({
      id: 'target-1',
      name: 'Target Snapshot',
      currentHP: 10
    })
    const staleMissingTarget = createMockCombatCharacter({
      id: 'missing-target',
      name: 'Missing Target Snapshot',
      currentHP: 9
    })
    const context: CommandContext = {
      spellId: 'probe-spell',
      spellName: 'State Freshness Probe',
      caster: snapshotCaster,
      targets: [snapshotTarget, staleMissingTarget],
      gameState: createMockGameState(),
      castAtLevel: 1
    }
    const command = new StateFreshnessProbeCommand(effect, context)

    const liveState = createMockCombatState({
      characters: [
        {
          ...snapshotCaster,
          name: 'Casted Caster',
          currentHP: 6
        },
        {
          ...snapshotTarget,
          name: 'Updated Target',
          currentHP: 4
        }
      ]
    })

    const liveCaster = command.getLiveCaster(liveState)
    const liveTargets = command.getLiveTargets(liveState)

    expect(liveCaster.currentHP).toBe(6)
    expect(liveCaster.name).toBe('Casted Caster')
    expect(context.caster.currentHP).toBe(20)
    expect(liveTargets).toHaveLength(1)
    expect(liveTargets[0].id).toBe('target-1')
    expect(liveTargets[0].name).toBe('Updated Target')
    expect(liveTargets[0].currentHP).toBe(4)
  })
})
