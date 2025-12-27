
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollForPortrait } from '../PortraitService';

// Mock the global fetch
global.fetch = vi.fn();

describe('PortraitService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pollForPortrait should return url when agent responds with valid json', async () => {
        const mockResponse = [
            { agent: 'Gemini', message: '#portrait_ready { "name": "Hero", "url": "http://example.com/img.png" }' }
        ];

        (global.fetch as any).mockResolvedValue({
            json: async () => mockResponse
        });

        const url = await pollForPortrait('Hero');
        expect(url).toBe('http://example.com/img.png');
    });

    it('pollForPortrait should return null on malformed json (prevent crash)', async () => {
        const mockResponse = [
            { agent: 'Gemini', message: '#portrait_ready { "name": "Hero", "url": "http:// ... BROKEN JSON ... ' }
        ];

        (global.fetch as any).mockResolvedValue({
            json: async () => mockResponse
        });

        const url = await pollForPortrait('Hero');
        expect(url).toBeNull();
    });
});
