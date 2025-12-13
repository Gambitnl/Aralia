type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    // Security: Suppress debug logs in production to prevent information leakage
    if (level === 'debug' && import.meta.env.PROD) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    // Direct mapping to console methods to avoid index signature issues
    // and preserve method context if needed
    switch (level) {
      case 'debug':
        if (context) console.debug(`${prefix} ${message}`, context);
        else console.debug(`${prefix} ${message}`);
        break;
      case 'info':
        if (context) console.info(`${prefix} ${message}`, context);
        else console.info(`${prefix} ${message}`);
        break;
      case 'warn':
        if (context) console.warn(`${prefix} ${message}`, context);
        else console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        if (context) console.error(`${prefix} ${message}`, context);
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
