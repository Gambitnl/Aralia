import { describe, it, expect, vi, afterEach } from 'vitest';
import { legacyReducer } from '../legacyReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { Stronghold } from '../../../types/stronghold';
import { PlayerLegacy } from '../../../types/legacy';
import { createStronghold, recruitStaff, startMission } from '../../../services/strongholdService';
import { initializeLegacy } from '../../../services/legacyService';
import { createMockPlayerCharacter } from '../../../utils/factories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal GameState for reducer tests.
 * Uses `as unknown as GameState` following the project convention in characterReducer.test.ts.
 */
const makeState = (overrides: Partial<GameState> = {}): GameState => {
    return {
        party: [createMockPlayerCharacter({ id: 'hero-1', name: 'TestHero' })],
        inventory: [],
        gold: 500,
        dynamicLocationItemIds: {},
        currentLocationId: 'loc-1',
        merchantModal: undefined,
        characterSheetModal: { isOpen: false, character: null },
        ...overrides
    } as unknown as GameState;
};

/**
 * Creates a Stronghold with a deterministic id for test assertions.
 */
const makeStronghold = (overrides: Partial<Stronghold> = {}): Stronghold => {
    const base = createStronghold('Test Fort', 'castle', 'loc-1');
    return { ...base, id: 'sh-test', ...overrides };
};

// ---------------------------------------------------------------------------
// FOUND_STRONGHOLD
// ---------------------------------------------------------------------------
describe('legacyReducer - FOUND_STRONGHOLD', () => {
    it('should create a new stronghold and add it to state.strongholds', () => {
        const state = makeState();
        const action: AppAction = {
            type: 'FOUND_STRONGHOLD',
            payload: { name: 'New Keep', type: 'castle', locationId: 'loc-42' }
        };

        const result = legacyReducer(state, action);

        expect(result.strongholds).toBeDefined();
        const shIds = Object.keys(result.strongholds!);
        expect(shIds).toHaveLength(1);

        const sh = result.strongholds![shIds[0]];
        expect(sh.name).toBe('New Keep');
        expect(sh.type).toBe('castle');
        expect(sh.locationId).toBe('loc-42');
        expect(sh.resources.gold).toBe(1000);
        expect(sh.staff).toEqual([]);
    });

    it('should add stronghold id to legacy.strongholdIds', () => {
        const state = makeState();
        const action: AppAction = {
            type: 'FOUND_STRONGHOLD',
            payload: { name: 'Fort A', type: 'tower', locationId: 'loc-1' }
        };

        const result = legacyReducer(state, action);

        expect(result.legacy).toBeDefined();
        expect(result.legacy!.strongholdIds).toHaveLength(1);

        const newShId = Object.keys(result.strongholds!)[0];
        expect(result.legacy!.strongholdIds).toContain(newShId);
    });

    it('should initialize legacy if not already present', () => {
        const state = makeState({ legacy: undefined });
        const action: AppAction = {
            type: 'FOUND_STRONGHOLD',
            payload: { name: 'Fort B', type: 'temple', locationId: 'loc-2' }
        };

        const result = legacyReducer(state, action);

        expect(result.legacy).toBeDefined();
        expect(result.legacy!.familyName).toBe('TestHero');
    });

    it('should append to existing strongholds when founding a second one', () => {
        const existingSh = makeStronghold({ id: 'sh-existing' });
        const existingLegacy = initializeLegacy('Founders');
        existingLegacy.strongholdIds.push('sh-existing');

        const state = makeState({
            strongholds: { 'sh-existing': existingSh },
            legacy: existingLegacy
        });

        const action: AppAction = {
            type: 'FOUND_STRONGHOLD',
            payload: { name: 'Fort C', type: 'guild_hall', locationId: 'loc-3' }
        };

        const result = legacyReducer(state, action);

        expect(Object.keys(result.strongholds!)).toHaveLength(2);
        expect(result.strongholds!['sh-existing']).toBeDefined();
        expect(result.legacy!.strongholdIds).toHaveLength(2);
        expect(result.legacy!.strongholdIds).toContain('sh-existing');
    });
});

