
import { describe, it, expect } from 'vitest';
import { redactSensitiveData , safeJSONParse, cleanAIJSON } from '../securityUtils';

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



describe('safeJSONParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJSONParse('{"a": 1}')).toEqual({ a: 1 });
    expect(safeJSONParse('[1, 2]')).toEqual([1, 2]);
  });

  it('should return fallback for invalid JSON', () => {
    expect(safeJSONParse('invalid', { fallback: true })).toEqual({ fallback: true });
    expect(safeJSONParse('{"a": 1', null)).toBeNull();
  });

  it('should return default fallback (null) if not provided', () => {
    expect(safeJSONParse('invalid')).toBeNull();
  });
});

describe('cleanAIJSON', () => {
  it('should remove markdown code blocks', () => {
    const input = '```json\n{"a": 1}\n```';
    expect(cleanAIJSON(input)).toBe('{"a": 1}');
  });

  it('should handle text without markdown', () => {
    expect(cleanAIJSON('{"a": 1}')).toBe('{"a": 1}');
  });

  it('should trim whitespace', () => {
    expect(cleanAIJSON('  {"a": 1}  ')).toBe('{"a": 1}');
  });
});
