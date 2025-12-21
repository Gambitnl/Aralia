import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger';
import * as securityUtils from '../securityUtils';

// Mock ENV to have a predictable secret for redaction
vi.mock('../../config/env', () => ({
  ENV: {
    API_KEY: 'SECRET_API_KEY_123',
    DEV: true
  }
}));

// Mock securityUtils so we can force errors
vi.mock('../securityUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof securityUtils>();
  return {
    ...actual,
    redactSensitiveData: vi.fn(actual.redactSensitiveData),
  };
});

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

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[WARN] Warning message'),
      expect.objectContaining({
        apiKey: '[REDACTED]',
        nested: expect.objectContaining({ key: '[REDACTED]' })
      })
    );
  });

  it('should fallback securely when redaction fails', () => {
    // Force redaction to throw an error
    vi.mocked(securityUtils.redactSensitiveData).mockImplementationOnce(() => {
      throw new Error('Redaction failed');
    });

    const dangerousMessage = 'This message causes a crash';
    logger.error(dangerousMessage);

    // Should verify that:
    // 1. The original message was NOT logged (implied by not being called with it)
    // 2. A security error message WAS logged
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[LOGGER SECURITY ERROR]')
    );
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining(dangerousMessage)
    );
  });
});
