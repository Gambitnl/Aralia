/* eslint-disable @typescript-eslint/naming-convention */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaService, resetDefaultClient } from '../ollama';
import { BanterContext } from '../../types/ollama';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetDefaultClient();
        // Mock getModel to return a valid model
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ models: [{ name: 'gpt-oss:20b' }] })
        });
    });

    it('generateBanterLine uses /chat endpoint correctly', async () => {
        const mockParticipants = [
            { id: 'p1', name: 'Char1', race: 'Elf', class: 'Rogue', sex: 'F', age: 100, physicalDescription: 'Tall', personality: 'Witty' },
            { id: 'p2', name: 'Char2', race: 'Human', class: 'Fighter', sex: 'M', age: 30, physicalDescription: 'Strong', personality: 'Stoic' }
        ];
        const mockContext: BanterContext = { locationName: 'Forest', timeOfDay: 'Night', weather: 'Rain' };

        // Mock the chat response
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                message: {
                    content: JSON.stringify({
                        speakerId: 'p2',
                        text: 'Hello there.',
                        emotion: 'neutral'
                    })
                }
            })
        });

        const result = await OllamaService.generateBanterLine(mockParticipants, [], mockContext, 1);

        expect(mockFetch).toHaveBeenCalledTimes(2); // 1 for getModel, 1 for chat
        const chatCall = mockFetch.mock.calls[1];
        expect(chatCall[0]).toContain('/chat');
        const body = JSON.parse(chatCall[1].body);
        expect(body.messages).toBeDefined();
        expect(body.format).toBe('json');

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.text).toBe('Hello there.');
        }
    });
});
