import { CombatState } from '@/types/combat'
import { SpellCommand } from './SpellCommand'

export interface ExecutionResult {
  success: boolean
  finalState: CombatState
  executedCommands: SpellCommand[]
  failedCommand?: SpellCommand
  error?: Error
}

export class CommandExecutor {
  /**
   * Execute a sequence of commands
   */
  static execute(
    commands: SpellCommand[],
    initialState: CombatState
  ): ExecutionResult {
    let currentState = initialState
    const executedCommands: SpellCommand[] = []

    try {
      for (const command of commands) {
        // Execute command
        currentState = command.execute(currentState)
        executedCommands.push(command)

        // Log execution (debug level)
        // console.debug(`[CommandExecutor] Executed: ${command.description}`, {
        //   commandId: command.id,
        //   metadata: command.metadata
        // })
      }

      return {
        success: true,
        finalState: currentState,
        executedCommands
      }
    } catch (error) {
      console.error('[CommandExecutor] Command execution failed:', error)

      return {
        success: false,
        finalState: currentState, // Return state before failed command (or partial state?)
        // Ideally we return the state BEFORE the failed command ran.
        // currentState is updated AFTER execute() returns.
        // So if execute() throws, currentState is still the state BEFORE the command.
        // EXCEPT if command.execute() partially mutated something (which it shouldn't as it returns new state).
        // So this is correct for immutable state.
        executedCommands,
        failedCommand: commands[executedCommands.length],
        error: error as Error
      }
    }
  }

  /**
   * Execute commands with rollback on failure
   */
  static executeWithRollback(
    commands: SpellCommand[],
    initialState: CombatState
  ): ExecutionResult {
    const result = this.execute(commands, initialState)

    if (!result.success && result.executedCommands.length > 0) {
      // Attempt rollback
      console.warn('[CommandExecutor] Rolling back executed commands...')

      try {
        let rolledBackState = result.finalState

        for (let i = result.executedCommands.length - 1; i >= 0; i--) {
          const command = result.executedCommands[i]
          if (command.undo) {
            rolledBackState = command.undo(rolledBackState)
          } else {
             console.warn(`[CommandExecutor] Command ${command.id} does not support undo. Rollback incomplete.`)
          }
        }

        return {
          ...result,
          finalState: rolledBackState
        }
      } catch (rollbackError) {
        console.error('[CommandExecutor] Rollback failed:', rollbackError)
        return result
      }
    }

    return result
  }
}
