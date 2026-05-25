import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPremadeManifest, clearManifestCache } from '../premadeCharacterService';

// We need to mock the global fetch function to intercept calls to manifest.json
const mockManifestData = {
  characters: [
    {
      filename: 'thalren_deeproot.json',
      name: 'Thalren Deeproot',
      race: 'Earth Genasi',
      className: 'Monk',
      level: 1,
      description: 'Test Description'
    },
    {
      filename: 'maelis_quill_lvl5.json',
      name: '[DEV] Maelis Quill (Lvl 5)',
      race: 'Human',
      className: 'Wizard',
      level: 5,
      description: '[Dev Fixture]',
      isTestFixture: true
    }
  ]
};

describe('premadeCharacterService', () => {
  beforeEach(() => {
    // Clear the internal module cache before each test
    clearManifestCache();

    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockManifestData)
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the manifest and successfully parses isTestFixture entries', async () => {
    const manifest = await loadPremadeManifest();

    expect(manifest.characters).toHaveLength(2);

    const normalChar = manifest.characters.find(c => c.filename === 'thalren_deeproot.json');
    expect(normalChar).toBeDefined();
    expect(normalChar?.level).toBe(1);
    expect(normalChar?.isTestFixture).toBeUndefined();

    const devChar = manifest.characters.find(c => c.filename === 'maelis_quill_lvl5.json');
    expect(devChar).toBeDefined();
    expect(devChar?.level).toBe(5);
    expect(devChar?.isTestFixture).toBe(true);
  });
});
