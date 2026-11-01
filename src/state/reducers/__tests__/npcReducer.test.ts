
import { describe, it, expect } from 'vitest';
import { npcReducer } from '../npcReducer';
import { GameState, type KnownFact } from '../../../types';
import { createMockGameState } from '../../../utils/core/factories';
import { createEmptyMemory } from '../../../utils/world/memoryUtils';
import { AppAction } from '../../actionTypes';

describe('npcReducer', () => {
const initialState: Partial<GameState> = {
        npcMemory: {
            'npc-1': {
                interactions: [],
                knownFacts: [],
                attitude: 0,
                disposition: 0,
                suspicion: 0,
                goals: [],
                lastInteractionTimestamp: 0,
                lastInteractionDate: 0,
                discussedTopics: {}
            }
        } as unknown as GameState['npcMemory'],
        activeDialogueSession: {
            npcId: 'npc-1',
            discussedTopicIds: [],
        }
    };

    it('should handle DISCUSS_TOPIC by updating both session and memory', () => {
        const action: AppAction = {
            type: 'DISCUSS_TOPIC',
            payload: {
                topicId: 'topic-1',
                npcId: 'npc-1',
                date: 12345
            }
        };

        const newState = npcReducer(initialState as GameState, action);

        // Check Session Update
        expect(newState.activeDialogueSession).toBeDefined();
        expect(newState.activeDialogueSession?.discussedTopicIds).toContain('topic-1');

        // Check Memory Update
        expect(newState.npcMemory).toBeDefined();
        const memory = (newState.npcMemory || {})['npc-1'] as GameState['npcMemory'][string];
        expect(memory?.discussedTopics?.['topic-1']).toBe(12345);
    });

    it('should not duplicate topic in session but update date in memory', () => {
        const stateWithTopic: Partial<GameState> = {
            ...initialState,
            activeDialogueSession: {
                npcId: 'npc-1',
                discussedTopicIds: ['topic-1'],
            },
            npcMemory: {
                'npc-1': {
                    ...initialState.npcMemory!['npc-1'],
                    discussedTopics: {
                        'topic-1': 10000
                    }
                }
            }
        };

        const action: AppAction = {
            type: 'DISCUSS_TOPIC',
            payload: {
                topicId: 'topic-1',
                npcId: 'npc-1',
                date: 12345 // Newer date
            }
        };

        const newState = npcReducer(stateWithTopic as GameState, action);

        // Session should remain same length (no duplicates)
        expect(newState.activeDialogueSession?.discussedTopicIds.length).toBe(1);
        expect(newState.activeDialogueSession?.discussedTopicIds).toContain('topic-1');

        // Memory should update timestamp
        const memory = (newState.npcMemory || {})['npc-1'] as GameState['npcMemory'][string];
        expect(memory?.discussedTopics?.['topic-1']).toBe(12345);
    });

    // DIAL-002: the ADD_NPC_KNOWN_FACT wire. Uses the runtime (dynamic) roster
    // because the authored starting content places one NPC per location, so the
    // same-town channel is a deliberate no-op there.
    describe('ADD_NPC_KNOWN_FACT cross-NPC propagation', () => {
        const townState = (): Partial<GameState> => ({
            gameTime: new Date('2024-01-05T12:00:00Z'),
            currentLocationId: 'ashford',
            currentLocationActiveDynamicNpcIds: null,
            dynamicNPCs: {
                bram: { id: 'bram' },
                neighbor: { id: 'neighbor' },
                outsider: { id: 'outsider' },
            } as unknown as GameState['dynamicNPCs'],
            dynamicLocations: {
                ashford: { id: 'ashford', npcIds: ['bram', 'neighbor'] },
                volmar: { id: 'volmar', npcIds: ['outsider'] },
            } as unknown as GameState['dynamicLocations'],
            npcMemory: {
                bram: { knownFacts: [], disposition: 0, suspicion: 0, goals: [] },
                neighbor: { knownFacts: [], disposition: 0, suspicion: 0, goals: [] },
                outsider: { knownFacts: [], disposition: 0, suspicion: 0, goals: [] },
            } as unknown as GameState['npcMemory'],
        });

        const factAction = (isPublic: boolean): AppAction => ({
            type: 'ADD_NPC_KNOWN_FACT',
            payload: {
                npcId: 'bram',
                fact: {
                    id: 'fact-1',
                    text: 'The stranger paid the smith in old coin.',
                    source: 'direct',
                    isPublic,
                    timestamp: Date.parse('2024-01-05T12:00:00Z'),
                    strength: 8,
                    lifespan: 30,
                },
            },
        });

        it('gives a public fact to the same-town NPC and not to the outsider', () => {
            const newState = npcReducer(townState() as GameState, factAction(true));
            const memory = newState.npcMemory!;

            expect(memory.bram.knownFacts).toHaveLength(1);
            expect(memory.neighbor.knownFacts).toHaveLength(1);
            expect(memory.neighbor.knownFacts[0].sourceNpcId).toBe('bram');
            expect(memory.neighbor.knownFacts[0].source).toBe('gossip');
            expect(memory.outsider.knownFacts).toHaveLength(0);
        });

        it('keeps a private fact with the NPC who was told it', () => {
            const newState = npcReducer(townState() as GameState, factAction(false));
            const memory = newState.npcMemory!;

            expect(memory.bram.knownFacts).toHaveLength(1);
            expect(memory.neighbor.knownFacts).toHaveLength(0);
            expect(memory.outsider.knownFacts).toHaveLength(0);
        });
    });

    it('should handle DISCUSS_TOPIC even if active session is null (e.g. background check)', () => {
        const stateNoSession: Partial<GameState> = {
            ...initialState,
            activeDialogueSession: null
        };

        const action: AppAction = {
            type: 'DISCUSS_TOPIC',
            payload: {
                topicId: 'topic-1',
                npcId: 'npc-1',
                date: 12345
            }
        };

        const newState = npcReducer(stateNoSession as GameState, action);

        // Memory should still update
        const memory = (newState.npcMemory || {})['npc-1'] as GameState['npcMemory'][string];
        expect(memory?.discussedTopics?.['topic-1']).toBe(12345);
        // Session should remain null
        expect(newState.activeDialogueSession).toBeNull();
    });

    it('seeds empty memory and persists fact when ADD_NPC_KNOWN_FACT targets an unseeded NPC (GG-165)', () => {
        const state: Partial<GameState> = { npcMemory: {} };
        const action: AppAction = {
            type: 'ADD_NPC_KNOWN_FACT',
            payload: {
                npcId: 'new_merchant',
                fact: {
                    id: 'fact-1',
                    text: 'Haggled prices down',
                    source: 'direct',
                    isPublic: false,
                    timestamp: 1000,
                    strength: 1,
                    lifespan: 1000,
                },
            },
        };
        const newState = npcReducer(state as GameState, action);
        expect(newState.npcMemory?.new_merchant).toBeDefined();
        expect(newState.npcMemory?.new_merchant.knownFacts).toHaveLength(1);
        expect(newState.npcMemory?.new_merchant.knownFacts[0].id).toBe('fact-1');
    });

    it('seeds empty memory and persists disposition when UPDATE_NPC_DISPOSITION targets an unseeded NPC (GG-165)', () => {
        const state: Partial<GameState> = { npcMemory: {} };
        const action: AppAction = {
            type: 'UPDATE_NPC_DISPOSITION',
            payload: {
                npcId: 'new_merchant',
                amount: 5,
            },
        };
        const newState = npcReducer(state as GameState, action);
        expect(newState.npcMemory?.new_merchant).toBeDefined();
        expect(newState.npcMemory?.new_merchant.disposition).toBe(5);
    });
});

