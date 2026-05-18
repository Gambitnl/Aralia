// ============================================================================
// Symphony Structured Logger
// ============================================================================
// Structured logging with context fields (issue_id, issue_identifier,
// session_id) as required by SPEC Section 13.1.
//
// Uses stable key=value phrasing with action outcomes. Avoids logging
// large raw payloads. All output goes to stderr so stdout stays clean
// for any future protocol use.
// ============================================================================

import type { Issue } from './types.js';

// ---------------------------------------------------------------------------
// Log levels — standard severity ordering
// ---------------------------------------------------------------------------
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Context fields that get attached to every log line
// ---------------------------------------------------------------------------
interface LogContext {
  issueId?: string;
  issueIdentifier?: string;
  sessionId?: string;
  component?: string;
  [key: string]: string | number | boolean | undefined;
}

// ---------------------------------------------------------------------------
// Logger class
// ---------------------------------------------------------------------------
export class Logger {
  private minLevel: LogLevel;
  private context: LogContext;

  constructor(minLevel: LogLevel = 'info', context: LogContext = {}) {
    this.minLevel = minLevel;
    this.context = context;
  }

  /**
   * Create a child logger that inherits this logger's context plus
   * additional fields. Useful for per-issue or per-session loggers.
   */
  child(extraContext: LogContext): Logger {
    const child = new Logger(this.minLevel, {
      ...this.context,
      ...extraContext,
    });
    return child;
  }

  /** Create a child logger scoped to a specific issue */
  forIssue(issue: Issue): Logger {
    return this.child({
      issueId: issue.id,
      issueIdentifier: issue.identifier,
    });
  }

  /** Create a child logger scoped to a specific session */
  forSession(sessionId: string): Logger {
    return this.child({ sessionId });
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    this.log('debug', message, extra);
  }

  info(message: string, extra?: Record<string, unknown>): void {
    this.log('info', message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    this.log('warn', message, extra);
  }

  error(message: string, extra?: Record<string, unknown>): void {
    this.log('error', message, extra);
  }

  /** Update the minimum log level at runtime (for dynamic reload) */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  // -------------------------------------------------------------------------
  // Internal formatting
  // -------------------------------------------------------------------------
  private log(
    level: LogLevel,
    message: string,
    extra?: Record<string, unknown>
  ): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const timestamp = new Date().toISOString();
    const parts: string[] = [
      `ts=${timestamp}`,
      `level=${level}`,
    ];

    // Add persistent context fields
    for (const [key, value] of Object.entries(this.context)) {
      if (value !== undefined) {
        parts.push(`${camelToSnake(key)}=${formatValue(value)}`);
      }
    }

    // Add message
    parts.push(`msg=${JSON.stringify(message)}`);

    // Add extra fields (truncated for safety)
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        if (value !== undefined) {
          const formatted = formatValue(value);
          // Truncate long values to avoid logging huge payloads
          const truncated =
            formatted.length > 200
              ? formatted.slice(0, 197) + '...'
              : formatted;
          parts.push(`${camelToSnake(key)}=${truncated}`);
        }
      }
    }

    const line = parts.join(' ');
    process.stderr.write(line + '\n');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert camelCase to snake_case for log key consistency */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Format a value for key=value logging */
function formatValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value === null) return 'null';
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Default singleton — used when no custom logger is provided
// ---------------------------------------------------------------------------
export const logger = new Logger(
  (process.env.SYMPHONY_LOG_LEVEL as LogLevel) || 'info',
  { component: 'symphony' }
);
