
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
});