describe('direct meeting provenance',()=>{
  const now=new Date('0351-01-01T18:16:00Z');
  const gossip:KnownFact={id:'prior-report',text:'Met Mara Tanner.',source:'gossip',sourceNpcId:'elara_vance',isPublic:true,timestamp:1,strength:2,lifespan:999,factKey:'player_met_npc'};
  const direct:KnownFact={id:'direct-contact',text:gossip.text,source:'direct',isPublic:true,timestamp:now.getTime(),strength:3,lifespan:999,factKey:'player_met_npc'};
  const stateWith=(fact:KnownFact)=>createMockGameState({gameTime:now,currentLocationId:'cell_3052',currentLocationActiveDynamicNpcIds:['kaelen_thorne'],npcMemory:{kaelen_thorne:{...createEmptyMemory(),disposition:40,knownFacts:[fact]}}});
  it('retains attributed hearsay and stores the same words as an actual direct confirmation once',()=>{
    const state=stateWith(gossip),result=npcReducer(state,{type:'ADD_NPC_KNOWN_FACT',payload:{npcId:'kaelen_thorne',fact:direct}});
    expect(result.npcMemory?.kaelen_thorne.knownFacts).toEqual([gossip,direct]);
    expect(result.npcMemory?.kaelen_thorne.disposition).toBe(40);
    const updated={...state,...result};
    expect(npcReducer(updated,{type:'ADD_NPC_KNOWN_FACT',payload:{npcId:'kaelen_thorne',fact:{...direct,timestamp:now.getTime()+1000}}})).toEqual({});
    expect(state.npcMemory.kaelen_thorne.knownFacts).toEqual([gossip]);
  });
  it('adds a missing semantic key to an existing direct record while preserving its original id and date',()=>{
    const original={...direct,id:'old-direct',factKey:undefined,timestamp:now.getTime()-60000};
    const result=npcReducer(stateWith(original),{type:'ADD_NPC_KNOWN_FACT',payload:{npcId:'kaelen_thorne',fact:direct}});
    expect(result.npcMemory?.kaelen_thorne.knownFacts).toEqual([{...original,factKey:'player_met_npc'}]);
    expect(original.factKey).toBeUndefined();
  });
});
