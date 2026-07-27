import { CombatState } from '@/types/combat';
import { SpellCommand } from './SpellCommand';
export interface ExecutionResult {
    success: boolean;
    finalState: CombatState;
    executedCommands: SpellCommand[];
    failedCommand?: SpellCommand;
    error?: Error;
}
export declare class CommandExecutor {
    /**
     * Execute a sequence of commands
     */
    static execute(commands: SpellCommand[], initialState: CombatState): Promise<ExecutionResult>;
    /**
     * Execute commands with rollback on failure
     */
    static executeWithRollback(commands: SpellCommand[], initialState: CombatState): Promise<ExecutionResult>;
}
