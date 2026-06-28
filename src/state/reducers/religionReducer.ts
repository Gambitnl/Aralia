// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 05:39:30
 * Dependents: state/appState.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState, DeityAction, DivineFavor, ReligionState } from '../../types';
import { AppAction } from '../actionTypes';
import { calculateFavorChange, getDeity, evaluateAction, grantBlessing, resolveBlessingDefinition } from '../../utils/religionUtils';
import { DEITIES } from '../../data/deities';
import { inGameTimestamp } from '../../utils/core/timeUtils';

// Keep the canonical religion slice and the legacy flat favor map in one
// place during the migration. The helper reads both shapes, prefers the
// canonical value when it exists, and backfills missing entries from the
// legacy map so old saves and partial loads stay readable.
const createNeutralFavor = (): DivineFavor => ({
    score: 0,
    rank: 'Neutral',
    consecutiveDaysPrayed: 0,
    history: [],
    blessings: []
});

const getReligionCompatibilityState = (state: GameState): ReligionState => {
    const canonicalReligion = state.religion ?? {
        divineFavor: {},
        discoveredDeities: [],
        activeBlessings: []
    };

    return {
        ...canonicalReligion,
        divineFavor: {
            ...(state.divineFavor ?? {}),
            ...(canonicalReligion.divineFavor ?? {})
        },
        discoveredDeities: canonicalReligion.discoveredDeities ?? [],
        activeBlessings: canonicalReligion.activeBlessings ?? []
    };
};

const getFavorRecord = (religionState: ReligionState, legacyFavor: GameState['divineFavor'], deityId: string): DivineFavor => {
    return religionState.divineFavor[deityId] ?? legacyFavor?.[deityId] ?? createNeutralFavor();
};

const buildReligionCompatibilityPatch = (
    state: GameState,
    religionState: ReligionState,
    divineFavorUpdates: Record<string, DivineFavor>
): Partial<GameState> => ({
    religion: {
        ...religionState,
        divineFavor: {
            ...religionState.divineFavor,
            ...divineFavorUpdates
        }
    },
    divineFavor: {
        ...(state.divineFavor ?? {}),
        ...divineFavorUpdates
    }
});

