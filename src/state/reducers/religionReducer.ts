
import { GameState, Action, DeityAction } from '../../types';
import { AppAction } from '../actionTypes';
import { calculateFavorChange, getDeity } from '../../utils/religionUtils';

export function religionReducer(state: GameState, action: AppAction): Partial<GameState> {
    if (action.type !== 'PRAY') {
        return {};
    }

    const { deityId, offering } = action.payload as { deityId: string, offering?: number };
    const deity = getDeity(deityId);

    if (!deity) return {};

    const existingFavor = state.divineFavor[deityId] || { deityId, favor: 0, history: [] };

    // Simple logic: Praying gives +1 favor. Offering gold gives +1 per 10gp (capped).
    let favorBoost = 1;
    let description = 'Prayed at a shrine.';

    if (offering && offering > 0) {
        if (state.gold < offering) {
             // Not enough gold, no effect (or negative?)
             // For now, just return
             return {};
        }
        favorBoost += Math.floor(offering / 10);
        description = `Prayed with an offering of ${offering}gp.`;
    }

    const prayerAction: DeityAction = {
        id: 'prayer',
        description,
        domain: 'social',
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
                sender: 'system',
                timestamp: new Date()
            }
        ]
    };
}
