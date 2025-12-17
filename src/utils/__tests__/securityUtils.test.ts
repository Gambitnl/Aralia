
import { describe, it, expect } from 'vitest';
import { redactSensitiveData, safeJSONParse } from '../securityUtils';

describe('safeJSONParse', () => {
    it('parses valid JSON correctly', () => {
        const json = '{"key": "value", "num": 123}';
        const result = safeJSONParse(json);
        expect(result).toEqual({ key: 'value', num: 123 });
    });

    it('returns fallback for invalid JSON', () => {
        const json = 'invalid json';
        const fallback = { error: true };
        const result = safeJSONParse(json, fallback);
        expect(result).toEqual(fallback);
    });

    it('returns null by default for invalid JSON', () => {
        const json = 'invalid json';
        const result = safeJSONParse(json);
        expect(result).toBeNull();
    });

    it('handles null/undefined input gracefully', () => {
        expect(safeJSONParse(null)).toBeNull();
        expect(safeJSONParse(undefined)).toBeNull();
    });

    it('parses arrays correctly', () => {
        const json = '[1, 2, 3]';
        const result = safeJSONParse(json);
        expect(result).toEqual([1, 2, 3]);
    });
});

describe('redactSensitiveData', () => {
  const FAKE_KEY = 'TEST_API_KEY_12345';

  it('redacts the secret from a plain string', () => {
    const input = `Error: 401 Unauthorized for key ${FAKE_KEY}`;
    const output = redactSensitiveData(input, FAKE_KEY);
    expect(output).toBe('Error: 401 Unauthorized for key [REDACTED]');
  });

  it('redacts the secret from a JSON string', () => {
    const input = JSON.stringify({ error: { message: 'Failed', key: FAKE_KEY } });
    const output = redactSensitiveData(input, FAKE_KEY);
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain(FAKE_KEY);
  });

  it('redacts the secret from an object (shallow)', () => {
    // Note: The implementation might be string-based or object traversal.
    // If string-based, it returns a string. If object-based, it returns an object.
    // Let's assume we want it to return a safe structure (likely string for logging purposes or same type).
    // For Sentinel task "under 50 lines", string replacement on JSON is easiest/safest.
    const input = { message: 'error', apiKey: FAKE_KEY };
    const output = redactSensitiveData(input, FAKE_KEY);
    // If output is string
    if (typeof output === 'string') {
        expect(output).toContain('[REDACTED]');
        expect(output).not.toContain(FAKE_KEY);
    } else {
        expect(output.apiKey).toBe('[REDACTED]');
    }
  });

  it('handles Error objects', () => {
    const error = new Error(`Failed with key ${FAKE_KEY}`);
    const output = redactSensitiveData(error, FAKE_KEY);
    expect(String(output)).toContain('[REDACTED]');
    expect(String(output)).not.toContain(FAKE_KEY);
  });

  it('handles empty secrets gracefully', () => {
    const input = "some text";
    expect(redactSensitiveData(input, '')).toBe(input);
    expect(redactSensitiveData(input, undefined)).toBe(input);
  });

  it('handles null/undefined input', () => {
      expect(redactSensitiveData(null, FAKE_KEY)).toBeNull();
      expect(redactSensitiveData(undefined, FAKE_KEY)).toBeUndefined();
  });
});
