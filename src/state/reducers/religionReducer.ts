
import { GameState, DeityAction } from '../../types';
import { AppAction } from '../actionTypes';
import { calculateFavorChange, getDeity, evaluateAction, grantBlessing, resolveBlessingDefinition } from '../../utils/religionUtils';
import { DEITIES } from '../../data/deities';

export function religionReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'PRAY': {
            const { deityId, offering } = action.payload as { deityId: string, offering?: number };
            const deity = getDeity(deityId);

            if (!deity) return {};

            // Adapting to ReligionState from src/types/religion.ts
            const existingFavor = state.religion.divineFavor[deityId] || {
                score: 0,
                rank: 'Neutral',
                consecutiveDaysPrayed: 0,
                history: [],
                blessings: []
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
                id: 'pray',
                description,
                favorChange: favorBoost
            };

            const newFavor = calculateFavorChange(existingFavor, prayerAction);

            return {
                religion: {
                    ...state.religion,
                    divineFavor: {
                        ...state.religion.divineFavor,
                        [deityId]: newFavor
                    }
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
            const updates: Record<string, import('../../types').DivineFavor> = {};
            const messages: unknown[] = [];
            const timestamp = Date.now();

            // Iterate over all deities to see if they care about this action
            DEITIES.forEach(deity => {
                const deityAction = evaluateAction(deity.id, trigger);
                if (deityAction) {
                    const existingFavor = state.religion.divineFavor[deity.id] || {
                        score: 0,
                        rank: 'Neutral',
                        consecutiveDaysPrayed: 0,
                        history: [],
                        blessings: []
                    };

                    const newFavor = calculateFavorChange(existingFavor, deityAction);
                    updates[deity.id] = newFavor;

                    // Only notify if user has existing relationship or change is significant
                    if (existingFavor.score !== 0 || Math.abs(deityAction.favorChange) >= 5) {
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
                religion: {
                    ...state.religion,
                    divineFavor: {
                        ...state.religion.divineFavor,
                        ...updates
                    }
                },
                messages: [
                    ...state.messages,
                    ...messages
                ]
            };
        }

        case 'USE_TEMPLE_SERVICE': {
            const { templeId: _templeId, deityId, cost, effect } = action.payload;

            // Deduct gold
            if (state.gold < cost) return {}; // Should be checked by UI but safety first

            const newGold = state.gold - cost;
            const messages = [...state.messages];
            const timestamp = Date.now();

            let party = [...state.party];
            const favorUpdates = { ...state.religion.divineFavor };

            // Apply Effects
            if (effect === 'restore_hp_full') {
                party = party.map(char => ({
                    ...char,
                    hp: char.maxHp,
                    statusEffects: char.statusEffects.filter(e => e.type !== 'wounded')
                }));
                messages.push({
                    id: timestamp,
                    text: 'The divine light washes over the party, restoring all health.',
                    sender: 'system',
                    timestamp: new Date(timestamp)
                });
            } else if (effect === 'heal_20_hp') {
                party = party.map(char => ({
                    ...char,
                    hp: Math.min(char.maxHp, char.hp + 20)
                }));
                messages.push({
                    id: timestamp,
                    text: 'A soothing warmth heals your wounds.',
                    sender: 'system',
                    timestamp: new Date(timestamp)
                });
            } else if (effect === 'remove_condition_poisoned') {
                party = party.map(char => ({
                    ...char,
                    statusEffects: char.statusEffects.filter(e => e.type !== 'poisoned' && e.type !== 'diseased')
                }));
                messages.push({
                    id: timestamp,
                    text: 'The purification ritual cleanses toxins from your bodies.',
                    sender: 'system',
                    timestamp: new Date(timestamp)
                });
            } else if (effect === 'remove_curse') {
                 party = party.map(char => ({
                    ...char,
                    statusEffects: char.statusEffects.filter(e => e.type !== 'cursed')
                }));
                messages.push({
                    id: timestamp,
                    text: 'A heavy weight lifts as the curse is broken.',
                    sender: 'system',
                    timestamp: new Date(timestamp)
                });
            } else if (effect === 'grant_favor_small' && deityId) {
                 const existing = favorUpdates[deityId] || { score: 0, rank: 'Neutral', consecutiveDaysPrayed: 0, history: [], blessings: [] };
                 favorUpdates[deityId] = calculateFavorChange(existing, { id: 'donate_small', description: 'Temple Donation', favorChange: 5 });
                 messages.push({
                    id: timestamp,
                    text: 'You feel a sense of approval from the deity.',
                    sender: 'system',
                    timestamp: new Date(timestamp)
                });
            } else if (effect === 'grant_favor_large' && deityId) {
                 const existing = favorUpdates[deityId] || { score: 0, rank: 'Neutral', consecutiveDaysPrayed: 0, history: [], blessings: [] };
                 favorUpdates[deityId] = calculateFavorChange(existing, { id: 'donate_large', description: 'Major Temple Donation', favorChange: 15 });
                 messages.push({
                    id: timestamp,
                    text: 'The very air hums with divine gratitude.',
                    sender: 'system',
                    timestamp: new Date(timestamp)
                });
            } else if (effect.startsWith('grant_blessing_') && deityId) {
                const blessingIdFragment = effect.slice(15); // 'grant_blessing_'.length === 15
                const blessingId = `blessing_${blessingIdFragment}`;

                const definition = resolveBlessingDefinition(blessingId);

                if (definition) {
                    const { effect: statusEffect, name, description } = definition;

                    // 1. Add Status Effect to Party
                    party = party.map(char => ({
                        ...char,
                        statusEffects: [...char.statusEffects, {
                            ...statusEffect,
                            // Ensure unique IDs for instances
                            id: `${statusEffect.id}_${char.id}_${timestamp}`
                        }]
                    }));

                    // 2. Add Blessing to Favor Record
                    const existing = favorUpdates[deityId] || { score: 0, rank: 'Neutral', consecutiveDaysPrayed: 0, history: [], blessings: [] };
                    const blessingRecord = {
                        id: blessingId,
                        name: name,
                        description: description,
                        effect: statusEffect
                    };

                    favorUpdates[deityId] = grantBlessing(existing, blessingRecord);

                    messages.push({
                        id: timestamp,
                        text: `You receive the blessing: ${name}.`,
                        sender: 'system',
                        timestamp: new Date(timestamp)
                    });
                }
            }

            return {
                gold: newGold,
                party,
                messages,
                religion: {
                    ...state.religion,
                    divineFavor: favorUpdates
                }
            };
        }

        default:
            return {};
    }
}
