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

  it('should execute a list of commands', () => {
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

    const result = CommandExecutor.execute([cmd1, cmd2], mockState)

    expect(result.success).toBe(true)
    expect(cmd1.execute).toHaveBeenCalled()
    expect(cmd2.execute).toHaveBeenCalled()
    expect(result.executedCommands).toHaveLength(2)
  })

  it('should handle failure and return partial success info', () => {
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
        execute: vi.fn().mockImplementation(() => { throw new Error('Boom') })
    }

    const result = CommandExecutor.execute([cmd1, cmdFail], mockState)

    expect(result.success).toBe(false)
    expect(result.executedCommands).toHaveLength(1) // Only cmd1
    expect(result.failedCommand).toBe(cmdFail)
    expect(result.error).toBeDefined()
  })
})
