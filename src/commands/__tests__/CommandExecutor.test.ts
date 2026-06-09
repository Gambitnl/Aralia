import { describe, it, expect, vi } from 'vitest'
import { CommandExecutor } from '../base/CommandExecutor'
import type { CombatState } from '@/types/combat'

describe('CommandExecutor', () => {
  const mockState = { characters: [], combatLog: [] } as unknown as CombatState

  const makeMetadata = (idSuffix: string) => ({
    // TODO(lint-intent): Flesh out richer metadata once spell commands log more context.
    spellId: `spell-${idSuffix}`,
    spellName: `Test Spell ${idSuffix}`,
    casterId: 'caster-1',
    casterName: 'Test Caster',
    targetIds: [],
    effectType: 'test',
    timestamp: Date.now(),
  });

  it('should execute a list of commands', async () => {
    const cmd1 = {
      id: '1',
      description: 'Cmd1',
      metadata: makeMetadata('1'),
      execute: vi.fn().mockReturnValue(mockState)
    }
    const cmd2 = {
      id: '2',
      description: 'Cmd2',
      metadata: makeMetadata('2'),
      execute: vi.fn().mockReturnValue(mockState)
    }

    const result = await CommandExecutor.execute([cmd1, cmd2], mockState)

    expect(result.success).toBe(true)
    expect(cmd1.execute).toHaveBeenCalled()
    expect(cmd2.execute).toHaveBeenCalled()
    expect(result.executedCommands).toHaveLength(2)
  })

  it('should handle failure and return partial success info', async () => {
    const cmd1 = {
      id: '1',
      description: 'Cmd1',
      metadata: makeMetadata('1'),
      execute: vi.fn().mockReturnValue(mockState)
    }
    const cmdFail = {
      id: '2',
      description: 'CmdFail',
      metadata: makeMetadata('fail'),
      execute: vi.fn().mockImplementation(() => {
        throw new Error('Boom')
      })
    }

    const result = await CommandExecutor.execute([cmd1, cmdFail], mockState)

    expect(result.success).toBe(false)
    expect(result.executedCommands).toHaveLength(1) // Only cmd1
    expect(result.failedCommand).toBe(cmdFail)
    expect(result.error).toBeDefined()
  })

  it('should stop at the first async command failure and surface that exact command', async () => {
    const firstResultState = {
      characters: [{ id: 'caster', name: 'Caster' }],
      combatLog: [{ id: 'e1', timestamp: 0, type: 'combat', message: 'first' }]
    } as unknown as CombatState

    const cmd1 = {
      id: '1',
      description: 'Command 1',
      metadata: makeMetadata('1'),
      execute: vi.fn().mockResolvedValue(firstResultState)
    }

    const asyncFailure = new Error('Async command failed')
    const cmd2 = {
      id: '2',
      description: 'Command 2',
      metadata: makeMetadata('2'),
      execute: vi.fn().mockRejectedValue(asyncFailure)
    }

    const cmd3 = {
      id: '3',
      description: 'Command 3',
      metadata: makeMetadata('3'),
      execute: vi.fn().mockReturnValue(mockState)
    }

    const result = await CommandExecutor.execute([cmd1, cmd2, cmd3], mockState)

    expect(result.success).toBe(false)
    expect(result.error).toBe(asyncFailure)
    expect(result.executedCommands).toEqual([cmd1])
    expect(result.failedCommand).toBe(cmd2)
    expect(cmd3.execute).not.toHaveBeenCalled()
  })

  it('should return the last committed state on async failure and keep the initial snapshot unchanged', async () => {
    const initialState = {
      characters: [{ id: 'caster', name: 'Caster', hp: 12 }],
      combatLog: []
    } as unknown as CombatState
    const initialStateSnapshot = JSON.parse(
      JSON.stringify(initialState)
    ) as unknown as CombatState

    const committedState = {
      ...initialState,
      combatLog: [{ id: 'effect-1', timestamp: 1, type: 'combat', message: 'Command 1 landed' }]
    } as unknown as CombatState

    const cmd1 = {
      id: '1',
      description: 'Command 1',
      metadata: makeMetadata('1'),
      execute: vi.fn().mockResolvedValue(committedState)
    }

    const cmd2 = {
      id: '2',
      description: 'Command 2',
      metadata: makeMetadata('2'),
      execute: vi.fn().mockRejectedValue(new Error('Async boom'))
    }

    const result = await CommandExecutor.execute([cmd1, cmd2], initialState)

    expect(result.success).toBe(false)
    expect(result.executedCommands).toEqual([cmd1])
    expect(result.failedCommand).toBe(cmd2)
    expect(result.finalState).toBe(committedState)
    expect(result.finalState).not.toBe(initialState)
    expect(initialState).toEqual(initialStateSnapshot)
    expect(initialStateSnapshot.combatLog).toHaveLength(0)
  })
})
