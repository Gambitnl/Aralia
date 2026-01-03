
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollForPortrait } from '../PortraitService';

type FetchMock = ReturnType<typeof vi.fn>;

// Mock the global fetch
global.fetch = vi.fn() as unknown as typeof fetch;

describe('PortraitService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pollForPortrait should return url when agent responds with valid json', async () => {
        const mockResponse = [
            { agent: 'Gemini', message: '#portrait_ready { "name": "Hero", "url": "http://example.com/img.png" }' }
        ];
        const fetchMock = global.fetch as unknown as FetchMock;
        // TODO(2026-01-03 Codex-CLI): Replace loose fetch mock with typed helper once PortraitService stabilizes.
        fetchMock.mockResolvedValue({
            json: async () => mockResponse
        });

        const url = await pollForPortrait('Hero');
        expect(url).toBe('http://example.com/img.png');
    });

    it('pollForPortrait should return null on malformed json (prevent crash)', async () => {
        const mockResponse = [
            { agent: 'Gemini', message: '#portrait_ready { "name": "Hero", "url": "http:// ... BROKEN JSON ... ' }
        ];
        const fetchMock = global.fetch as unknown as FetchMock;
        // TODO(2026-01-03 Codex-CLI): Replace loose fetch mock with typed helper once PortraitService stabilizes.
        fetchMock.mockResolvedValue({
            json: async () => mockResponse
        });

        const url = await pollForPortrait('Hero');
        expect(url).toBeNull();
    });
});
