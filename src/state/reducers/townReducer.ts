/**
 * @file src/state/reducers/townReducer.ts
 * Reducer for the temple modal (village temple UI).
 *
 * Formerly also handled the legacy 2D town-exploration state (player movement,
 * entering/exiting towns, viewport). That 2D village view was retired in the
 * grid-retirement program (slices 1a/1b); this reducer now handles only the
 * still-live OPEN_TEMPLE / CLOSE_TEMPLE actions.
 */

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { generateVillageTemple } from '../../utils/templeUtils';
import { VillagePersonality } from '../../types/village';

/**
 * Handle temple-related actions and return partial state updates
 */
export function townReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'OPEN_TEMPLE': {
            const { villageContext } = action.payload;
            // Generate a deterministic temple ID based on location
            const villageId = `${villageContext.worldX}_${villageContext.worldY}`;
            const personality = villageContext.personality || {
                wealth: 'comfortable',
                culture: 'stoic',
                biomeStyle: 'temperate',
                population: 'small',
                primaryIndustry: 'agriculture',
                architecturalStyle: 'medieval',
                governingBody: 'elder'
            } as VillagePersonality;

            // Use world seed + coords for deterministic temple generation
            const seed = state.worldSeed + villageContext.worldX + villageContext.worldY;
            const temple = generateVillageTemple(villageId, personality, seed);

            return {
                templeModal: {
                    isOpen: true,
                    temple: temple
                }
            };
        }

        case 'CLOSE_TEMPLE': {
            return {
                templeModal: {
                    isOpen: false,
                    temple: null
                }
            };
        }

        default:
            return {};
    }
}
