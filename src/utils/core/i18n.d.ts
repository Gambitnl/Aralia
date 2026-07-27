/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 *
 * Last Sync: 26/01/2026, 01:19:59
 * Dependents: core/index.ts, i18n.ts
 * Imports: None
 *
 * Tool: Codebase Visualizer (Headless Sync)
 */
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
export declare const t: (key: string, params?: Record<string, string | number>) => string;
