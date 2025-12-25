/**
 * @file src/state/reducers/legacyReducer.ts
 * Reducer for handling Legacy and Stronghold actions.
 */

import { GameState } from '../../types/index';
import { AppAction } from '../actionTypes';
import { PlayerLegacy } from '../../types/legacy';
import { Stronghold, MissionType, StaffRole } from '../../types/stronghold';
import { grantTitle, recordMonument, registerHeir, initializeLegacy } from '../../services/legacyService';
import { createStronghold, purchaseUpgrade, recruitStaff, startMission } from '../../services/strongholdService';

export function legacyReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'INIT_LEGACY': {
            if (state.legacy) return {}; // Already initialized
            const familyName = action.payload.familyName || state.party?.[0]?.name || "Unknown";
            return {
                legacy: initializeLegacy(familyName),
                strongholds: {}
            };
        }

        case 'ADD_LEGACY_TITLE': {
            if (!state.legacy) return {};
            const { title, description, grantedBy } = action.payload;
            return {
                legacy: grantTitle(state.legacy, title, description, grantedBy)
            };
        }

        case 'ADD_LEGACY_MONUMENT': {
            if (!state.legacy) return {};
            const { name, description, locationId, cost } = action.payload;
            // Optionally deduct gold here? The service just records it.
            // Let's assume gold was deducted by a previous action or check.
            return {
                legacy: recordMonument(state.legacy, name, description, locationId, cost)
            };
        }

        case 'REGISTER_HEIR': {
            if (!state.legacy) return {};
            const { name, relation, age, heirClass } = action.payload;
            return {
                legacy: registerHeir(state.legacy, name, relation, age, heirClass)
            };
        }

        case 'FOUND_STRONGHOLD': {
            const { name, type, locationId } = action.payload;
            const newStronghold = createStronghold(name, type, locationId);

            const currentLegacy = state.legacy || initializeLegacy(state.party?.[0]?.name || "Founder");

            return {
                strongholds: {
                    ...(state.strongholds || {}),
                    [newStronghold.id]: newStronghold
                },
                legacy: {
                    ...currentLegacy,
                    strongholdIds: [...currentLegacy.strongholdIds, newStronghold.id]
                }
            };
        }

        case 'OPEN_STRONGHOLD_MODAL': {
            const { strongholdId } = action.payload;
            return {
                strongholdModal: {
                    isOpen: true,
                    activeStrongholdId: strongholdId
                }
            };
        }

        case 'CLOSE_STRONGHOLD_MODAL': {
            return {
                strongholdModal: {
                    isOpen: false,
                    activeStrongholdId: null
                }
            };
        }

        case 'UPGRADE_STRONGHOLD': {
            const { strongholdId, upgradeId } = action.payload;
            const stronghold = state.strongholds?.[strongholdId];
            if (!stronghold) return {};

            try {
                const updatedStronghold = purchaseUpgrade(stronghold, upgradeId);
                return {
                    strongholds: {
                        ...state.strongholds,
                        [strongholdId]: updatedStronghold
                    },
                    // Sync gold/supplies back to global state if needed?
                    // Currently strongholds have their own resource pool in 'resources'.
                    // If we want player to pay from inventory, we'd need to deduct from state.gold
                    // BUT: Stronghold definition has `resources: { gold, supplies }` which implies it has its own treasury.
                    // The UI shows stronghold treasury.
                };
            } catch (e) {
                console.error("Failed to upgrade stronghold:", e);
                return {}; // Or set error message
            }
        }

        case 'HIRE_STRONGHOLD_STAFF': {
            const { strongholdId, name, role } = action.payload;
            const stronghold = state.strongholds?.[strongholdId];
            if (!stronghold) return {};

            const updatedStronghold = recruitStaff(stronghold, name, role as StaffRole);
             return {
                strongholds: {
                    ...state.strongholds,
                    [strongholdId]: updatedStronghold
                }
            };
        }

        case 'START_STRONGHOLD_MISSION': {
            const { strongholdId, staffId, type } = action.payload;
            const stronghold = state.strongholds?.[strongholdId];
            if (!stronghold) return {};

            try {
                // Determine difficulty based on level/rng or hardcoded for now
                const difficulty = 10 + (stronghold.level * 2);
                const description = `A ${type} mission`;

                const updatedStronghold = startMission(stronghold, staffId, type as MissionType, difficulty, description);
                return {
                    strongholds: {
                        ...state.strongholds,
                        [strongholdId]: updatedStronghold
                    }
                };
            } catch (e) {
                console.error("Failed to start mission:", e);
                return {};
            }
        }

        default:
            return {};
    }
}
