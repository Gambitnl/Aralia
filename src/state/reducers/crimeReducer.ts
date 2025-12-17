
import { GameState, Crime } from '../../types';
import { AppAction } from '../actionTypes';
import { CrimeSystem } from '../../systems/crime/CrimeSystem';

/**
 * Handles crime and notoriety related actions.
 */
export const crimeReducer = (state: GameState, action: AppAction): Partial<GameState> => {
    switch (action.type) {
        case 'COMMIT_CRIME': {
            const { type, locationId, severity, witnessed } = action.payload;

            // Normalize severity to 1-100 scale if it seems to be using 1-10
            const normalizedSeverity = severity <= 10 ? severity * 10 : severity;

            const newCrime: Crime = {
                id: crypto.randomUUID(),
                type,
                locationId,
                timestamp: state.gameTime.getTime(),
                severity: normalizedSeverity,
                witnessed,
            };

            // Use the normalized severity for heat calculations to keep balance
            // (Assuming existing 1-10 logic expected ~20 heat max for severe crimes)
            // But if we switch to 1-100, we need to adjust the heat scaling.
            // Let's adopt 1-100 as the standard.
            // Old: 10 * 2 = 20 heat. New: 100 * 0.2 = 20 heat.
            const heatIncrease = witnessed ? normalizedSeverity * 0.5 : normalizedSeverity * 0.1;

            const currentLocalHeat = state.notoriety.localHeat[locationId] || 0;
            const newLocalHeat = Math.min(100, currentLocalHeat + heatIncrease);
            const newGlobalHeat = Math.min(100, state.notoriety.globalHeat + (heatIncrease * 0.1));

            // Generate bounty if applicable (threshold 30 severity on 1-100 scale)
            const newBounty = CrimeSystem.generateBounty(newCrime);

            const currentBounties = state.notoriety.bounties || [];

            return {
                notoriety: {
                    ...state.notoriety,
                    globalHeat: newGlobalHeat,
                    localHeat: {
                        ...state.notoriety.localHeat,
                        [locationId]: newLocalHeat,
                    },
                    knownCrimes: [...state.notoriety.knownCrimes, newCrime],
                    bounties: newBounty ? [...currentBounties, newBounty] : currentBounties
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
                  },
                  ...(newBounty ? [{
                    id: Date.now() + 1,
                    text: `A bounty of ${newBounty.amount} gold has been placed on your head!`,
                    sender: 'system' as const,
                    timestamp: state.gameTime
                  }] : [])
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
