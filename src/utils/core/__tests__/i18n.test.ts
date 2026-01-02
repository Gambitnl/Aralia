import { describe, it, expect, vi } from 'vitest';
import { t } from '../i18n';

// Mock the locales since we are testing the utility logic, not the content of json files
vi.mock('../../locales/en.json', () => ({
  default: {
    app: {
      game_over: "GAME OVER",
      greeting: "Hello, {name}!",
      nested: {
        key: "Nested Value"
      }
    }
  }
}));

describe('i18n utility', () => {
  it('should return the correct translation for a simple key', () => {
    expect(t('app.game_over')).toBe('GAME OVER');
  });

  it('should return the correct translation for a nested key', () => {
    expect(t('app.nested.key')).toBe('Nested Value');
  });

  it('should return the key if translation is missing', () => {
    expect(t('app.missing_key')).toBe('app.missing_key');
  });

  it('should interpolate variables correctly', () => {
    expect(t('app.greeting', { name: 'World' })).toBe('Hello, World!');
  });

  it('should handle missing interpolation parameters', () => {
    expect(t('app.greeting')).toBe('Hello, {name}!');
  });

  it('should handle numeric parameters', () => {
     expect(t('app.greeting', { name: 123 })).toBe('Hello, 123!');
  });
});
