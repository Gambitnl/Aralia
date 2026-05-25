
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPremadeManifest, loadPremadeCharacter, clearManifestCache } from '../premadeCharacterService';
import fs from 'fs';
import path from 'path';

describe('premadeCharacterService with real manifest', () => {
    beforeEach(() => {
        clearManifestCache();
        // Mock fetch to actually read the file system, simulating the Vite serve behavior.
        global.fetch = vi.fn().mockImplementation(async (url) => {
            const parsedUrl = new URL(url, 'http://localhost');
            // Assuming PREMADE_DIR routes to public/premade-characters
            const filepath = path.join(process.cwd(), 'public', parsedUrl.pathname);
            try {
                const content = fs.readFileSync(filepath, 'utf8');
                return {
                    ok: true,
                    json: async () => JSON.parse(content)
                };
            } catch (e) {
                return {
                    ok: false,
                    status: 404
                };
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should prove manifest discoverability against the real public/premade-characters/manifest.json', async () => {
        // Load with test fixtures explicitly
        const fullManifest = await loadPremadeManifest(true);
        expect(fullManifest.characters.length).toBeGreaterThan(0);

        // Find our dev fixtures
        const testFixtures = fullManifest.characters.filter(c => c.isTestFixture);
        expect(testFixtures.length).toBeGreaterThanOrEqual(2);

        const wizardFixture = testFixtures.find(c => c.filename === 'dev_maelis_quill_lvl5.json');
        expect(wizardFixture).toBeDefined();
        expect(wizardFixture?.level).toBe(5);
        expect(wizardFixture?.className).toBe('Wizard');

        // Verify normal UI load filters them out
        clearManifestCache();
        const normalManifest = await loadPremadeManifest();
        const normalTestFixtures = normalManifest.characters.filter(c => c.isTestFixture);
        expect(normalTestFixtures.length).toBe(0);

        // Ensure normal 13 starting characters are preserved
        expect(normalManifest.characters.length).toBeGreaterThanOrEqual(13);
    });

    it('should use cache appropriately depending on the includeTestFixtures flag', async () => {
        const manifestWithFixtures = await loadPremadeManifest(true);
        const countWithFixtures = manifestWithFixtures.characters.length;
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const manifestWithoutFixtures = await loadPremadeManifest();
        expect(manifestWithoutFixtures.characters.length).toBeLessThan(countWithFixtures);
        expect(global.fetch).toHaveBeenCalledTimes(1); // cached

        const manifestWithFixturesAgain = await loadPremadeManifest(true);
        expect(manifestWithFixturesAgain.characters.length).toBe(countWithFixtures);
        expect(global.fetch).toHaveBeenCalledTimes(1); // cached
    });

    it('loadPremadeCharacter should return the loaded character data from the file system', async () => {
        const character = await loadPremadeCharacter('maelis_quill.json');
        expect(character).toBeDefined();
        expect(character?.name).toBe('Maelis Quill');
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('maelis_quill.json'));
    });
});
