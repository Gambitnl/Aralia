/**
 * @file i18n.ts
 * Simple internationalization utility for retrieving localized strings.
 * Supports dot-notation for nested keys and variable interpolation.
 */
import en from '../../locales/en.json';

type LocaleData = Record<string, unknown>;

const locales: Record<string, LocaleData> = {
  en: en as LocaleData,
};

const currentLocale = 'en';

/**
 * Retrieves a localized string for the given key.
 *
 * @param key - The dot-notation key for the string (e.g., 'common.buttons.save').
 * @param params - Optional object containing values to interpolate into the string.
 *                 Replaces `{variable}` placeholders in the string with the provided values.
 * @returns The localized string with values interpolated. Returns the `key` itself if:
 *          - The key does not exist in the current locale.
 *          - The resolved value is not a string.
 *
 * @example
 * // en.json: { "greeting": "Hello, {name}!" }
 * t('greeting', { name: 'World' }); // Returns "Hello, World!"
 * t('missing.key'); // Returns "missing.key"
 *
 * @see src/utils/__tests__/i18n.test.ts for comprehensive test cases and usage examples.
 */
export const t = (key: string, params?: Record<string, string | number>): string => {
  const keys = key.split('.');
  let value: unknown = locales[currentLocale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key; // Return key if not found
    }
  }

  if (typeof value !== 'string') {
      return key;
  }

  if (params) {
    return value.replace(/{(\w+)}/g, (_, k) => {
      return params[k] !== undefined ? String(params[k]) : `{${k}}`;
    });
  }

  return value;
};
