/**
 * This file proves that the live spell-loading surfaces can read the current
 * public spell corpus.
 *
 * The player-facing SpellProvider loads the bundled spell table for screens
 * that need many spells at once, while SpellService loads the manifest and
 * individual spell JSON for detail lookups. These tests keep both paths tied to
 * the real generated public data without requiring a browser dev server.
 */
import React, { useContext } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpellContext, { SpellProvider } from '../SpellContext';
import { spellService } from '../../services/SpellService';
import spellBundle from '../../../public/data/spells_bundle.json';
import spellManifest from '../../../public/data/spells_manifest.json';
import lightSpell from '../../../public/data/spells/level-0/light.json';

// ============================================================================
// Runtime Asset Mocks
// ============================================================================
// The app normally fetches these files from /public through Vite. The test
// keeps the same URLs and payloads, but answers them directly from the checked-in
// corpus so failures point at the loader contract instead of a test server.
// ============================================================================

const mockFetchWithTimeout = vi.fn();

vi.mock('../../utils/networkUtils', () => ({
  fetchWithTimeout: (url: string, options?: unknown) => mockFetchWithTimeout(url, options),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const spellBundleRecord = spellBundle as Record<string, unknown>;
const spellManifestRecord = spellManifest as Record<string, { path: string }>;

const SpellCountProbe = () => {
  const spells = useContext(SpellContext);

  // Show the loaded count and one known spell so the assertion proves the
  // provider delivered the corpus through React context, not just through the
  // mocked network helper.
  if (!spells) {
    return <div data-testid="spell-load-state">loading</div>;
  }

  return (
    <div>
      <div data-testid="spell-count">{Object.keys(spells).length}</div>
      <div data-testid="light-name">{spells.light?.name ?? 'missing-light'}</div>
    </div>
  );
};

describe('runtime spell loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the public spell bundle through SpellProvider', async () => {
    mockFetchWithTimeout.mockImplementation(async (url: string) => {
      if (url.endsWith('/data/spells_bundle.json')) {
        return spellBundleRecord;
      }

      throw new Error(`Unexpected spell provider fetch: ${url}`);
    });

    render(
      <SpellProvider>
        <SpellCountProbe />
      </SpellProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('spell-count')).toHaveTextContent(String(Object.keys(spellBundleRecord).length));
    });

    expect(screen.getByTestId('light-name')).toHaveTextContent('Light');
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/data/spells_bundle.json',
      expect.objectContaining({ timeoutMs: 15000 })
    );
  });

  it('resolves manifest entries and spell details through SpellService', async () => {
    mockFetchWithTimeout.mockImplementation(async (url: string) => {
      if (url.endsWith('/data/spells_manifest.json')) {
        return spellManifestRecord;
      }

      if (url.endsWith(spellManifestRecord.light.path)) {
        return lightSpell;
      }

      throw new Error(`Unexpected spell service fetch: ${url}`);
    });

    const manifest = await spellService.getAllSpellInfo();
    const spell = await spellService.getSpellDetails('light');

    expect(manifest).not.toBeNull();
    expect(Object.keys(manifest ?? {})).toHaveLength(Object.keys(spellManifestRecord).length);
    expect(manifest?.light.path).toBe('/data/spells/level-0/light.json');
    expect(spell?.name).toBe('Light');
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/data/spells_manifest.json',
      expect.objectContaining({ timeoutMs: 15000 })
    );
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      '/data/spells/level-0/light.json',
      expect.objectContaining({ timeoutMs: 10000 })
    );
  });
});
