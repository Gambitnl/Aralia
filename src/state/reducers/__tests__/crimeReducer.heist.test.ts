
import { describe, it, expect } from 'vitest';
import { crimeReducer } from '../crimeReducer';
import { GameState } from '../../../types';
import { createMockGameState } from '../../../utils/factories';
import { HeistPhase } from '../../../types/crime';
import { AppAction } from '../../actionTypes';

describe('crimeReducer - Heist Logic', () => {
    let initialState: GameState;

    beforeEach(() => {
        initialState = createMockGameState();
    });

    it('should start planning a heist', () => {
        const action: AppAction = {
            type: 'START_HEIST_PLANNING',
            payload: {
                targetLocationId: 'bank_vault',
                leaderId: 'player_1',
                guildJobId: 'job_123'
            }
        } as const;

        const newState = crimeReducer(initialState, action);

        expect(newState.activeHeist).toBeDefined();
        expect(newState.activeHeist?.targetLocationId).toBe('bank_vault');
        expect(newState.activeHeist?.phase).toBe(HeistPhase.Recon);
        expect(newState.activeHeist?.guildJobId).toBe('job_123');
        expect(newState.messages).toHaveLength(initialState.messages.length + 1);
    });

    it('should add intel to the heist', () => {
        // Setup initial heist state
        const stateWithHeist = crimeReducer(initialState, {
            type: 'START_HEIST_PLANNING',
            payload: { targetLocationId: 'loc_1', leaderId: 'p1' }
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as AppAction);

        const intel = {
            id: 'intel_1',
            locationId: 'loc_1',
            type: 'GuardPatrol' as const,
            description: 'Guards change shifts at noon',
            accuracy: 1
        };

        const action: AppAction = {
            type: 'ADD_HEIST_INTEL',
            payload: { intel }
        };

        // Cast to any because the previous reducer call returns Partial<GameState>
        const newState = crimeReducer({ ...initialState, ...stateWithHeist } as GameState, action);

        expect(newState.activeHeist?.collectedIntel).toHaveLength(1);
        expect(newState.activeHeist?.collectedIntel[0]).toEqual(intel);
    });

    it('should advance heist phase', () => {
        // Setup
        let currentState = { ...initialState } as GameState;
        currentState = { ...currentState, ...crimeReducer(currentState, {
            type: 'START_HEIST_PLANNING',
            payload: { targetLocationId: 'loc_1', leaderId: 'p1' }
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as AppAction) };

        expect(currentState.activeHeist?.phase).toBe(HeistPhase.Recon);

        // Advance
        const newState = crimeReducer(currentState, { type: 'ADVANCE_HEIST_PHASE' } as AppAction);

        expect(newState.activeHeist?.phase).toBe(HeistPhase.Planning);
    });

    it('should perform heist action and update alert level', () => {
        // Setup
        let currentState = { ...initialState } as GameState;
        currentState = { ...currentState, ...crimeReducer(currentState, {
            type: 'START_HEIST_PLANNING',
            payload: { targetLocationId: 'loc_1', leaderId: 'p1' }
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as AppAction) };

        // Pass success/failure explicitly in payload
        const action: AppAction = {
            type: 'PERFORM_HEIST_ACTION',
            payload: {
                actionDifficulty: 10,
                description: 'Pick lock',
                success: false,
                alertChange: 15
            }
        };

        const newState = crimeReducer(currentState, action);

        expect(newState.activeHeist?.turnsElapsed).toBe(1);
        expect(newState.activeHeist?.alertLevel).toBe(30); // 15 * 2 (failure penalty)
        expect(newState.messages?.[newState.messages.length - 1].text).toContain('Failed');
    });

    it('should abort heist', () => {
        // Setup
        let currentState = { ...initialState } as GameState;
        currentState = { ...currentState, ...crimeReducer(currentState, {
            type: 'START_HEIST_PLANNING',
            payload: { targetLocationId: 'loc_1', leaderId: 'p1' }
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as AppAction) };

        expect(currentState.activeHeist).toBeDefined();

        const newState = crimeReducer(currentState, { type: 'ABORT_HEIST' } as AppAction);

        expect(newState.activeHeist).toBeNull();
        expect(newState.messages?.[newState.messages.length - 1].text).toBe('Heist aborted.');
    });
});
