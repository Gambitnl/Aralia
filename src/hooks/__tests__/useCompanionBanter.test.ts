import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompanionBanter } from '../useCompanionBanter';
import { GamePhase } from '../../types/core';
import { OllamaService } from '../../services/ollama';

// Mock OllamaService
vi.mock('../../services/ollama', () => ({
    OllamaService: {
        isAvailable: vi.fn(),
        generateBanterLine: vi.fn(),
        summarizeConversation: vi.fn()
    }
}));

// Mock Math.random to always pass the 10% check for most tests
const originalRandom = Math.random;
beforeEach(() => {
    Math.random = vi.fn().mockReturnValue(0);
    vi.mocked(OllamaService.isAvailable).mockResolvedValue(true);
});

afterEach(() => {
    Math.random = originalRandom;
});

describe('useCompanionBanter', () => {
    let mockDispatch: any;
    let baseGameState: any;

    beforeEach(() => {
        vi.setConfig({ testTimeout: 20000 });
        vi.useFakeTimers();
        mockDispatch = vi.fn();
        baseGameState = {
            phase: GamePhase.PLAYING,
            isDialogueInterfaceOpen: false,
            activeConversation: null,
            party: [{ id: 'kaelen_thorne' }, { id: 'elara_vance' }],
            companions: {
                'kaelen_thorne': {
                    id: 'kaelen_thorne',
                    identity: {
                        name: 'Kaelen', race: 'Tiefling', class: 'Rogue',
                        sex: 'Male', age: 28, physicalDescription: 'Lean'
                    },
                    personality: { values: ['Freedom'], quirks: ['Coin flip'] }
                },
                'elara_vance': {
                    id: 'elara_vance',
                    identity: {
                        name: 'Elara', race: 'Human', class: 'Cleric',
                        sex: 'Female', age: 32, physicalDescription: 'Tall'
                    },
                    personality: { values: ['Compassion'], quirks: ['Prayer'] }
                }
            },
            messages: [],
            discoveryLog: [],
            questLog: [],
            banterCooldowns: {},
            currentLocationId: 'test_loc',
            dynamicLocations: { 'test_loc': { name: 'Test Location' } },
            environment: { currentWeather: 'Clear' },
            gameTime: new Date().toISOString()
        };
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('should not check for banter if not in PLAYING phase', async () => {
        const gameState = { ...baseGameState, phase: GamePhase.LOAD_TRANSITION };
        renderHook(() => useCompanionBanter(gameState, mockDispatch));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        expect(OllamaService.generateBanterLine).not.toHaveBeenCalled();
    });

    it('should not check for banter if dialogue is open', async () => {
        const gameState = { ...baseGameState, isDialogueInterfaceOpen: true };
        renderHook(() => useCompanionBanter(gameState, mockDispatch));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        expect(OllamaService.generateBanterLine).not.toHaveBeenCalled();
    });

    it('should call OllamaService.generateBanterLine if conditions are met', async () => {
        vi.mocked(OllamaService.generateBanterLine).mockImplementation(async (participants, history, context, turn, onLog) => {
            if (onLog) {
                onLog('test-id', 'test prompt', 'test-model');
            }
            return {
                success: true,
                data: {
                    speakerId: 'kaelen_thorne',
                    text: 'Hello',
                    emotion: 'neutral',
                    isConcluding: false
                },
                metadata: {
                    id: 'test-id',
                    prompt: 'test prompt',
                    response: '{"speakerId":"kaelen_thorne","text":"Hello","emotion":"neutral"}',
                    model: 'test-model'
                }
            } as any;
        });

        renderHook(() => useCompanionBanter(baseGameState, mockDispatch));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        expect(OllamaService.generateBanterLine).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ADD_OLLAMA_LOG_ENTRY'
        }));
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ADD_MESSAGE'
        }));
    });

    it('should include deep persona data in OllamaService.generateBanterLine call', async () => {
        renderHook(() => useCompanionBanter(baseGameState, mockDispatch));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        const call = vi.mocked(OllamaService.generateBanterLine).mock.calls[0];
        const participants = call[0];

        expect(participants[0]).toMatchObject({
            sex: 'Male',
            age: 28,
            physicalDescription: 'Lean'
        });
    });

    it('should not check for banter if global cooldown is active', async () => {
        const state = {
            ...baseGameState,
            banterCooldowns: { 'GLOBAL': Date.now() }
        };
        renderHook(() => useCompanionBanter(state, mockDispatch));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        expect(OllamaService.generateBanterLine).not.toHaveBeenCalled();
    });

    it('should handle missing ollamaInteractionLog in state gracefully', async () => {
        // This simulates a stale state where the new field is missing
        const stateWithoutLog = { ...baseGameState };
        delete (stateWithoutLog as any).ollamaInteractionLog;

        vi.mocked(OllamaService.generateBanterLine).mockImplementation(async (participants, history, context, turn, onLog) => {
            if (onLog) {
                onLog('test-id', 'test prompt', 'test-model');
            }
            return {
                success: true,
                data: {
                    speakerId: 'kaelen_thorne',
                    text: 'Hello',
                    emotion: 'neutral',
                    isConcluding: false
                },
                metadata: { id: 'test-id', prompt: 'p', response: 'r', model: 'm' }
            } as any;
        });

        renderHook(() => useCompanionBanter(stateWithoutLog, mockDispatch));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10000);
        });

        // If it didn't crash, it passed the iterability check
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ADD_OLLAMA_LOG_ENTRY'
        }));


    });

    it('should summarize conversation and add memories when banter ends with sufficient history', async () => {
        vi.mocked(OllamaService.summarizeConversation).mockResolvedValue({
            success: true,
            data: { text: 'A great conversation about cheese.', tags: ['food', 'fun'], approvalChange: 0 },
            metadata: { prompt: 'p', response: 'r', model: 'm', id: 'id' }
        });

        // Mock generation to quickly build history
        vi.mocked(OllamaService.generateBanterLine).mockResolvedValue({
            success: true,
            data: { speakerId: 'kaelen_thorne', text: 'Talk 1', emotion: 'neutral', isConcluding: false },
            metadata: { prompt: 'p', response: 'r', model: 'm', id: 'id' }
        });

        const { result } = renderHook(() => useCompanionBanter(baseGameState, mockDispatch));

        // Start banter
        await act(async () => {
            await result.current.forceBanter();
        });

        // Simulate a few turns (advancing timers to trigger next lines)
        for (let i = 0; i < 3; i++) {
            await act(async () => {
                await vi.advanceTimersByTimeAsync(30000); // BANTER_DELAY_MS
            });
        }

        // End banter
        await act(async () => {
            result.current.endBanter();
        });

        // Wait for async promise chain (summarizeConversation is a promise that runs detached)
        // We need to wait a tick for the promise to resolve
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(OllamaService.summarizeConversation).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'ADD_COMPANION_MEMORY',
            payload: expect.objectContaining({
                memory: expect.objectContaining({
                    text: 'A great conversation about cheese.',
                    tags: ['food', 'fun']
                })
            })
        }));
    });
});
