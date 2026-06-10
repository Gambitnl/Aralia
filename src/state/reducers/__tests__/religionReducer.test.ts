
import { describe, it, expect } from 'vitest';
import { religionReducer } from '../religionReducer';
import { GameState, DivineFavor } from '../../../types';

/**
 * This file verifies that the religion reducer keeps old save data and the newer
 * canonical religion state in sync.
 *
 * The religion project is migrating favor records out of the root game state and
 * into `state.religion`, but existing saves and UI paths can still read the legacy
 * location. These tests make sure prayer, deity triggers, and temple services keep
 * both locations aligned until the wider app can safely retire the bridge.
 *
 * Called by: Vitest religion reducer checks
 * Depends on: religionReducer.ts, shared GameState and DivineFavor types
 */

// These helpers build just enough game state to exercise the reducer without
// pulling in the full initial state. The override order preserves explicit test
// setup while still providing the religion, gold, messages, party, temple, and
// phase fields that the reducer expects.
const createFavor = (score: number, rank: DivineFavor['rank'] = 'Neutral'): DivineFavor => ({
    score,
    rank,
    consecutiveDaysPrayed: 0,
    history: [{ timestamp: 1, reason: 'legacy save', change: score }],
    blessings: []
});

const createInitialState = (overrides: Partial<GameState> = {}): GameState => ({
    ...overrides,
    ...(() => {
        const overrideReligion = overrides.religion ?? {};
        return {
            religion: {
                divineFavor: {
                    ...(overrideReligion.divineFavor ?? {})
                },
                discoveredDeities: overrideReligion.discoveredDeities ?? [],
                activeBlessings: overrideReligion.activeBlessings ?? []
            },
            divineFavor: {
                ...(overrides.divineFavor ?? {})
            },
        };
    })(),
    gold: overrides.gold ?? 100,
    messages: overrides.messages ?? [],
    party: overrides.party ?? [],
    temples: overrides.temples ?? {},
    phase: overrides.phase ?? ('MAIN_MENU' as GameState['phase'])
} as GameState);

describe('religionReducer', () => {
    it('hydrates legacy favor into the canonical religion state before PRAY updates', () => {
        const state = createInitialState({
            religion: {
                divineFavor: {}
            },
            divineFavor: {
                pelor: createFavor(12, 'Devotee')
            }
        });

        const result = religionReducer(state, {
            type: 'PRAY',
            payload: { deityId: 'pelor', offering: 0 }
        });

        expect(result.religion?.divineFavor['pelor']).toBeDefined();
        expect(result.religion?.divineFavor['pelor'].score).toBe(13);
        expect(result.divineFavor?.['pelor'].score).toBe(13);
        expect(result.religion?.divineFavor['pelor'].history).toHaveLength(2);
    });

    it('keeps PRAY writes synchronized across canonical and legacy favor maps', () => {
        const state = createInitialState();

        const result = religionReducer(state, {
            type: 'PRAY',
            payload: { deityId: 'pelor', offering: 20 }
        });

        expect(result.gold).toBe(80);
        expect(result.religion?.divineFavor['pelor'].score).toBe(3);
        expect(result.divineFavor?.['pelor'].score).toBe(3);
        expect(result.messages).toHaveLength(1);
        expect(result.messages?.[0].text).toContain('You pray to Pelor');
    });

    it('keeps TRIGGER_DEITY_ACTION writes synchronized across canonical and legacy favor maps', () => {
        const state = createInitialState();

        const result = religionReducer(state, {
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'HARM_INNOCENT' }
        });

        expect(result.religion?.divineFavor['bahamut']).toBeDefined();
        expect(result.religion?.divineFavor['bahamut'].score).toBe(-10);
        expect(result.divineFavor?.['bahamut'].score).toBe(-10);
        expect(result.messages).toHaveLength(1);
        expect(result.messages?.[0].text).toContain('Bahamut loses favor');
    });

    it('keeps USE_TEMPLE_SERVICE favor writes synchronized while preserving legacy fallback reads', () => {
        const state = createInitialState({
            religion: {
                divineFavor: {}
            },
            divineFavor: {
                pelor: createFavor(2, 'Neutral')
            }
        });

        const result = religionReducer(state, {
            type: 'USE_TEMPLE_SERVICE',
            payload: {
                templeId: 'temple_pelor',
                deityId: 'pelor',
                cost: 5,
                effect: 'grant_favor_small'
            }
        });

        expect(result.gold).toBe(95);
        expect(result.religion?.divineFavor['pelor'].score).toBe(7);
        expect(result.divineFavor?.['pelor'].score).toBe(7);
        expect(result.messages).toContainEqual(
            expect.objectContaining({
                text: 'You feel a sense of approval from the deity.'
            })
        );
    });

    it('still affects multiple deities when one trigger matches several doctrines', () => {
        const state = createInitialState();

        const result = religionReducer(state, {
            type: 'TRIGGER_DEITY_ACTION',
            payload: { trigger: 'DESTROY_UNDEAD' }
        });

        expect(result.religion?.divineFavor['pelor'].score).toBe(1);
        expect(result.divineFavor?.['pelor'].score).toBe(1);
        expect(result.religion?.divineFavor['raven_queen'].score).toBe(3);
        expect(result.divineFavor?.['raven_queen'].score).toBe(3);
    });
});
