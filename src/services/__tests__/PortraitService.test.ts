
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePortraitUrl } from '../PortraitService';

type FetchMock = ReturnType<typeof vi.fn>;

// Mock the global fetch
global.fetch = vi.fn() as unknown as typeof fetch;


describe('PortraitService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generatePortraitUrl should return url from dev portrait API', async () => {
        const fetchMock = global.fetch as unknown as FetchMock;
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ url: 'assets/images/portraits/generated/portrait.png' })
        });

        const url = await generatePortraitUrl({
            description: 'Test prompt',
            race: 'Elf',
            className: 'Wizard'
        });
        expect(url).toBe('assets/images/portraits/generated/portrait.png');
    });

    it('generatePortraitUrl should throw server error message when request fails', async () => {
        const fetchMock = global.fetch as unknown as FetchMock;
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Image generation is not authenticated.' })
        });

        await expect(generatePortraitUrl({
            description: 'Test prompt',
            race: 'Elf',
            className: 'Wizard'
        })).rejects.toThrow('Image generation is not authenticated.');
    });
});