export function religionReducer(state: GameState, action: AppAction): Partial<GameState> {
    const religionState = getReligionCompatibilityState(state);

    switch (action.type) {
        case 'PRAY': {
            const { deityId, offering } = action.payload as { deityId: string, offering?: number };
            const deity = getDeity(deityId);

            if (!deity) return {};

            const existingFavor = getFavorRecord(religionState, state.divineFavor, deityId);

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
                ...buildReligionCompatibilityPatch(state, religionState, {
                    [deityId]: newFavor
                }),
                gold: offering ? state.gold - offering : state.gold,
                messages: [
                    ...state.messages,
                    {
                        id: Date.now(),
                        text: `You pray to ${deity.name}. Your faith is noticed.`,
                        sender: 'system' as const,
                        timestamp: inGameTimestamp(state.gameTime)
                    }
                ]
            };
        }

        case 'TRIGGER_DEITY_ACTION': {
            const { trigger } = action.payload;
            const updates: Record<string, DivineFavor> = {};
            const messages: GameState['messages'] = [];
            const timestamp = Date.now();

            // Iterate over all deities to see if they care about this action
            DEITIES.forEach(deity => {
                const deityAction = evaluateAction(deity.id, trigger);
                if (deityAction) {
                    const existingFavor = getFavorRecord(religionState, state.divineFavor, deity.id);

                    const newFavor = calculateFavorChange(existingFavor, deityAction);
                    updates[deity.id] = newFavor;

                    // Only notify if user has existing relationship or change is significant
                    if (existingFavor.score !== 0 || Math.abs(deityAction.favorChange) >= 5) {
                        const changeText = deityAction.favorChange > 0 ? 'gains favor' : 'loses favor';
                        messages.push({
                            id: timestamp + Math.random(),
                            text: `${deity.name} ${changeText}: ${deityAction.description}`,
                            sender: 'system' as const,
                            timestamp: inGameTimestamp(state.gameTime)
                        });
                    }
                }
            });

            if (Object.keys(updates).length === 0) {
                return {};
            }

            return {
                ...buildReligionCompatibilityPatch(state, religionState, updates),
                messages: [
                    ...state.messages,
                    ...messages
                ]
            };
        }

        case 'USE_TEMPLE_SERVICE': {
            const { templeId: _templeId, deityId, cost, effect } = action.payload as { templeId: string; deityId?: string; cost: number; effect: unknown };
            const effectId = String(effect);

            // Deduct gold
            if (state.gold < cost) return {}; // Should be checked by UI but safety first

            const newGold = state.gold - cost;
            const messages = [...state.messages];
            const timestamp = Date.now();

            let party = [...state.party];
            const favorUpdates = { ...religionState.divineFavor };

            // Apply Effects
            if (effectId === 'restore_hp_full') {
                party = party.map(char => ({
                    ...char,
                    hp: char.maxHp,
                    statusEffects: char.statusEffects.filter(e => (e.type as string) !== 'wounded') as import('../../types').StatusEffect[]
                }));
                messages.push({
                    id: timestamp,
                    text: 'The divine light washes over the party, restoring all health.',
                    sender: 'system',
                    timestamp: inGameTimestamp(state.gameTime)
                });
            } else if (effectId === 'heal_20_hp') {
                party = party.map(char => ({
                    ...char,
                    hp: Math.min(char.maxHp, char.hp + 20)
                }));
                messages.push({
                    id: timestamp,
                    text: 'A soothing warmth heals your wounds.',
                    sender: 'system',
                    timestamp: inGameTimestamp(state.gameTime)
                });
            } else if (effectId === 'remove_condition_poisoned') {
                party = party.map(char => ({
                    ...char,
                    statusEffects: char.statusEffects.filter(e => {
                        const typeStr = e.type as string;
                        return typeStr !== 'poisoned' && typeStr !== 'diseased';
                    }) as import('../../types').StatusEffect[]
                }));
                messages.push({
                    id: timestamp,
                    text: 'The purification ritual cleanses toxins from your bodies.',
                    sender: 'system',
                    timestamp: inGameTimestamp(state.gameTime)
                });
            } else if (effectId === 'remove_curse') {
                party = party.map(char => ({
                    ...char,
                    statusEffects: char.statusEffects.filter(e => (e.type as string) !== 'cursed') as import('../../types').StatusEffect[]
                }));
                messages.push({
                    id: timestamp,
                    text: 'A heavy weight lifts as the curse is broken.',
                    sender: 'system',
                    timestamp: inGameTimestamp(state.gameTime)
                });
            } else if (effectId === 'grant_favor_small' && deityId) {
                const existing = favorUpdates[deityId] || getFavorRecord(religionState, state.divineFavor, deityId);
                favorUpdates[deityId] = calculateFavorChange(existing, { id: 'donate_small', description: 'Temple Donation', favorChange: 5 });
                messages.push({
                    id: timestamp,
                    text: 'You feel a sense of approval from the deity.',
                    sender: 'system',
                    timestamp: inGameTimestamp(state.gameTime)
                });
            } else if (effectId === 'grant_favor_large' && deityId) {
                const existing = favorUpdates[deityId] || getFavorRecord(religionState, state.divineFavor, deityId);
                favorUpdates[deityId] = calculateFavorChange(existing, { id: 'donate_large', description: 'Major Temple Donation', favorChange: 15 });
                messages.push({
                    id: timestamp,
                    text: 'The very air hums with divine gratitude.',
                    sender: 'system',
                    timestamp: inGameTimestamp(state.gameTime)
                });
            } else if (effectId.startsWith('grant_blessing_') && deityId) {
                const blessingIdFragment = effectId.slice(15); // 'grant_blessing_'.length === 15
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
                        }] as import('../../types').StatusEffect[]
                    }));

                    // 2. Add Blessing to Favor Record
                    const existing = favorUpdates[deityId] || getFavorRecord(religionState, state.divineFavor, deityId);
                    const blessingRecord = {
                        id: blessingId,
                        name: name,
                        description: description,
                        effect: statusEffect
                    } as unknown as import('../../types').Blessing; // TODO(2026-01-03 pass 4 Codex-CLI): cast blessing until MechanicalEffect wiring is in place.

                    favorUpdates[deityId] = grantBlessing(existing, blessingRecord);

                    messages.push({
                        id: timestamp,
                        text: `You receive the blessing: ${name}.`,
                        sender: 'system',
                        timestamp: inGameTimestamp(state.gameTime)
                    });
                }
            }

            const partyWithEffects = party as GameState['party']; // TODO(2026-01-03 pass 4 Codex-CLI): cast party after effect application until status effect typing is unified.

            return {
                gold: newGold,
                party: partyWithEffects,
                messages,
                ...buildReligionCompatibilityPatch(state, religionState, favorUpdates)
            };
        }

        default:
            return {};
    }
}
