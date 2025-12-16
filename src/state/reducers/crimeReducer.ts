
import { GameState, Crime } from '../../types';
import { AppAction } from '../actionTypes';

/**
 * Handles crime and notoriety related actions.
 */
export const crimeReducer = (state: GameState, action: AppAction): Partial<GameState> => {
    switch (action.type) {
        case 'COMMIT_CRIME': {
            const { type, locationId, severity, witnessed } = action.payload;
            const newCrime: Crime = {
                id: crypto.randomUUID(),
                type,
                locationId,
                timestamp: state.gameTime.getTime(),
                severity,
                witnessed,
            };

            const heatIncrease = witnessed ? severity * 2 : severity * 0.5;

            const currentLocalHeat = state.notoriety.localHeat[locationId] || 0;
            const newLocalHeat = Math.min(100, currentLocalHeat + heatIncrease);
            const newGlobalHeat = Math.min(100, state.notoriety.globalHeat + (heatIncrease * 0.1));

            return {
                notoriety: {
                    ...state.notoriety,
                    globalHeat: newGlobalHeat,
                    localHeat: {
                        ...state.notoriety.localHeat,
                        [locationId]: newLocalHeat,
                    },
                    knownCrimes: [...state.notoriety.knownCrimes, newCrime],
                },
                messages: [
                  ...state.messages,
                  {
                    id: Date.now(),
                    text: witnessed
                      ? `Crime witnessed! You are now wanted for ${type}.`
                      : `You committed ${type} unseen, but rumors may spread.`,
                    sender: 'system',
                    timestamp: state.gameTime
                  }
                ]
            };
        }

        case 'LOWER_HEAT': {
            const { amount, locationId } = action.payload;
            let newNotoriety = { ...state.notoriety };

            if (locationId) {
                const current = newNotoriety.localHeat[locationId] || 0;
                newNotoriety.localHeat = {
                    ...newNotoriety.localHeat,
                    [locationId]: Math.max(0, current - amount)
                };
            } else {
                newNotoriety.globalHeat = Math.max(0, newNotoriety.globalHeat - amount);
                // Also lower local heat everywhere slightly
                const updatedLocalHeat: Record<string, number> = {};
                for (const loc in newNotoriety.localHeat) {
                    updatedLocalHeat[loc] = Math.max(0, newNotoriety.localHeat[loc] - (amount * 0.5));
                }
                newNotoriety.localHeat = updatedLocalHeat;
            }

            return {
                notoriety: newNotoriety,
                 messages: [
                  ...state.messages,
                  {
                    id: Date.now(),
                    text: `Your notoriety has decreased.`,
                    sender: 'system',
                    timestamp: state.gameTime
                  }
                ]
            };
        }

        default:
            return {};
    }
};
