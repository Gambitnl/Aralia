
import { companionReducer } from '../companionReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { BanterMoment, Companion } from '../../../types/companions';
import type { PlayerCharacter } from '../../../types/character';
import type { RecruitPayload } from '../../../systems/party/recruitTypes';

describe('companionReducer', () => {
    const mockInitialState: GameState = {
        companions: {},
        messages: [],
        archivedBanters: []
    } as unknown as GameState;

    it('should handle ARCHIVE_BANTER', () => {
        const moment: BanterMoment = {
            id: 'test-moment',
            timestamp: 1234567890,
            locationId: 'tavern',
            participants: ['comp1', 'comp2'],
            lines: [{ speakerId: 'comp1', text: 'Hello' }]
        };

        const action = {
            type: 'ARCHIVE_BANTER',
            payload: moment
        } as any;

        const newState = companionReducer(mockInitialState, action);

        expect(newState.archivedBanters).toHaveLength(1);
        expect(newState.archivedBanters?.[0]).toEqual(moment);
    });

    it('should prepend new banters to archive', () => {
        const moment1: BanterMoment = {
            id: 'm1',
            timestamp: 100,
            locationId: 'loc1',
            participants: [],
            lines: []
        };

        const stateWithOne = {
            ...mockInitialState,
            archivedBanters: [moment1]
        };

        const moment2: BanterMoment = {
            id: 'm2',
            timestamp: 200,
            locationId: 'loc2',
            participants: [],
            lines: []
        };

        const action = {
            type: 'ARCHIVE_BANTER',
            payload: moment2
        } as any;

        const newState = companionReducer(stateWithOne, action);

        expect(newState.archivedBanters).toHaveLength(2);
        expect(newState.archivedBanters?.[0].id).toBe('m2');
        expect(newState.archivedBanters?.[1].id).toBe('m1');
    });

    it('stamps companion-reaction log messages with in-game time, not the real clock', () => {
        // Direct-push log messages (those that build the messages array inside a
        // reducer rather than dispatching ADD_MESSAGE) must also reflect the
        // in-game clock so the adventure Log stays consistent with the HUD.
        const inGameTime = new Date(Date.UTC(351, 0, 1, 7, 0, 0)); // 1 Deepwinter 351, 07:00
        const state = {
            ...mockInitialState,
            gameTime: inGameTime,
            companions: { c1: { id: 'c1', identity: { name: 'Veldrin' } } },
        } as unknown as GameState;

        const action = {
            type: 'ADD_COMPANION_REACTION',
            payload: { companionId: 'c1', reaction: 'Well met.' },
        } as any;

        const newState = companionReducer(state, action);
        const msg = newState.messages?.[newState.messages.length - 1];
        expect(new Date(msg!.timestamp).getTime()).toBe(inGameTime.getTime());
        expect(new Date(msg!.timestamp).getTime()).not.toBe(Date.now());
    });
});

/**
 * Membership-pair mutation: RECRUIT_COMPANION and DISMISS_PARTY_MEMBER are the
 * canonical add/remove for a party member. They keep the two unlinked stores in
 * lockstep — `state.party` (playable roster) and `state.companions`
 * (relationship layer) — joined by one shared id.
 */
describe('companionReducer — recruit / dismiss', () => {
    const member = (id: string, name: string): PlayerCharacter =>
        ({ id, name }) as unknown as PlayerCharacter;
    const companion = (id: string, name: string): Companion =>
        ({ id, identity: { name }, loyalty: 60, relationships: {} }) as unknown as Companion;

    const recruitPayload = (id: string, name: string): RecruitPayload => ({
        character: member(id, name),
        companion: companion(id, name),
        source: 'dialogue',
    });

    const baseState = (overrides: Partial<GameState> = {}): GameState =>
        ({
            party: [member('player', 'Hero')],
            companions: {},
            messages: [],
            gameTime: new Date(Date.UTC(351, 0, 1, 7, 0, 0)),
            ...overrides,
        }) as unknown as GameState;

    describe('RECRUIT_COMPANION', () => {
        it('appends to BOTH stores under one shared id (inParty:true)', () => {
            const next = companionReducer(baseState(), {
                type: 'RECRUIT_COMPANION',
                payload: recruitPayload('kael', 'Kaelen'),
            } as AppAction);

            expect(next.party!.map((m) => m.id)).toEqual(['player', 'kael']);
            expect(next.companions!.kael).toBeDefined();
            expect(next.companions!.kael.id).toBe(next.party![1].id);
            expect(next.companions!.kael.inParty).toBe(true);
            expect(next.messages!.some((m) => /Kaelen/.test(m.text) && /joins/.test(m.text))).toBe(true);
        });

        it('does NOT block on party size — no hard cap (DESIGN §5.1)', () => {
            // Seed a party already past the soft cap of 6.
            const big = ['player', 'a', 'b', 'c', 'd', 'e', 'f'].map((id) => member(id, id));
            const next = companionReducer(baseState({ party: big } as Partial<GameState>), {
                type: 'RECRUIT_COMPANION',
                payload: recruitPayload('kael', 'Kaelen'),
            } as AppAction);

            // Recruit still succeeds (8th member added) ...
            expect(next.party!.some((m) => m.id === 'kael')).toBe(true);
            expect(next.party!).toHaveLength(8);
            // ... but a non-blocking soft-cap notice is surfaced.
            expect(next.messages!.some((m) => /large/i.test(m.text))).toBe(true);
        });

        it('does not double-append an id already in the party', () => {
            const state = baseState({
                party: [member('player', 'Hero'), member('kael', 'Kaelen')],
            } as Partial<GameState>);
            const next = companionReducer(state, {
                type: 'RECRUIT_COMPANION',
                payload: recruitPayload('kael', 'Kaelen'),
            } as AppAction);
            expect(next.party!.filter((m) => m.id === 'kael')).toHaveLength(1);
        });
    });

    describe('DISMISS_PARTY_MEMBER', () => {
        const populated = () =>
            baseState({
                party: [member('player', 'Hero'), member('kael', 'Kaelen')],
                companions: { kael: companion('kael', 'Kaelen') },
            } as Partial<GameState>);

        it('removes from party but KEEPS the companion record, marking inParty:false', () => {
            const next = companionReducer(populated(), {
                type: 'DISMISS_PARTY_MEMBER',
                payload: { memberId: 'kael' },
            } as AppAction);

            expect(next.party!.some((m) => m.id === 'kael')).toBe(false);
            expect(next.companions!.kael).toBeDefined();
            expect(next.companions!.kael.inParty).toBe(false);
            expect(next.messages!.some((m) => /Kaelen/.test(m.text) && /leaves/.test(m.text))).toBe(true);
        });

        it('REFUSES to dismiss the party leader (index 0)', () => {
            const next = companionReducer(populated(), {
                type: 'DISMISS_PARTY_MEMBER',
                payload: { memberId: 'player' },
            } as AppAction);

            // Leader stays in the roster; a refusal message is posted.
            expect(next.party).toBeUndefined();
            expect(next.messages!.some((m) => /leader cannot be dismissed/i.test(m.text))).toBe(true);
        });

        it('still drops a party entry even if no Companion record exists', () => {
            const state = baseState({
                party: [member('player', 'Hero'), member('ghost', 'Ghost')],
                companions: {},
            } as Partial<GameState>);
            const next = companionReducer(state, {
                type: 'DISMISS_PARTY_MEMBER',
                payload: { memberId: 'ghost' },
            } as AppAction);
            expect(next.party!.some((m) => m.id === 'ghost')).toBe(false);
            expect(next.companions).toBeUndefined();
        });
    });
});
