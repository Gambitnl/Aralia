
import { describe, it, expect } from 'vitest';
import { companionReducer } from '../../../state/reducers/companionReducer';
import { GameState, GamePhase } from '../../../types';
import { COMPANIONS } from '../../../constants';
import { AppAction } from '../../../state/actionTypes';
import { createMockGameState } from '../../../utils/core/factories';

describe('CompanionSystem', () => {
    // Create a minimal mock state
    const mockState: GameState = createMockGameState({
        phase: GamePhase.PLAYING,
        companions: COMPANIONS,
        messages: [],
        notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [], bounties: [] },
    });

    it('should add a reaction message with metadata when ADD_COMPANION_REACTION is dispatched', () => {
        const companionId = Object.keys(COMPANIONS)[0];
        const reaction = "I have a bad feeling about this.";

        const action: AppAction = {
            type: 'ADD_COMPANION_REACTION',
            payload: {
                companionId,
                reaction
            }
        };

        const newState = companionReducer(mockState, action);

        expect(newState.messages).toHaveLength(1);
        const message = newState.messages![0];

        expect(message.sender).toBe('npc');
        expect(message.text).toContain(reaction);
        expect(message.metadata).toBeDefined();
        expect(message.metadata?.companionId).toBe(companionId);
        expect(message.metadata?.reactionType).toBe('comment');
    });

    it('should update approval correctly', () => {
        const companionId = Object.keys(COMPANIONS)[0];
        const initialApproval = mockState.companions[companionId].relationships['player'].approval;

        const action: AppAction = {
            type: 'UPDATE_COMPANION_APPROVAL',
            payload: {
                companionId,
                change: 10,
                reason: 'Test Reason'
            }
        };

        const newState = companionReducer(mockState, action);
        const updatedCompanion = newState.companions![companionId];

        expect(updatedCompanion.relationships['player'].approval).toBe(initialApproval + 10);
        expect(updatedCompanion.approvalHistory).toHaveLength(1);
        expect(updatedCompanion.approvalHistory[0].reason).toBe('Test Reason');
    });
});
