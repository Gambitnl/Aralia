
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaService, resetDefaultClient } from '../ollama';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaService', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        // Reset cached model to ensure getModel calls fetch every time
        resetDefaultClient();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const mockParticipants = [
        { id: 'p1', name: 'Gimli', race: 'Dwarf', class: 'Fighter', sex: 'Male', age: 140, physicalDescription: 'Short', personality: 'Gruff' },
        { id: 'p2', name: 'Legolas', race: 'Elf', class: 'Ranger', sex: 'Male', age: 2931, physicalDescription: 'Tall', personality: 'Aloof' }
    ];

    const mockContext = {
        locationName: 'Moria'
    };

    it('should return TIMEOUT error specifically when the internal timer triggers an abort', async () => {
        // Mock getModel first
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ models: [{ name: 'llama3' }] })
        });

        // Mock generate call that hangs FOREVER unless aborted
        mockFetch.mockImplementationOnce((url, options) => {
            return new Promise((resolve, reject) => {
                // We don't settle the promise automatically.
                // We only reject if the signal is aborted.
                if (options?.signal) {
                    if (options.signal.aborted) {
                        reject(new DOMException('The operation was aborted', 'AbortError'));
                    } else {
                        options.signal.addEventListener('abort', () => {
                            reject(new DOMException('The operation was aborted', 'AbortError'));
                        });
                    }
                }
            });
        });

        // Start the service call
        const promise = OllamaService.generateBanter(mockParticipants, mockContext);

        // At this point, the service should have started a 30s timer.
        // We advance time by 30001ms to trigger it.
        await vi.advanceTimersByTimeAsync(30001);

        const result = await promise;

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('TIMEOUT');
        }
    });

    it('should return PARSE_ERROR when JSON parsing fails', async () => {
        // Mock getModel
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ models: [{ name: 'llama3' }] })
        });

        // Mock generate response with bad JSON
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ response: "This is not JSON at all." })
        });

        const result = await OllamaService.generateBanter(mockParticipants, mockContext);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('PARSE_ERROR');
            if (result.error.type === 'PARSE_ERROR') {
                expect(result.error.rawResponse).toContain('not JSON');
            }
        }
    });

    it('should return NETWORK_ERROR when fetch fails', async () => {
        // Mock getModel
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ models: [{ name: 'llama3' }] })
        });

        // Mock generate error (e.g. 500)
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        });

        const result = await OllamaService.generateBanter(mockParticipants, mockContext);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.type).toBe('NETWORK_ERROR');
            expect(result.error.message).toContain('Internal Server Error');
        }
    });

    it('should succeed with valid JSON', async () => {
        // Mock getModel
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ models: [{ name: 'llama3' }] })
        });

        const validBanter = {
            lines: [{ speakerId: 'p1', text: 'Hello', delay: 1000, emotion: 'neutral' }]
        };

        // Mock generate response
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ response: JSON.stringify(validBanter) })
        });

        const result = await OllamaService.generateBanter(mockParticipants, mockContext);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.lines).toHaveLength(1);
            expect(result.data.lines[0].text).toBe('Hello');
        }
    });

    // TODO: Add test case for 'isAvailable()' to verify it correctly handles the heartbeat check failures and success.
});
