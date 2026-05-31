import { CombatState } from '@/types/combat'
import { SpellCommand } from './SpellCommand'
import { logger } from '@/utils/logger'

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
        logger.debug(`[CommandExecutor] Executed: ${command.description}`, {
          commandId: command.id,
          metadata: command.metadata
        })
      }

      return {
        success: true,
        finalState: currentState,
        executedCommands
      }
    } catch (error) {
      logger.error('[CommandExecutor] Command execution failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        failedCommandId: commands[executedCommands.length]?.id,
        commandsExecuted: executedCommands.length
      })

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
      logger.warn('[CommandExecutor] Rolling back executed commands...', {
        count: result.executedCommands.length,
        failedCommandId: result.failedCommand?.id
      })

      try {
        let rolledBackState = result.finalState

        for (let i = result.executedCommands.length - 1; i >= 0; i--) {
          const command = result.executedCommands[i]
          if (command.undo) {
            rolledBackState = command.undo(rolledBackState)
          } else {
             logger.warn(`[CommandExecutor] Command ${command.id} does not support undo. Rollback incomplete.`)
          }
        }

        return {
          ...result,
          finalState: rolledBackState
        }
      } catch (rollbackError) {
        logger.error('[CommandExecutor] Rollback failed', {
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          originalError: result.error?.message
        })
        return result
      }
    }

    return result
  }
}
