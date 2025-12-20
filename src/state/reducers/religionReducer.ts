
import { GameState, DeityAction } from '../../types';
import { AppAction } from '../actionTypes';
import { calculateFavorChange, getDeity, evaluateAction } from '../../utils/religionUtils';
import { DEITIES } from '../../data/deities';

export function religionReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'PRAY': {
            const { deityId, offering } = action.payload as { deityId: string, offering?: number };
            const deity = getDeity(deityId);

            if (!deity) return {};

            const existingFavor = state.divineFavor[deityId] || {
                deityId: deityId,
                favor: 0,
                history: [],
                blessings: [],
                transgressions: []
            };

            // Simple logic: Praying gives +1 favor. Offering gold gives +1 per 10gp (capped).
            let favorBoost = 1;
            let description = 'Prayed at a shrine.';

            if (offering && offering > 0) {
                if (state.gold < offering) {
                    return {};
                }
                favorBoost += Math.floor(offering / 10);
                description = `Prayed with an offering of ${offering}gp.`;
            }

            const prayerAction: DeityAction = {
                description,
                favorChange: favorBoost
            };

            const newFavor = calculateFavorChange(existingFavor, prayerAction);

            return {
                divineFavor: {
                    ...state.divineFavor,
                    [deityId]: newFavor
                },
                gold: offering ? state.gold - offering : state.gold,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `You pray to ${deity.name}. Your faith is noticed.`,
                        sender: 'system' as const,
                        timestamp: new Date()
                    }
                ]
            };
        }

        case 'TRIGGER_DEITY_ACTION': {
            const { trigger } = action.payload;
            const updates: Record<string, any> = {};
            const messages: any[] = [];
            const timestamp = Date.now();

            // Iterate over all deities to see if they care about this action
            DEITIES.forEach(deity => {
                const deityAction = evaluateAction(deity.id, trigger);
                if (deityAction) {
                    const existingFavor = state.divineFavor[deity.id] || {
                        deityId: deity.id,
                        favor: 0,
                        history: [],
                        blessings: [],
                        transgressions: []
                    };

                    const newFavor = calculateFavorChange(existingFavor, deityAction);
                    updates[deity.id] = newFavor;

                    // Only notify if user has existing relationship or change is significant
                    if (existingFavor.favor !== 0 || Math.abs(deityAction.favorChange) >= 5) {
                        const changeText = deityAction.favorChange > 0 ? 'gains favor' : 'loses favor';
                        messages.push({
                            id: timestamp + Math.random(),
                            text: `${deity.name} ${changeText}: ${deityAction.description}`,
                            sender: 'system' as const,
                            timestamp: new Date(timestamp)
                        });
                    }
                }
            });

            if (Object.keys(updates).length === 0) {
                return {};
            }

            return {
                divineFavor: {
                    ...state.divineFavor,
                    ...updates
                },
                messages: [
                    ...state.messages,
                    ...messages
                ]
            };
        }

        default:
            return {};
    }
}
