import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSpellGateChecks } from '../useSpellGateChecks';
import { GlossaryEntry } from '../../types';

// Mock fetch globally
const globalFetch = vi.fn();
vi.stubGlobal('fetch', globalFetch);

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    BASE_URL: '/',
  },
});

describe('useSpellGateChecks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle manifest fetch failure gracefully', async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    const entries: GlossaryEntry[] = [];
    const { result } = renderHook(() => useSpellGateChecks(entries));

    // Wait for the effect to run
    await waitFor(() => {
      expect(globalFetch).toHaveBeenCalled();
    });

    expect(result.current).toEqual({});
    expect(globalFetch).toHaveBeenCalledWith('/data/spells_manifest.json', expect.anything());
  });

  it('should process manifest and glossary data correctly', async () => {
    // Mock manifest response
    globalFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        'fireball': {
          level: 3,
          path: '/spells/level-3/fireball.md',
        },
      }),
    });

    const entries: GlossaryEntry[] = [
        {
            id: 'fireball',
            title: 'Fireball',
            tags: ['level 3', 'evocation'],
            body: 'Boom',
            relatedIds: []
        }
    ];

    const { result } = renderHook(() => useSpellGateChecks(entries));

    await waitFor(() => {
      expect(result.current['fireball']).toBeDefined();
    });

    expect(result.current['fireball'].status).toBe('pass');
    expect(result.current['fireball'].level).toBe(3);
    expect(result.current['fireball'].checklist.manifestPathOk).toBe(true);
    expect(result.current['fireball'].checklist.glossaryExists).toBe(true);
    expect(result.current['fireball'].checklist.levelTagOk).toBe(true);
  });

  it('should fetch glossary card if not provided in entries', async () => {
      // Mock implementation to handle different URLs
      globalFetch.mockImplementation(async (url) => {
          if (typeof url === 'string' && url.endsWith('spells_manifest.json')) {
              return {
                  ok: true,
                  json: async () => ({
                      'ice-knife': {
                          level: 1,
                          path: '/spells/level-1/ice-knife.md',
                      },
                  }),
              };
          }
          if (typeof url === 'string' && url.endsWith('ice-knife.md')) {
              return {
                  ok: true,
                  text: async () => `---
id: ice-knife
tags: [level 1, conjuration]
---
# Ice Knife
`,
              };
          }
          return { ok: false, statusText: 'Not Found' };
      });

      // Pass in [] to signify initialized entries but empty, so the effect runs
      const entries: GlossaryEntry[] = [];
      const { result } = renderHook(() => useSpellGateChecks(entries));

      await waitFor(() => {
        expect(result.current['ice-knife']).toBeDefined();
      }, { timeout: 2000 });

      expect(globalFetch).toHaveBeenCalledTimes(2);
      expect(globalFetch).toHaveBeenCalledWith('/data/spells_manifest.json', expect.anything());
      expect(globalFetch).toHaveBeenCalledWith('/data/glossary/entries/spells/ice-knife.md', expect.anything());

      expect(result.current['ice-knife'].status).toBe('pass');
  });
});