// ---------------------------------------------------------------------------
// RECRUIT_STAFF
// ---------------------------------------------------------------------------
describe('legacyReducer - RECRUIT_STAFF', () => {
    it('should return {} when stronghold does not exist', () => {
        const state = makeState({ strongholds: {} });
        const action: AppAction = {
            type: 'RECRUIT_STAFF',
            payload: { strongholdId: 'nonexistent', name: 'Bob', role: 'guard' }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should return {} when state.strongholds is undefined', () => {
        const state = makeState({ strongholds: undefined });
        const action: AppAction = {
            type: 'RECRUIT_STAFF',
            payload: { strongholdId: 'sh-1', name: 'Bob', role: 'guard' }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should add a staff member to the specified stronghold', () => {
        const sh = makeStronghold();
        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'RECRUIT_STAFF',
            payload: { strongholdId: sh.id, name: 'Alice', role: 'steward' }
        };

        const result = legacyReducer(state, action);

        expect(result.strongholds).toBeDefined();
        const updated = result.strongholds![sh.id];
        expect(updated.staff).toHaveLength(1);
        expect(updated.staff[0].name).toBe('Alice');
        expect(updated.staff[0].role).toBe('steward');
    });

    it('should append to existing staff list', () => {
        let sh = makeStronghold();
        sh = recruitStaff(sh, 'First Guard', 'guard');
        sh = { ...sh, id: 'sh-test' };

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'RECRUIT_STAFF',
            payload: { strongholdId: sh.id, name: 'Second Spy', role: 'spy' }
        };

        const result = legacyReducer(state, action);

        const updated = result.strongholds![sh.id];
        expect(updated.staff).toHaveLength(2);
        expect(updated.staff[1].name).toBe('Second Spy');
        expect(updated.staff[1].role).toBe('spy');
    });

    it('should not mutate other strongholds in state', () => {
        const sh1 = makeStronghold({ id: 'sh-1' });
        const sh2 = makeStronghold({ id: 'sh-2', name: 'Other Fort' });

        const state = makeState({ strongholds: { [sh1.id]: sh1, [sh2.id]: sh2 } });
        const action: AppAction = {
            type: 'RECRUIT_STAFF',
            payload: { strongholdId: 'sh-1', name: 'Bob', role: 'merchant' }
        };

        const result = legacyReducer(state, action);

        expect(result.strongholds!['sh-2'].staff).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// FIRE_STAFF
// ---------------------------------------------------------------------------
describe('legacyReducer - FIRE_STAFF', () => {
    it('should return {} when stronghold does not exist', () => {
        const state = makeState({ strongholds: {} });
        const action: AppAction = {
            type: 'FIRE_STAFF',
            payload: { strongholdId: 'nonexistent', staffId: 'staff-1' }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should remove a staff member by id', () => {
        let sh = makeStronghold();
        sh = recruitStaff(sh, 'Expendable', 'guard');
        sh = { ...sh, id: 'sh-test' };
        const staffId = sh.staff[0].id;

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'FIRE_STAFF',
            payload: { strongholdId: sh.id, staffId }
        };

        const result = legacyReducer(state, action);

        expect(result.strongholds![sh.id].staff).toHaveLength(0);
    });

    it('should return {} (catch) when staff is on a mission', () => {
        let sh = makeStronghold();
        sh = recruitStaff(sh, 'Mission Agent', 'spy');
        sh = { ...sh, id: 'sh-test' };
        const staffId = sh.staff[0].id;

        // Start a mission for this staff member
        sh = startMission(sh, staffId, 'scout', 20, 'Spy assignment');
        sh = { ...sh, id: 'sh-test' };

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'FIRE_STAFF',
            payload: { strongholdId: sh.id, staffId }
        };

        // The reducer catches the thrown error and returns {}
        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should keep other staff members when one is fired', () => {
        let sh = makeStronghold();
        sh = recruitStaff(sh, 'Keeper', 'steward');
        sh = recruitStaff(sh, 'Fired Guy', 'guard');
        sh = { ...sh, id: 'sh-test' };
        const firedId = sh.staff[1].id;

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'FIRE_STAFF',
            payload: { strongholdId: sh.id, staffId: firedId }
        };

        const result = legacyReducer(state, action);

        expect(result.strongholds![sh.id].staff).toHaveLength(1);
        expect(result.strongholds![sh.id].staff[0].name).toBe('Keeper');
    });
});

// ---------------------------------------------------------------------------
// PURCHASE_UPGRADE
// ---------------------------------------------------------------------------
describe('legacyReducer - PURCHASE_UPGRADE', () => {
    it('should return {} when stronghold does not exist', () => {
        const state = makeState({ strongholds: {} });
        const action: AppAction = {
            type: 'PURCHASE_UPGRADE',
            payload: { strongholdId: 'nonexistent', upgradeId: 'market_stall' }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should purchase an upgrade and deduct resources', () => {
        const sh = makeStronghold();
        // Default: gold 1000, supplies 100
        // market_stall costs: gold 500, supplies 50

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'PURCHASE_UPGRADE',
            payload: { strongholdId: sh.id, upgradeId: 'market_stall' }
        };

        const result = legacyReducer(state, action);

        const updated = result.strongholds![sh.id];
        expect(updated.upgrades).toContain('market_stall');
        expect(updated.resources.gold).toBe(500);
        expect(updated.resources.supplies).toBe(50);
    });

    it('should return {} when gold is insufficient (catches error)', () => {
        const sh = makeStronghold({ resources: { gold: 100, supplies: 200, influence: 0, intel: 0 } });

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'PURCHASE_UPGRADE',
            payload: { strongholdId: sh.id, upgradeId: 'market_stall' }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should return {} when supplies are insufficient (catches error)', () => {
        const sh = makeStronghold({ resources: { gold: 5000, supplies: 10, influence: 0, intel: 0 } });

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'PURCHASE_UPGRADE',
            payload: { strongholdId: sh.id, upgradeId: 'market_stall' }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should return {} when prerequisites are not met (catches error)', () => {
        const sh = makeStronghold({ resources: { gold: 5000, supplies: 500, influence: 0, intel: 0 } });
        // marketplace requires market_stall

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'PURCHASE_UPGRADE',
            payload: { strongholdId: sh.id, upgradeId: 'marketplace' }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should return {} for a nonexistent upgrade id (catches error)', () => {
        const sh = makeStronghold();

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'PURCHASE_UPGRADE',
            payload: { strongholdId: sh.id, upgradeId: 'does_not_exist' }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// START_STRONGHOLD_MISSION
// ---------------------------------------------------------------------------
describe('legacyReducer - START_STRONGHOLD_MISSION', () => {
    it('should return {} when stronghold does not exist', () => {
        const state = makeState({ strongholds: {} });
        const action: AppAction = {
            type: 'START_STRONGHOLD_MISSION',
            payload: {
                strongholdId: 'nonexistent',
                staffId: 'staff-1',
                type: 'scout',
                difficulty: 30,
                description: 'Scout the hills'
            }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should start a mission for a valid staff member', () => {
        let sh = makeStronghold();
        sh = recruitStaff(sh, 'Scout', 'spy');
        sh = { ...sh, id: 'sh-test' };
        const staffId = sh.staff[0].id;

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'START_STRONGHOLD_MISSION',
            payload: {
                strongholdId: sh.id,
                staffId,
                type: 'scout',
                difficulty: 25,
                description: 'Explore the ruins'
            }
        };

        const result = legacyReducer(state, action);

        const updated = result.strongholds![sh.id];
        expect(updated.missions).toHaveLength(1);
        expect(updated.missions[0].type).toBe('scout');
        expect(updated.missions[0].description).toBe('Explore the ruins');
        expect(updated.missions[0].difficulty).toBe(25);
        // Staff should now be assigned to mission
        expect(updated.staff[0].currentMissionId).toBe(updated.missions[0].id);
        // Supplies should be deducted by 10
        expect(updated.resources.supplies).toBe(90);
    });

    it('should return {} when staff member is already on a mission (catches error)', () => {
        let sh = makeStronghold();
        sh = recruitStaff(sh, 'Busy Agent', 'spy');
        sh = { ...sh, id: 'sh-test' };
        const staffId = sh.staff[0].id;

        sh = startMission(sh, staffId, 'scout', 10, 'First mission');
        sh = { ...sh, id: 'sh-test' };

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'START_STRONGHOLD_MISSION',
            payload: {
                strongholdId: sh.id,
                staffId,
                type: 'trade',
                difficulty: 20,
                description: 'Second mission'
            }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should return {} when staff member does not exist (catches error)', () => {
        const sh = makeStronghold();

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'START_STRONGHOLD_MISSION',
            payload: {
                strongholdId: sh.id,
                staffId: 'nonexistent-staff',
                type: 'raid',
                difficulty: 50,
                description: 'Raiding'
            }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should return {} when supplies are insufficient (catches error)', () => {
        let sh = makeStronghold({ resources: { gold: 1000, supplies: 5, influence: 0, intel: 0 } });
        sh = recruitStaff(sh, 'Deprived', 'guard');
        sh = { ...sh, id: 'sh-test' };
        const staffId = sh.staff[0].id;

        const state = makeState({ strongholds: { [sh.id]: sh } });
        const action: AppAction = {
            type: 'START_STRONGHOLD_MISSION',
            payload: {
                strongholdId: sh.id,
                staffId,
                type: 'raid',
                difficulty: 30,
                description: 'Undersupplied raid'
            }
        };

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });

    it('should support different mission types', () => {
        const missionTypes: Array<{ type: 'scout' | 'trade' | 'diplomacy' | 'raid'; role: 'spy' | 'merchant' | 'steward' | 'guard' }> = [
            { type: 'scout', role: 'spy' },
            { type: 'trade', role: 'merchant' },
            { type: 'diplomacy', role: 'steward' },
            { type: 'raid', role: 'guard' }
        ];

        for (const mt of missionTypes) {
            let sh = makeStronghold();
            sh = recruitStaff(sh, `Agent-${mt.type}`, mt.role);
            sh = { ...sh, id: 'sh-test' };
            const staffId = sh.staff[0].id;

            const state = makeState({ strongholds: { [sh.id]: sh } });
            const action: AppAction = {
                type: 'START_STRONGHOLD_MISSION',
                payload: {
                    strongholdId: sh.id,
                    staffId,
                    type: mt.type,
                    difficulty: 40,
                    description: `${mt.type} operation`
                }
            };

            const result = legacyReducer(state, action);
            expect(result.strongholds![sh.id].missions[0].type).toBe(mt.type);
        }
    });
});

// ---------------------------------------------------------------------------
// Default case
// ---------------------------------------------------------------------------
describe('legacyReducer - default', () => {
    it('should return {} for an unrecognized action type', () => {
        const state = makeState();
        const action = { type: 'SOME_UNKNOWN_ACTION', payload: {} } as unknown as AppAction;

        const result = legacyReducer(state, action);
        expect(result).toEqual({});
    });
});
