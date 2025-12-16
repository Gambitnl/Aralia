import { redactSensitiveData } from './securityUtils';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    // Redact sensitive data from context before logging
    const safeContext = context ? redactSensitiveData(context) : undefined;

    // Direct mapping to console methods to avoid index signature issues
    // and preserve method context if needed
    switch (level) {
      case 'debug':
        if (safeContext) console.debug(`${prefix} ${message}`, safeContext);
        else console.debug(`${prefix} ${message}`);
        break;
      case 'info':
        if (safeContext) console.info(`${prefix} ${message}`, safeContext);
        else console.info(`${prefix} ${message}`);
        break;
      case 'warn':
        if (safeContext) console.warn(`${prefix} ${message}`, safeContext);
        else console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        if (safeContext) console.error(`${prefix} ${message}`, safeContext);
        else console.error(`${prefix} ${message}`);
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
