/**
 * @file uiIds.test.ts
 * Unit tests for the UI Element ID Registry.
 *
 * Ensures every registered id is unique, well-formed, and that the
 * two namespaces (UI_ID direct ids and WindowFrame-derived ids) never collide.
 */

import { UI_ID, WINDOW_KEYS, windowId, type WindowKey } from '../uiIds';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uiIdValues = Object.values(UI_ID) as string[];
const windowKeyValues = Object.values(WINDOW_KEYS) as string[];
const derivedWindowIds = windowKeyValues.map(k => `window-${k}`);

/** All ids that will actually appear in the DOM at runtime. */
const allRuntimeIds = [...uiIdValues, ...derivedWindowIds];

// ---------------------------------------------------------------------------
// UI_ID
// ---------------------------------------------------------------------------

describe('UI_ID registry', () => {
  it('should have no duplicate values', () => {
    const unique = new Set(uiIdValues);
    expect(unique.size).toBe(uiIdValues.length);
  });

  it('should only contain kebab-case values', () => {
    for (const value of uiIdValues) {
      expect(value).toMatch(
        /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
      );
    }
  });

  it('should only contain non-empty strings', () => {
    for (const value of uiIdValues) {
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// WINDOW_KEYS
// ---------------------------------------------------------------------------

describe('WINDOW_KEYS registry', () => {
  it('should have no duplicate values', () => {
    const unique = new Set(windowKeyValues);
    expect(unique.size).toBe(windowKeyValues.length);
  });

  it('should only contain non-empty strings', () => {
    for (const value of windowKeyValues) {
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-namespace uniqueness
// ---------------------------------------------------------------------------

describe('Cross-namespace uniqueness', () => {
  it('no UI_ID value should equal a WINDOW_KEYS value', () => {
    const uiSet = new Set(uiIdValues);
    for (const wk of windowKeyValues) {
      expect(uiSet.has(wk)).toBe(false);
    }
  });

  it('no UI_ID value should collide with a derived window-* id', () => {
    const uiSet = new Set(uiIdValues);
    for (const derived of derivedWindowIds) {
      expect(uiSet.has(derived)).toBe(false);
    }
  });

  it('all runtime DOM ids should be globally unique', () => {
    const unique = new Set(allRuntimeIds);
    expect(unique.size).toBe(allRuntimeIds.length);
  });
});

// ---------------------------------------------------------------------------
// windowId helper
// ---------------------------------------------------------------------------

describe('windowId()', () => {
  it('should prefix the storage key with "window-"', () => {
    for (const key of windowKeyValues) {
      // windowId expects a WindowKey type; cast for iteration
      expect(windowId(key as WindowKey)).toBe(`window-${key}`);
    }
  });
});
