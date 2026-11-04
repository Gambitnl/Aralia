/**
 * This file proves companion reducer behavior, including banter, party membership,
 * message timestamps, and romance hysteresis. The romance checks use the same saved
 * game clock that the app's world reducer advances before this reducer runs.
 */

import { companionReducer } from '../companionReducer';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { BanterMoment, Companion } from '../../../types/companions';
import type { PlayerCharacter } from '../../../types/character';
import type { RecruitPayload } from '../../../systems/party/recruitTypes';
import { generateNPC } from '../../../services/npcGenerator';
import { COMPANIONS } from '../../../data/companions';
import { promoteCompanionToMember } from '../../../systems/party/npcToPartyMember';

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

    it('retains an unanswered player line verbatim in the serializable archive without changing companion state', () => {
        const transcript: BanterMoment = {
            id: 'conversation-42',
            timestamp: 1234567890,
            locationId: 'temple',
            participants: ['cmp1'],
            lines: [
                { speakerId: 'cmp1', speakerName: 'Elara', text: 'I am trying to restore the temple.' },
                { speakerId: 'player', speakerName: 'You', text: 'Why did you want to restore the temple to begin with?' },
            ],
        };
        const state = {
            ...mockInitialState,
            companions: { cmp1: { id: 'cmp1', identity: { name: 'Elara' }, loyalty: 50 } },
        } as unknown as GameState;

        const patch = companionReducer(state, { type: 'ARCHIVE_BANTER', payload: transcript });
        const savedStateProjection = JSON.parse(JSON.stringify({ ...state, ...patch })) as GameState;

        expect(savedStateProjection.archivedBanters).toEqual([transcript]);
        expect(savedStateProjection.archivedBanters[0].lines.at(-1)).toEqual(transcript.lines[1]);
        expect(savedStateProjection.companions.cmp1).toEqual(state.companions.cmp1);
    });

    it('deduplicates archive retries by the persisted conversation ID and keeps the first transcript', () => {
        const first: BanterMoment = {
            id: 'same-conversation', timestamp: 1, locationId: 'temple', participants: ['cmp1'],
            lines: [{ speakerId: 'player', text: 'Why did you want to restore the temple?' }],
        };
        const retry: BanterMoment = {
            ...first,
            lines: [{ speakerId: 'player', text: 'A stale retry must not replace the original words.' }],
        };
        const state = { ...mockInitialState, archivedBanters: [first] } as GameState;

        expect(companionReducer(state, { type: 'ARCHIVE_BANTER', payload: retry })).toEqual({});
        expect(state.archivedBanters).toEqual([first]);
    });

    it('preserves a divergent same-ID transcript as an explicitly unqualified conflict entry', () => {
        const first: BanterMoment = {
            id: 'conversation-conflict', timestamp: 1, locationId: 'temple', participants: ['cmp1'],
            source: { kind: 'player-conversation', conversationId: 'conversation-conflict', worldSeed: 77,
                capture: 'ended', pendingAtCapture: false, semanticStatus: 'attempted' },
            lines: [{ messageId: 'question', speakerId: 'player', speakerName: 'You', text: 'Why?' }],
        };
        const other: BanterMoment = {
            ...first,
            lines: [{ messageId: 'question', speakerId: 'player', speakerName: 'You', text: 'A conflicting save branch.' }],
        };
        const state = { ...mockInitialState, archivedBanters: [first] } as GameState;

        const patch = companionReducer(state, { type: 'ARCHIVE_BANTER', payload: other });

        expect(patch.archivedBanters).toHaveLength(2);
        expect(patch.archivedBanters?.find(entry => entry.id === first.id)).toEqual(first);
        expect(patch.archivedBanters?.find(entry => entry.source?.capture === 'conflict')).toMatchObject({
            lines: other.lines,
            source: { kind: 'player-conversation', worldSeed: 77, capture: 'conflict' },
        });
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
        it('retains the met authored NPC build at the common consent boundary without refreshing an active member', () => {
            const person=structuredClone(COMPANIONS.elara_vance);
            const npc=generateNPC({id:person.id,name:person.identity.name,role:'unique',classId:'cleric',level:1});
            npc.stats.hp=3;
            const payload=promoteCompanionToMember(person);
            const state=baseState({companions:{[person.id]:person},generatedNpcs:{[person.id]:npc}});
            const next=companionReducer(state,{type:'RECRUIT_COMPANION',payload});
            expect(next.party![1].hp).toBe(3);
            expect(next.party![1].finalAbilityScores).toEqual(npc.biography.abilityScores);
            expect(next.party![1].equippedItems).toEqual(npc.equippedItems);
            expect(next.companions![person.id]).toEqual({...person,inParty:true});
            const injured={...next.party![1],hp:1,conditions:['exhaustion']};
            const active={...state,...next,party:[state.party[0],injured]};
            const repeated=companionReducer(active,{type:'RECRUIT_COMPANION',payload});
            expect(repeated.party).toBe(active.party);
            expect(repeated.party![1]).toBe(injured);
        });
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

/**
 * The full app runs worldReducer before companionReducer for ADVANCE_TIME. This
 * focused regression supplies that already-advanced saved clock and proves the
 * companion slice consumes it without adding a new timer action or wall clock.
 */
describe('companionReducer — romance hysteresis time advance', () => {
    it('exits an enemy-level romance after 24 hours on the existing in-world clock', () => {
        const playerId = 'player';
        const hostileSince = Date.UTC(351, 0, 1, 7, 0, 0);
        const oneDayMs = 24 * 60 * 60 * 1000;
        const romanticCompanion = {
            id: 'kael',
            identity: { name: 'Kaelen' },
            relationships: {
                [playerId]: {
                    targetId: playerId,
                    level: 'romance',
                    approval: -350,
                    history: [],
                    unlocks: [],
                    romanceHostileSinceGameTimeMs: hostileSince,
                },
            },
        } as unknown as Companion;
        const state = {
            companions: { kael: romanticCompanion },
            gameTime: new Date(hostileSince + oneDayMs),
        } as unknown as GameState;

        // The action payload remains unchanged. companionReducer reads the clock
        // worldReducer already advanced in the app's normal reducer sequence.
        const next = companionReducer(state, {
            type: 'ADVANCE_TIME',
            payload: { seconds: 24 * 60 * 60 },
        } as AppAction);

        expect(next.companions?.kael.relationships[playerId].level).toBe('enemy');
        expect(next.companions?.kael.relationships[playerId].romanceHostileSinceGameTimeMs).toBeUndefined();
    });

    it('does not rewrite ordinary companions during unrelated time advances', () => {
        const ordinaryCompanion = {
            id: 'kael',
            relationships: {
                player: {
                    targetId: 'player',
                    level: 'friend',
                    approval: 240,
                    history: [],
                    unlocks: [],
                },
            },
        } as unknown as Companion;
        const state = {
            companions: { kael: ordinaryCompanion },
            gameTime: new Date(Date.UTC(351, 0, 2, 7, 0, 0)),
        } as unknown as GameState;

        const next = companionReducer(state, {
            type: 'ADVANCE_TIME',
            payload: { seconds: 60 },
        } as AppAction);

        expect(next).toEqual({});
    });
});

describe('atomic paid tavern currency', () => {
  const payload=()=>({character:{id:'keeper',name:'Keeper',level:2},companion:{id:'keeper',identity:{name:'Keeper'},relationships:{}},source:'tavern',hireCostGp:30});
  const fixture=()=>({gold:0.77,inventory:[{id:'gold_piece',quantity:35,sourceId:'cache9',acquiredAt:42,containerId:'pouch'}],party:[{id:'hero',name:'Hero'}],companions:{},messages:[],gameTime:new Date('0351-01-01T08:00:00Z')}) as unknown as GameState;
  it('commits membership and face-value payment once, preserving unspent coin provenance', () => {
    const before=fixture();const action={type:'RECRUIT_COMPANION',payload:payload()} as unknown as AppAction;
    const after={...before,...companionReducer(before,action)};
    expect(after.gold).toBe(0.77);
    expect(after.inventory).toEqual([{...before.inventory[0],quantity:5}]);
    expect(after.party.map(member=>member.id)).toEqual(['hero','keeper']);
    expect(after.companions.keeper.inParty).toBe(true);
    expect(companionReducer(after,action)).toEqual({});
    expect(before.inventory[0].quantity).toBe(35);
  });
  it('rejects stale insufficient money without charging, joining or recording a false event', () => {
    const before=fixture();before.inventory[0].quantity=29;
    expect(companionReducer(before,{type:'RECRUIT_COMPANION',payload:payload()} as unknown as AppAction)).toEqual({});
    expect(before.party).toHaveLength(1);expect(before.messages).toEqual([]);
  });
  it.each([NaN,Infinity,-1,0,15])('rejects invalid or changed paid quote %s', cost => {
    expect(companionReducer(fixture(),{type:'RECRUIT_COMPANION',payload:{...payload(),hireCostGp:cost}} as unknown as AppAction)).toEqual({});
  });
});
