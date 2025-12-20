import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger';

// Mock ENV to have a predictable secret for redaction
vi.mock('../../config/env', () => ({
  ENV: {
    API_KEY: 'SECRET_API_KEY_123',
    DEV: true
  }
}));

describe('Logger Security', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should redact secrets from the message', () => {
    logger.info('This message contains SECRET_API_KEY_123 inside it.');

    // Use expect.stringContaining to match the message part
    // Note: logger.info calls console.info with ONE argument if context is undefined.
    // However, my implementation in logger.ts says:
    // if (safeContext) console.info(...) else console.info(...)
    // So if no context is provided, it's called with ONE argument.

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[REDACTED]')
    );
  });

  it('should redact secrets from the context object', () => {
    const sensitiveContext = {
        userId: 'user-1',
        apiKey: 'SECRET_API_KEY_123',
        nested: { key: 'SECRET_API_KEY_123' }
    };

    logger.warn('Warning message', sensitiveContext);

    // We expect the context object passed to console.warn to have the secret redacted
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] Warning message'),
      expect.objectContaining({
        apiKey: '[REDACTED]',
        nested: expect.objectContaining({ key: '[REDACTED]' })
      })
    );
  });
});
