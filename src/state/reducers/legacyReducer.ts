/**
 * @file src/state/reducers/legacyReducer.ts
 * Reducer for handling Legacy and Stronghold actions.
 */

import { GameState } from '../../types/index';
import { AppAction } from '../actionTypes';
import { initializeLegacy, grantTitle, recordMonument, registerHeir } from '../../services/legacyService';
import { createStronghold, recruitStaff, fireStaff, purchaseUpgrade, startMission } from '../../services/strongholdService';

export function legacyReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'INIT_LEGACY': {
            if (state.legacy) return {}; // Already initialized
            const familyName = action.payload.familyName || state.party[0]?.name || "Unknown";
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

            const currentLegacy = state.legacy || initializeLegacy(state.party[0]?.name || "Founder");

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

        case 'RECRUIT_STAFF': {
            const stronghold = state.strongholds?.[action.payload.strongholdId];
            if (!stronghold) return {};
            const updated = recruitStaff(stronghold, action.payload.name, action.payload.role);
            return {
                strongholds: { ...state.strongholds, [action.payload.strongholdId]: updated }
            };
        }

        case 'FIRE_STAFF': {
            const stronghold = state.strongholds?.[action.payload.strongholdId];
            if (!stronghold) return {};
            try {
                const updated = fireStaff(stronghold, action.payload.staffId);
                return {
                    strongholds: { ...state.strongholds, [action.payload.strongholdId]: updated }
                };
            } catch {
                return {}; // Staff on mission — cannot fire
            }
        }

        case 'PURCHASE_UPGRADE': {
            const stronghold = state.strongholds?.[action.payload.strongholdId];
            if (!stronghold) return {};
            try {
                const updated = purchaseUpgrade(stronghold, action.payload.upgradeId);
                return {
                    strongholds: { ...state.strongholds, [action.payload.strongholdId]: updated }
                };
            } catch {
                return {}; // Insufficient resources or missing prerequisites
            }
        }

        case 'START_STRONGHOLD_MISSION': {
            const stronghold = state.strongholds?.[action.payload.strongholdId];
            if (!stronghold) return {};
            try {
                const updated = startMission(
                    stronghold,
                    action.payload.staffId,
                    action.payload.type,
                    action.payload.difficulty,
                    action.payload.description
                );
                return {
                    strongholds: { ...state.strongholds, [action.payload.strongholdId]: updated }
                };
            } catch {
                return {}; // Staff not found, already on mission, or insufficient supplies
            }
        }

        default:
            return {};
    }
}
