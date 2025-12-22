import { redactSensitiveData } from './securityUtils';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    let safeMessage = message;
    let safeContext = context;

    try {
        // Redact sensitive data automatically
        // We cast to string because we know if we pass a string, we get a string (or redacted string) back
        safeMessage = redactSensitiveData(message) as string;
        safeContext = context ? redactSensitiveData(context) : undefined;
    } catch {
        // Fallback if redaction fails (e.g., circular dependency in context object, though JSON.stringify usually catches that in securityUtils)
        // We do NOT want to log the original message/context if redaction failed, as it might contain the secret that caused the failure (unlikely but possible)
        console.error(`${prefix} [LOGGER SECURITY ERROR] Failed to redact log message. Original log suppressed.`);
        return;
    }

    // Direct mapping to console methods to avoid index signature issues
    // and preserve method context if needed.
    // We construct the arguments array to avoid printing 'undefined' when context is missing,
    // while keeping the switch statement minimal.
    const args: [string, ...unknown[]] = [`${prefix} ${safeMessage}`];
    if (safeContext) {
      args.push(safeContext);
    }

    switch (level) {
      case 'debug':
        console.debug(...args);
        break;
      case 'info':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }
}

export const logger = new Logger();
