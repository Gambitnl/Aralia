
import { companionReducer } from '../companionReducer';
import { GameState } from '../../../types';
import { BanterMoment } from '../../../types/companions';

describe('companionReducer', () => {
    const mockInitialState: GameState = {
        companions: {},
        messages: [],
        archivedBanters: []
    } as unknown as GameState;

    it('should handle ARCHIVE_BANTER', () => {
        const moment: BanterMoment = {
            id: 'test-moment',
            timestamp: 1234567890,
            locationId: 'tavern',
            participants: ['comp1', 'comp2'],
            lines: [{ speakerId: 'comp1', text: 'Hello' }]
        };

        const action = {
            type: 'ARCHIVE_BANTER',
            payload: moment
        } as any;

        const newState = companionReducer(mockInitialState, action);

        expect(newState.archivedBanters).toHaveLength(1);
        expect(newState.archivedBanters?.[0]).toEqual(moment);
    });

    it('should prepend new banters to archive', () => {
        const moment1: BanterMoment = {
            id: 'm1',
            timestamp: 100,
            locationId: 'loc1',
            participants: [],
            lines: []
        };

        const stateWithOne = {
            ...mockInitialState,
            archivedBanters: [moment1]
        };

        const moment2: BanterMoment = {
            id: 'm2',
            timestamp: 200,
            locationId: 'loc2',
            participants: [],
            lines: []
        };

        const action = {
            type: 'ARCHIVE_BANTER',
            payload: moment2
        } as any;

        const newState = companionReducer(stateWithOne, action);

        expect(newState.archivedBanters).toHaveLength(2);
        expect(newState.archivedBanters?.[0].id).toBe('m2');
        expect(newState.archivedBanters?.[1].id).toBe('m1');
    });

    it('stamps companion-reaction log messages with in-game time, not the real clock', () => {
        // Direct-push log messages (those that build the messages array inside a
        // reducer rather than dispatching ADD_MESSAGE) must also reflect the
        // in-game clock so the adventure Log stays consistent with the HUD.
        const inGameTime = new Date(Date.UTC(351, 0, 1, 7, 0, 0)); // 1 Deepwinter 351, 07:00
        const state = {
            ...mockInitialState,
            gameTime: inGameTime,
            companions: { c1: { id: 'c1', identity: { name: 'Veldrin' } } },
        } as unknown as GameState;

        const action = {
            type: 'ADD_COMPANION_REACTION',
            payload: { companionId: 'c1', reaction: 'Well met.' },
        } as any;

        const newState = companionReducer(state, action);
        const msg = newState.messages?.[newState.messages.length - 1];
        expect(new Date(msg!.timestamp).getTime()).toBe(inGameTime.getTime());
        expect(new Date(msg!.timestamp).getTime()).not.toBe(Date.now());
    });
});
