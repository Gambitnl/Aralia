/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:57
 * Dependents: core/index.ts, logger.ts, spellAbilityFactory.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
interface LogContext {
    [key: string]: unknown;
}
/**
 * A centralized logger utility that wraps console methods and provides automatic redaction of sensitive data.
 *
 * Use this logger instead of `console.log` directly to ensure:
 * 1. Consistent formatting with timestamps.
 * 2. Automatic redaction of secrets (e.g., API keys, passwords) in the context object.
 * 3. Type-safe logging levels.
 *
 * @example
 * import { logger } from '@/utils/logger';
 *
 * logger.info('Player saved game', { playerId: '123', saveData: data });
 */
declare class Logger {
    private log;
    /**
     * Logs a debug message. Use for detailed information useful during development.
     *
     * @param message - The message to log.
     * @param context - Optional context object. Any sensitive keys will be redacted.
     */
    debug(message: string, context?: LogContext): void;
    /**
     * Logs an informational message. Use for general application flow events.
     *
     * @param message - The message to log.
     * @param context - Optional context object. Any sensitive keys will be redacted.
     */
    info(message: string, context?: LogContext): void;
    /**
     * Logs a warning message. Use for unexpected situations that aren't fatal errors.
     *
     * @param message - The message to log.
     * @param context - Optional context object. Any sensitive keys will be redacted.
     */
    warn(message: string, context?: LogContext): void;
    /**
     * Logs an error message. Use for critical failures or exceptions.
     *
     * @param message - The message to log.
     * @param context - Optional context object. Any sensitive keys will be redacted.
     */
    error(message: string, context?: LogContext): void;
}
export declare const logger: Logger;
export {};
