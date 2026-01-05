
import { describe, it, expect } from 'vitest';
import { npcReducer } from '../npcReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';

describe('npcReducer', () => {
    const initialState: Partial<GameState> = {
        // TODO(2026-01-03 pass 4 Codex-CLI): Casted npcMemory stub to satisfy NpcMemory shape until interaction history is fully typed.
        npcMemory: {
            'npc-1': {
                interactions: [],
                knownFacts: [],
                attitude: 0,
                disposition: 0,
                suspicion: 0,
                goals: [],
                lastInteractionTimestamp: 0,
                lastInteractionDate: 0,
                discussedTopics: {}
            }
        } as unknown as GameState['npcMemory'],
        activeDialogueSession: {
            npcId: 'npc-1',
            availableTopicIds: [],
            discussedTopicIds: [],
            sessionDispositionMod: 0
        }
    };

    it('should handle DISCUSS_TOPIC by updating both session and memory', () => {
        const action: AppAction = {
            type: 'DISCUSS_TOPIC',
            payload: {
                topicId: 'topic-1',
                npcId: 'npc-1',
                date: 12345
            }
        };

        const newState = npcReducer(initialState as GameState, action);

        // Check Session Update
        expect(newState.activeDialogueSession).toBeDefined();
        expect(newState.activeDialogueSession?.discussedTopicIds).toContain('topic-1');

        // Check Memory Update
        expect(newState.npcMemory).toBeDefined();
        const memory = (newState.npcMemory || {})['npc-1'] as GameState['npcMemory'][string];
        expect(memory?.discussedTopics?.['topic-1']).toBe(12345);
    });

    it('should not duplicate topic in session but update date in memory', () => {
        const stateWithTopic: Partial<GameState> = {
            ...initialState,
            activeDialogueSession: {
                npcId: 'npc-1',
                availableTopicIds: [],
                discussedTopicIds: ['topic-1'],
                sessionDispositionMod: 0
            },
            npcMemory: {
                'npc-1': {
                    ...initialState.npcMemory!['npc-1'],
                    discussedTopics: {
                        'topic-1': 10000
                    }
                }
            }
        };

        const action: AppAction = {
            type: 'DISCUSS_TOPIC',
            payload: {
                topicId: 'topic-1',
                npcId: 'npc-1',
                date: 12345 // Newer date
            }
        };

        const newState = npcReducer(stateWithTopic as GameState, action);

        // Session should remain same length (no duplicates)
        expect(newState.activeDialogueSession?.discussedTopicIds.length).toBe(1);
        expect(newState.activeDialogueSession?.discussedTopicIds).toContain('topic-1');

        // Memory should update timestamp
        const memory = (newState.npcMemory || {})['npc-1'] as GameState['npcMemory'][string];
        expect(memory?.discussedTopics?.['topic-1']).toBe(12345);
    });

    it('should handle DISCUSS_TOPIC even if active session is null (e.g. background check)', () => {
        const stateNoSession: Partial<GameState> = {
            ...initialState,
            activeDialogueSession: null
        };

        const action: AppAction = {
            type: 'DISCUSS_TOPIC',
            payload: {
                topicId: 'topic-1',
                npcId: 'npc-1',
                date: 12345
            }
        };

        const newState = npcReducer(stateNoSession as GameState, action);

        // Memory should still update
        const memory = (newState.npcMemory || {})['npc-1'] as GameState['npcMemory'][string];
        expect(memory?.discussedTopics?.['topic-1']).toBe(12345);
        // Session should remain null
        expect(newState.activeDialogueSession).toBeNull();
    });
});
