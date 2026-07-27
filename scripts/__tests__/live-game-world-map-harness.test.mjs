/**
 * This file pins the live-game world-map command's bootstrap and rejection rules.
 *
 * The tests do not launch Vite or Chromium. They verify that the public command
 * defaults to the controlled seed and headed proof mode, requests the existing
 * dummy PLAYING route, accepts only a populated AtlasSvgView inside the real
 * MapPane chain, and fails closed when that route is missing. Rendered behavior
 * is still proved by the command's ignored headed artifacts.
 */

// ============================================================================
// Test dependencies and canonical evidence fixture
// ============================================================================
// Vitest supplies assertions. The imported helpers are the same functions the
// local command uses before it writes a successful proof receipt.
// ============================================================================

import { describe, expect, it } from 'vitest';

import {
  makeBeforeLimitationReceipt,
  makePlayingRouteUrl,
  parseHarnessArgs,
  validatePlayingMapEvidence,
} from '../world-map/live-game-harness.mjs';

const REQUIRED_SELECTORS = {
  '[data-testid="window-world-map-window"]': true,
  '[data-testid="worldforge-map-viewport"]': true,
  '[data-testid="atlas-svg-view"]': true,
};

function validEvidence(overrides = {}) {
  return {
    phase: 'PLAYING',
    partySize: 3,
    worldSeed: 1337,
    isMapVisible: true,
    selectors: REQUIRED_SELECTORS,
    renderer: { tagName: 'svg', pathCount: 4709, canvasCountWithinViewport: 0 },
    ancestry: { viewportInsideWindow: true, rendererInsideViewport: true },
    preference: {
      key: 'aralia.atlas.layerPrefs.v1:1337',
      value: { mapMode: 'states' },
      statesControlChecked: true,
    },
    ...overrides,
  };
}

// ============================================================================
// Command and bootstrap contract
// ============================================================================
// These checks protect the exact one-command defaults and ensure the browser
// starts from Aralia's existing dev-only dummy path rather than a preview page.
// ============================================================================

describe('live-game world-map harness command', () => {
  it('defaults to headed seed-1337 proof with a bounded timeout', () => {
    expect(parseHarnessArgs([])).toEqual({
      baseUrl: 'http://127.0.0.1:3000/Aralia/',
      headed: true,
      seed: 1337,
      timeoutMs: 90_000,
    });
  });

  it('builds the existing dummy bootstrap route without replacing the Aralia base path', () => {
    const route = new URL(makePlayingRouteUrl('http://127.0.0.1:3000/Aralia/'));
    expect(route.pathname).toBe('/Aralia/');
    expect(route.searchParams.get('dummy')).toBe('1');
    expect(route.searchParams.get('live_map_harness')).toBe('1');
  });

  it('keeps the before limitation receipt self-contained in tracked source', () => {
    expect(makeBeforeLimitationReceipt()).toMatchObject({
      source: 'scripts/world-map/live-game-harness.mjs',
      recordedAt: '2026-07-18',
    });
    expect(makeBeforeLimitationReceipt().limitation).toMatch(/PLAYING MapPane/);
  });

  it('rejects random, missing, or misspelled command inputs', () => {
    expect(() => parseHarnessArgs(['--seed', '0'])).toThrow('positive integer');
    expect(() => parseHarnessArgs(['--unknown'])).toThrow('Unknown');
  });
});

// ============================================================================
// Fail-closed live route evidence
// ============================================================================
// A visually similar preview, a dummy shell, or a blank SVG must fail. This is
// the automated counterpart to the headed proof of the real PLAYING MapPane.
// ============================================================================

describe('live-game world-map route evidence', () => {
  it('accepts the populated AtlasSvgView inside the live PLAYING MapPane chain', () => {
    expect(validatePlayingMapEvidence(validEvidence(), 1337)).toEqual(validEvidence());
  });

  it.each([
    ['wrong phase', { phase: 'MAIN_MENU' }, 'not PLAYING'],
    ['no live party', { partySize: 0 }, 'playable party'],
    ['wrong controlled seed', { worldSeed: 42 }, 'controlled seed 1337'],
    ['closed modal', { isMapVisible: false }, 'World Map modal was not open'],
    ['canvas substitute', { renderer: { tagName: 'canvas', pathCount: 4709 } }, 'AtlasSvgView'],
    ['empty SVG shell', { renderer: { tagName: 'svg', pathCount: 0 } }, 'canonical atlas paths'],
    [
      'parallel canvas renderer',
      { renderer: { tagName: 'svg', pathCount: 4709, canvasCountWithinViewport: 1 } },
      'still contains a canvas renderer',
    ],
    [
      'disconnected selector ancestry',
      { ancestry: { viewportInsideWindow: true, rendererInsideViewport: false } },
      'not nested',
    ],
    [
      'inactive preferences',
      { preference: { key: 'aralia.atlas.layerPrefs.v1:1337', value: { mapMode: 'biomes' }, statesControlChecked: false } },
      'States layer preference',
    ],
    [
      'unreachable MapPane route',
      { selectors: { ...REQUIRED_SELECTORS, '[data-testid="window-world-map-window"]': false } },
      'selector was unreachable',
    ],
  ])('fails closed for %s', (_label, override, expectedMessage) => {
    expect(() => validatePlayingMapEvidence(validEvidence(override), 1337)).toThrow(expectedMessage);
  });
});
