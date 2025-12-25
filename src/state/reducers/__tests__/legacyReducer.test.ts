
import { describe, it, expect, vi } from 'vitest';
import { legacyReducer } from '../legacyReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';

// Mock the services to prevent side effects in tests
vi.mock('../../../services/strongholdService', () => ({
    createStronghold: vi.fn((name, type, locationId) => ({
        id: 'str_mock_id',
        name,
        type,
        locationId,
        level: 1,
        resources: { gold: 1000, supplies: 100, influence: 0, intel: 0 },
        staff: [],
        upgrades: [],
        constructionQueue: [],
        threats: [],
        missions: []
    })),
    purchaseUpgrade: vi.fn((stronghold, upgradeId) => ({
        ...stronghold,
        upgrades: [...stronghold.upgrades, upgradeId],
        resources: { ...stronghold.resources, gold: stronghold.resources.gold - 100 }
    })),
    recruitStaff: vi.fn((stronghold, name, role) => ({
        ...stronghold,
        staff: [...stronghold.staff, { id: 'staff_1', name, role }]
    })),
    startMission: vi.fn((stronghold, staffId, type) => ({
        ...stronghold,
        missions: [...stronghold.missions, { id: 'mission_1', type, staffId }]
    }))
}));

describe('legacyReducer - Stronghold Logic', () => {
    const initialState: Partial<GameState> = {
        strongholds: {},
        legacy: undefined,
        strongholdModal: { isOpen: false, activeStrongholdId: null }
    };

    it('should found a stronghold', () => {
        const action: AppAction = {
            type: 'FOUND_STRONGHOLD',
            payload: { name: 'Test Castle', type: 'castle', locationId: 'loc_1' }
        };

        const newState = legacyReducer(initialState as GameState, action);

        expect(newState.strongholds?.['str_mock_id']).toBeDefined();
        expect(newState.strongholds?.['str_mock_id'].name).toBe('Test Castle');
        expect(newState.legacy).toBeDefined();
        expect(newState.legacy?.strongholdIds).toContain('str_mock_id');
    });

    it('should open and close stronghold modal', () => {
        const actionOpen: AppAction = { type: 'OPEN_STRONGHOLD_MODAL', payload: { strongholdId: 'str_1' } };
        const stateAfterOpen = legacyReducer(initialState as GameState, actionOpen);
        expect(stateAfterOpen.strongholdModal).toEqual({ isOpen: true, activeStrongholdId: 'str_1' });

        const actionClose: AppAction = { type: 'CLOSE_STRONGHOLD_MODAL' };
        const stateAfterClose = legacyReducer(stateAfterOpen as GameState, actionClose);
        expect(stateAfterClose.strongholdModal).toEqual({ isOpen: false, activeStrongholdId: null });
    });

    it('should upgrade stronghold', () => {
        const stateWithStronghold: Partial<GameState> = {
            strongholds: {
                'str_1': {
                    id: 'str_1',
                    name: 'Castle',
                    type: 'castle',
                    locationId: 'loc_1',
                    level: 1,
                    resources: { gold: 1000, supplies: 100, influence: 0, intel: 0 },
                    staff: [],
                    upgrades: [],
                    constructionQueue: [],
                    threats: [],
                    missions: [],
                    dailyIncome: 10,
                    description: '',
                    taxRate: 0
                }
            }
        };

        const action: AppAction = { type: 'UPGRADE_STRONGHOLD', payload: { strongholdId: 'str_1', upgradeId: 'test_upgrade' } };
        const newState = legacyReducer(stateWithStronghold as GameState, action);

        expect(newState.strongholds?.['str_1'].upgrades).toContain('test_upgrade');
    });

    it('should hire staff', () => {
        const stateWithStronghold: Partial<GameState> = {
            strongholds: {
                'str_1': {
                    id: 'str_1',
                    name: 'Castle',
                    type: 'castle',
                    locationId: 'loc_1',
                    level: 1,
                    resources: { gold: 1000, supplies: 100, influence: 0, intel: 0 },
                    staff: [],
                    upgrades: [],
                    constructionQueue: [],
                    threats: [],
                    missions: [],
                    dailyIncome: 10,
                    description: '',
                    taxRate: 0
                }
            }
        };

        const action: AppAction = { type: 'HIRE_STRONGHOLD_STAFF', payload: { strongholdId: 'str_1', name: 'John', role: 'guard' } };
        const newState = legacyReducer(stateWithStronghold as GameState, action);

        expect(newState.strongholds?.['str_1'].staff).toHaveLength(1);
        expect(newState.strongholds?.['str_1'].staff[0].name).toBe('John');
    });
});
