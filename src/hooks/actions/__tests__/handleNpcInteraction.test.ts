import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dispatch } from 'react';
import { handleStartDialogue, handleTalk } from '../handleNpcInteraction';
import type { Action, GameState, KnownFact } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import { evaluateRecruitOffer } from '../../../systems/party/recruitConsent';
import { npcToPartyMember, promoteCompanionToMember } from '../../../systems/party/npcToPartyMember';
import { handleStartBattleMapEncounter } from '../handleEncounter';
import { CrimeType } from '../../../types/crime';
import { registerActiveGroundCombatProvider } from '../../../systems/combat/fightInPlace/activeGroundCombatSession';
import { COMPANIONS } from '../../../data/companions';
import { createMockGameState } from '../../../utils/core/factories';
import { OllamaService } from '../../../services/ollama';
import { createEmptyMemory } from '../../../utils/world/memoryUtils';

/**
 * This file protects NPC interaction behavior at the action-handler boundary.
 *
 * The tests keep generated-NPC first contact, normal static-NPC dialogue, and
 * quest-offer dialogue handoff separate so future agents can change one path
 * without accidentally changing the others.
 *
 * Called by: Vitest focused action-handler runs.
 * Depends on: handleNpcInteraction.ts and the existing quest blueprint registry.
 */

// ============================================================================
// Dispatch assertion helpers
// ============================================================================
// AppAction is a discriminated union and many members carry no `payload` key, so
// reading `.payload` off a raw dispatched action does not type-check. These tiny
// helpers narrow a recorded dispatch call by its `type` before exposing the
// payload, keeping the assertions both type-safe and readable.
// ============================================================================
type DispatchMock = { mock: { calls: Array<[AppAction]> } };

function findDispatched(dispatch: DispatchMock, type: AppAction['type']): AppAction | undefined {
  return dispatch.mock.calls.find(([dispatched]) => dispatched.type === type)?.[0];
}

function dispatchedPayload(dispatch: DispatchMock, type: AppAction['type']): unknown {
  const found = findDispatched(dispatch, type);
  return found ? (found as { payload?: unknown }).payload : undefined;
}

function dispatchedTypes(dispatch: DispatchMock): AppAction['type'][] {
  return dispatch.mock.calls.map(([dispatched]) => dispatched.type);
}

// ============================================================================
// Test Doubles
// ============================================================================
// This section replaces AI, voice, entity-linking, and NPC-generation services
// with tiny deterministic stand-ins. The handler can then be tested for the
// dispatches it owns without making network/model/audio calls.
// ============================================================================
const generatedNpc = {
  id: 'npc_1',
  name: 'Test NPC',
  biography: {
    age: 31,
    classId: 'villager',
  },
};

vi.mock('../../../constants', () => ({
  NPCS: {
    villager_generic: {
      id: 'villager_generic',
      name: 'Villager',
      role: 'civilian',
      initialPersonalityPrompt: 'A friendly town resident.',
      dialoguePromptSeed: 'The villager nods.',
      voice: { name: 'Aoede' },
    },
    town_guard: {
      id: 'town_guard',
      name: 'Sergeant Vane',
      role: 'guard',
      initialPersonalityPrompt: 'A stern town watchman.',
      dialoguePromptSeed: 'The guard eyes you.',
      voice: { name: 'Aoede' },
    },
  },
}));

// Guard confrontation reuses the battle-map encounter launcher; stub it so the
// test asserts the WIRING (combat started, no dialogue opened) deterministically.
vi.mock('../handleEncounter', () => ({
  handleStartBattleMapEncounter: vi.fn(async () => undefined),
}));

vi.mock('../../../services/npcGenerator', () => ({
  generateNPC: vi.fn(() => generatedNpc),
}));

vi.mock('../../../services/ollamaTextService', () => ({
  generateNPCResponse: vi.fn(async () => ({
    data: {
      text: 'I could use help gathering rare reagents.',
      promptSent: 'prompt',
      rawResponse: 'response',
    },
  })),
}));

vi.mock('../../../services/ttsService', () => ({
  synthesizeSpeech: vi.fn(async () => ({ audioData: null })),
}));

// The companion-talk branch opens a live conversation via OllamaService. Stub it
// so recruiting an already-met companion (which still proceeds into that branch)
// stays deterministic and makes no real model call.
vi.mock('../../../services/ollama', () => ({
  OllamaService: {
    isAvailable: vi.fn(async () => false),
    continueConversation: vi.fn(async () => ({ success: false, data: null, metadata: null })),
  },
}));

vi.mock('../../../utils/context/entityIntegrationUtils', () => ({
  resolveAndRegisterEntities: vi.fn(async () => undefined),
}));

// The recruit pipeline (consent gate + NPC->member converter) has its own focused
// suites (P2/P5). Here we stub them so the handler test asserts the WIRING — that
// a dialogue recruit offer runs consent and, on a yes, dispatches RECRUIT_COMPANION
// — without depending on the converter's heavy stat-building internals.
vi.mock('../../../systems/party/recruitConsent', () => ({
  evaluateRecruitOffer: vi.fn(() => ({ willJoin: true, reason: 'They agree to join you.' })),
}));

vi.mock('../../../systems/party/npcToPartyMember', () => ({
  npcToPartyMember: vi.fn((npc: { id: string; name: string }) => ({
    character: { id: npc.id, name: npc.name },
    companion: { id: npc.id, identity: { name: npc.name }, inParty: true },
    source: 'dialogue',
  })),
  promoteCompanionToMember: vi.fn((companion: { id: string; identity: { name: string } }) => ({
    character: { id: companion.id, name: companion.identity.name },
    companion: { ...companion, inParty: true },
    source: 'promote',
  })),
}));

// ============================================================================
// Shared Test State
// ============================================================================
// This section builds only the state fields the NPC handler reads. Keeping the
// state narrow makes it clear which contracts the handler actually depends on.
// ============================================================================
describe('handleStartDialogue', () => {
  const gameTime = new Date(Date.UTC(2026, 5, 9, 12, 0, 0));
  const mockDispatch = vi.fn<(action: AppAction) => void>();
  const mockAddMessage = vi.fn<(text: string, sender?: 'system' | 'player' | 'npc') => void>();
  const mockAddGeminiLog = vi.fn();
  const mockPlayPcmAudio = vi.fn(async () => undefined);

  const mockGameState = {
    gameTime,
    metNpcIds: [],
    generatedNpcs: {},
  } as unknown as GameState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['npc_1', 'villager_generic'])('remembers a first meeting with an already registered NPC: %s', async (npcId) => {
    await handleStartDialogue({
      action: { type: 'talk', payload: { npcId } } as Action,
      gameState: { ...mockGameState, generatedNpcs: { npc_1: generatedNpc } } as unknown as GameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Meeting a town resident',
    });

    expect(dispatchedPayload(mockDispatch, 'START_DIALOGUE_SESSION')).toEqual({ npcId, contactStatus: 'first-meeting' });
    expect(dispatchedPayload(mockDispatch, 'ADD_MET_NPC')).toEqual({ npcId });
    expect(dispatchedPayload(mockDispatch, 'ADD_NPC_KNOWN_FACT')).toMatchObject({
      npcId, fact: { factKey: 'player_met_npc', timestamp: gameTime.getTime() },
    });
    expect(dispatchedTypes(mockDispatch).indexOf('ADD_NPC_KNOWN_FACT'))
      .toBeLessThan(dispatchedTypes(mockDispatch).indexOf('START_DIALOGUE_SESSION'));
    expect(dispatchedTypes(mockDispatch)).not.toContain('REGISTER_GENERATED_NPC');
  });

  it('refreshes a returning resident interaction without replacing their first meeting', async () => {
    await handleStartDialogue({
      action: { type: 'talk', payload: { npcId: 'npc_1' } } as Action,
      gameState: { ...mockGameState, metNpcIds: ['npc_1'], generatedNpcs: { npc_1: generatedNpc }, npcMemory: { npc_1: { ...createEmptyMemory(), knownFacts: [{id:'retained-direct',text:'Met the adventurer.',source:'direct',isPublic:true,timestamp:gameTime.getTime()-60000,strength:3,lifespan:999,factKey:'player_met_npc'}] } } } as unknown as GameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Returning to a town resident',
    });

    expect(dispatchedTypes(mockDispatch)).not.toContain('ADD_NPC_KNOWN_FACT');
    expect(dispatchedTypes(mockDispatch)).not.toContain('ADD_MET_NPC');
    expect(dispatchedPayload(mockDispatch, 'UPDATE_NPC_INTERACTION_TIMESTAMP')).toEqual({
      npcId: 'npc_1', timestamp: gameTime.getTime(),
    });
    expect(dispatchedPayload(mockDispatch, 'START_DIALOGUE_SESSION')).toEqual({ npcId: 'npc_1', contactStatus: 'returning' });
  });

  it('does not turn gossip or registry membership into a remembered conversation', async () => {
    await handleStartDialogue({
      action: { type: 'talk', payload: { npcId: 'npc_1' } } as Action,
      gameState: { ...mockGameState, metNpcIds: ['npc_1'], generatedNpcs: { npc_1: generatedNpc }, npcMemory: { npc_1: { ...createEmptyMemory(), knownFacts: [{id:'gossip',text:'Heard about the adventurer.',source:'gossip',isPublic:true,timestamp:gameTime.getTime()-60000,strength:3,lifespan:999,factKey:'player_met_npc'}] } } } as unknown as GameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>, addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog, playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer', generalActionContext: 'First direct conversation',
    });
    expect(dispatchedPayload(mockDispatch, 'START_DIALOGUE_SESSION')).toEqual({ npcId:'npc_1', contactStatus:'first-meeting' });
    expect(dispatchedTypes(mockDispatch)).toContain('ADD_NPC_KNOWN_FACT');
  });

  it('stamps interaction recency when first meeting a generated NPC', async () => {
    const action: Action = {
      type: 'talk',
      payload: { npcId: 'npc_1' },
    } as Action;

    await handleStartDialogue({
      action,
      gameState: mockGameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing interaction recency',
    });

    const timestampCall = findDispatched(mockDispatch as unknown as DispatchMock, 'UPDATE_NPC_INTERACTION_TIMESTAMP');
    expect(timestampCall).toBeDefined();
    expect(dispatchedPayload(mockDispatch as unknown as DispatchMock, 'UPDATE_NPC_INTERACTION_TIMESTAMP')).toEqual({
      npcId: 'npc_1',
      timestamp: gameTime.getTime(),
    });

    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'ADD_NPC_KNOWN_FACT')).toBe(true);
    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'ADD_MET_NPC')).toBe(true);
    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'START_DIALOGUE_SESSION')).toBe(true);
  });

  it('records the first-contact fact through the action-memory matrix (agora-f821.15)', async () => {
    const action: Action = {
      type: 'talk',
      payload: { npcId: 'npc_1' },
    } as Action;

    await handleStartDialogue({
      action,
      gameState: mockGameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing first contact',
    });

    const fact = (
      dispatchedPayload(mockDispatch as unknown as DispatchMock, 'ADD_NPC_KNOWN_FACT') as
        { fact: KnownFact }
    ).fact;

    // The wording and the four table values the hand-rolled literal used are
    // unchanged; what changed is who owns them.
    expect(fact.text).toBe('Met the adventurer.');
    expect(fact.source).toBe('direct');
    expect(fact.isPublic).toBe(true);
    expect(fact.strength).toBe(3);
    expect(fact.lifespan).toBe(999);
    expect(fact.timestamp).toBe(gameTime.getTime());

    // The matrix signature: a deterministic id and a semantic key, neither of
    // which a `generateId()` literal could produce.
    expect(fact.factKey).toBe('player_met_npc');
    expect(fact.id).toMatch(/^amm:npc_1:met:/);
  });
});

describe('handleTalk quest handoff', () => {
  const gameTime = new Date(Date.UTC(2026, 5, 9, 13, 0, 0));
  const mockDispatch = vi.fn<(action: AppAction) => void>();
  const mockAddMessage = vi.fn<(text: string, sender?: 'system' | 'player' | 'npc') => void>();
  const mockAddGeminiLog = vi.fn();
  const mockPlayPcmAudio = vi.fn(async () => undefined);

  const mockGameState = {
    gameTime,
    metNpcIds: ['villager_generic'],
    npcMemory: {
      villager_generic: {
        disposition: 0,
        goals: [],
      },
    },
    lastInteractedNpcId: null,
    lastNpcResponse: null,
    questLog: [],
    companions: {},
    activeConversation: null,
    activeDialogueSession: null,
  } as unknown as GameState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a source-backed quest when an NPC dialogue outcome carries a minimal quest offer', async () => {
    // The offer carries only the quest id. The handler should resolve the full
    // legacy quest payload from the existing quest registry before dispatching.
    const action: Action = {
      type: 'talk',
      payload: {
        targetNpcId: 'villager_generic',
        questOffer: { questId: 'herbalist_supplies' },
      },
    } as Action;

    await handleTalk({
      action,
      gameState: mockGameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing quest handoff',
    });

    const acceptedQuestCall = findDispatched(mockDispatch as unknown as DispatchMock, 'ACCEPT_QUEST');
    expect(acceptedQuestCall).toBeDefined();
    expect(dispatchedPayload(mockDispatch as unknown as DispatchMock, 'ACCEPT_QUEST')).toMatchObject({
      id: 'herbalist_supplies',
      title: "Herbalist's Helper",
      giverId: 'tilda_herbalist',
    });
    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'START_DIALOGUE_SESSION')).toBe(true);
  });

  it('routes a generated (situation/town) NPC to a dialogue session instead of rejecting it', async () => {
    // A fresh player meets the opening situation's strangers, which live in
    // gameState.generatedNpcs (NOT the static NPCS registry). Clicking their
    // "Talk to" button must open dialogue, not fall through to the
    // "There is no one named X" dead-end.
    const stateWithGenerated = {
      ...mockGameState,
      metNpcIds: [],
      generatedNpcs: {
        stranger_1: { id: 'stranger_1', name: 'Hooded Stranger', role: 'civilian' },
      },
    } as unknown as GameState;

    const action: Action = {
      type: 'talk',
      payload: { targetNpcId: 'stranger_1' },
      targetId: 'stranger_1',
    } as Action;

    await handleTalk({
      action,
      gameState: stateWithGenerated,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing generated NPC talk',
    });

    expect(mockDispatch.mock.calls.some(([d]) => d.type === 'START_DIALOGUE_SESSION'
      && (d.payload as { npcId?: string })?.npcId === 'stranger_1')).toBe(true);
    expect(mockDispatch.mock.calls.some(([d]) => d.type === 'ADD_MET_NPC')).toBe(true);
    expect(mockAddMessage.mock.calls.some(([msg]) => /there is no one named/i.test(msg))).toBe(false);
  });

  it('gates a DEFEATED generated NPC: flavor line, no dialogue session, no replayed threat', async () => {
    // A hostile opening guard the party has beaten in combat (id now in
    // defeatedNpcIds) must NOT re-open dialogue and replay its pre-fight line.
    const stateWithDefeated = {
      ...mockGameState,
      metNpcIds: ['situation-npc-guard'],
      generatedNpcs: {
        'situation-npc-guard': { id: 'situation-npc-guard', name: 'Corwin Dain', role: 'guard' },
      },
      defeatedNpcIds: ['situation-npc-guard'],
    } as unknown as GameState;

    const action: Action = {
      type: 'talk',
      payload: { targetNpcId: 'situation-npc-guard' },
      targetId: 'situation-npc-guard',
    } as Action;

    await handleTalk({
      action,
      gameState: stateWithDefeated,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing defeated NPC gate',
    });

    // Honest flavor line, and crucially NO dialogue session opened.
    expect(mockAddMessage.mock.calls.some(([msg]) => /in no state to talk/i.test(msg))).toBe(true);
    expect(mockDispatch.mock.calls.some(([d]) => d.type === 'START_DIALOGUE_SESSION')).toBe(false);
  });

  it('keeps ordinary static NPC talk dialogue-only when no quest offer is present', async () => {
    // This guards the existing behavior: talking to an NPC still opens dialogue
    // and updates social memory, but does not start a quest by default.
    const action: Action = {
      type: 'talk',
      payload: { targetNpcId: 'villager_generic' },
    };

    await handleTalk({
      action,
      gameState: mockGameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing normal dialogue',
    });

    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'ACCEPT_QUEST')).toBe(false);
    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'START_DIALOGUE_SESSION')).toBe(true);
  });
});

// ============================================================================
// "Invite to party" recruit handoff
// ============================================================================
// These tests cover the dialogue recruit outcome in isolation: the handler reads
// a `recruitOffer` from the talk action, asks the (mocked) consent gate, and on a
// yes converts + dispatches RECRUIT_COMPANION. The consent gate and converter are
// stubbed (top of file) so this asserts handler WIRING, not their internals.
// ============================================================================
describe('handleTalk recruit handoff', () => {
  const gameTime = new Date(Date.UTC(2026, 5, 9, 14, 0, 0));
  const mockDispatch = vi.fn<(action: AppAction) => void>();
  const mockAddMessage = vi.fn<(text: string, sender?: 'system' | 'player' | 'npc') => void>();
  const mockAddGeminiLog = vi.fn();
  const mockPlayPcmAudio = vi.fn(async () => undefined);

  const richNpc = {
    id: 'stranger_1',
    name: 'Hooded Stranger',
    role: 'civilian',
    biography: { level: 2, classId: 'fighter', age: 30, family: [], backgroundId: 'soldier', abilityScores: {} },
    stats: { hp: 12, maxHp: 12, armorClass: 13, speed: 30, proficiencyBonus: 2 },
    equippedItems: {},
  };

  const baseState = {
    gameTime,
    metNpcIds: ['stranger_1'],
    npcMemory: { stranger_1: { disposition: 80, goals: [] } },
    lastInteractedNpcId: null,
    lastNpcResponse: null,
    questLog: [],
    companions: {},
    generatedNpcs: { stranger_1: richNpc },
    activeConversation: null,
    activeDialogueSession: null,
  } as unknown as GameState;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the default "yes" verdict after clearAllMocks wipes implementations.
    vi.mocked(evaluateRecruitOffer).mockReturnValue({ willJoin: true, reason: 'They agree to join you.' });
    vi.mocked(npcToPartyMember).mockImplementation((npc) => ({
      character: { id: npc.id, name: npc.name } as never,
      companion: { id: npc.id, identity: { name: npc.name }, inParty: true } as never,
      source: 'dialogue',
    }));
    vi.mocked(promoteCompanionToMember).mockImplementation((companion) => ({
      character: { id: companion.id, name: companion.identity.name } as never,
      companion: { ...companion, inParty: true } as never,
      source: 'promote',
    }));
  });

  function runTalk(action: Action, state: GameState = baseState) {
    return handleTalk({
      action,
      gameState: state,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing recruit handoff',
    });
  }

  it('converts a consenting generated NPC and dispatches RECRUIT_COMPANION', async () => {
    const action = {
      type: 'talk',
      payload: { targetNpcId: 'stranger_1', recruitOffer: { targetNpcId: 'stranger_1' } },
    } as unknown as Action;

    await runTalk(action);

    expect(vi.mocked(npcToPartyMember)).toHaveBeenCalledWith(richNpc, 'dialogue');
    const recruitPayload = dispatchedPayload(mockDispatch as unknown as DispatchMock, 'RECRUIT_COMPANION') as
      | { character: { id: string }; companion: { id: string } }
      | undefined;
    expect(recruitPayload).toBeDefined();
    expect(recruitPayload?.character.id).toBe('stranger_1');
    expect(recruitPayload?.companion.id).toBe('stranger_1');
  });

  it('posts the refusal reason and dispatches nothing when the NPC declines', async () => {
    vi.mocked(evaluateRecruitOffer).mockReturnValue({
      willJoin: false,
      reason: "Hooded Stranger isn't friendly enough toward you to join the party.",
    });

    const action = {
      type: 'talk',
      payload: { targetNpcId: 'stranger_1', recruitOffer: { targetNpcId: 'stranger_1' } },
    } as unknown as Action;

    await runTalk(action);

    expect(dispatchedTypes(mockDispatch as unknown as DispatchMock)).not.toContain('RECRUIT_COMPANION');
    expect(mockAddMessage.mock.calls.some(([msg]) => /friendly enough/i.test(msg))).toBe(true);
  });

  it('promotes an already-met authored companion rather than converting a generated NPC', async () => {
    const stateWithCompanion = {
      ...baseState,
      companions: {
        kaelen: { id: 'kaelen', identity: { name: 'Kaelen' }, personality: { values: ['Honor'], quirks: ['Stoic'] }, inParty: false, relationships: {} },
      },
    } as unknown as GameState;

    const action = {
      type: 'talk',
      payload: { targetNpcId: 'kaelen', recruitOffer: { targetNpcId: 'kaelen' } },
    } as unknown as Action;

    await runTalk(action, stateWithCompanion);

    expect(vi.mocked(promoteCompanionToMember)).toHaveBeenCalled();
    expect(vi.mocked(npcToPartyMember)).not.toHaveBeenCalled();
    const recruitPayload = dispatchedPayload(mockDispatch as unknown as DispatchMock, 'RECRUIT_COMPANION') as
      | { companion: { id: string } }
      | undefined;
    expect(recruitPayload?.companion.id).toBe('kaelen');
  });

  it('retains an authored companion refusal as an event without changing consent', async () => {
    vi.mocked(evaluateRecruitOffer).mockReturnValue({willJoin:false,reason:'Elara needs to know you better.'});
    await runTalk({type:'talk',targetId:'elara_vance',payload:{targetNpcId:'elara_vance',recruitOffer:{targetNpcId:'elara_vance'}}}, {
      ...baseState, companions:{elara_vance:COMPANIONS.elara_vance}, metNpcIds:['elara_vance'],
    });
    expect(dispatchedPayload(mockDispatch as unknown as DispatchMock, 'ADD_COMPANION_MEMORY')).toMatchObject({
      companionId:'elara_vance', memory:{type:'event',text:'Elara needs to know you better.',tags:['recruitment','refused'],timestamp:baseState.gameTime.getTime()},
    });
    expect(dispatchedTypes(mockDispatch as unknown as DispatchMock)).not.toContain('RECRUIT_COMPANION');
    expect(dispatchedTypes(mockDispatch as unknown as DispatchMock)).not.toContain('UPDATE_COMPANION_APPROVAL');
  });

  it('does not run the recruit pipeline when the talk action carries no recruit offer', async () => {
    const action = {
      type: 'talk',
      payload: { targetNpcId: 'stranger_1' },
    } as unknown as Action;

    await runTalk(action);

    expect(vi.mocked(evaluateRecruitOffer)).not.toHaveBeenCalled();
    expect(dispatchedTypes(mockDispatch as unknown as DispatchMock)).not.toContain('RECRUIT_COMPANION');
  });
});

// ============================================================================
// Guard confrontation for a WANTED player (item 1)
// ============================================================================
describe('companion first meeting without a model', () => {
  it('rejects remote public-activity talk and dialogue before any meeting or recruitment effects',async()=>{
    const companion=structuredClone(COMPANIONS.elara_vance);
    companion.publicActivity={version:1,sourceId:'companion-activity-v1:77:elara_vance',worldSeed:77,companionId:companion.id,
      kind:'restoration-preparations',burgId:93,burgName:'Kytion',cellId:4413,locationId:'cell_4413',summary:'Preparing provisions.'};
    companion.whereabouts={worldSeed:77,source:'world-activity',locationId:'cell_4413',observedAt:0,position:{xM:40,yM:5,zM:50}};
    const gameState=createMockGameState({worldSeed:77,currentLocationId:'cell_4413',companions:{elara_vance:companion},
      playerGroundPos:{tileX:4413,tileY:0,xM:10,yM:5,zM:50},metNpcIds:[]});
    for(const handler of [handleTalk,handleStartDialogue]){
      const dispatch=vi.fn<Dispatch<AppAction>>(),addMessage=vi.fn();
      await handler({action:{type:'talk',label:'Talk',targetId:companion.id,payload:{npcId:companion.id,targetNpcId:companion.id,recruitOffer:{targetNpcId:companion.id,autoAccept:true}}} as Action,gameState,dispatch,
        addMessage,addGeminiLog:vi.fn(),playPcmAudio:vi.fn(),playerContext:'Traveler',generalActionContext:'A distant nameplate'});
      expect(dispatch).not.toHaveBeenCalled();expect(addMessage).toHaveBeenCalledWith(expect.stringContaining('Approach Elara Vance'),'system');
      expect(evaluateRecruitOffer).not.toHaveBeenCalled();
    }
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(OllamaService.isAvailable).mockResolvedValue(false);
  });
  const savedTime = new Date('2026-01-02T10:00:00Z');
  async function meet(id: 'elara_vance' | 'kaelen_thorne', metNpcIds: string[] = [], memories = COMPANIONS[id].memories, questline = COMPANIONS[id].questline, facts: KnownFact[] = []) {
    const dispatch = vi.fn<Dispatch<AppAction>>();
    const companion = { ...COMPANIONS[id], memories, questline };
    const state = createMockGameState({
      gameTime: savedTime, companions: { [id]: companion }, metNpcIds,
      npcMemory: { [id]: { ...createEmptyMemory(), knownFacts: facts } },
      activeConversation: null, activeDialogueSession: null,
    });
    await handleTalk({
      action: { type: 'talk', targetId: id, payload: { targetNpcId: id } },
      gameState: state, dispatch, addMessage: vi.fn(), addGeminiLog: vi.fn(), playPcmAudio: vi.fn(),
      playerContext: 'Mara Tanner', generalActionContext: 'A normal meeting in Serara',
    });
    return dispatch;
  }

  it('introduces Elara using public identity and ambition, records the meeting, and preserves consent', async () => {
    const dispatch = await meet('elara_vance');
    const payload = dispatchedPayload(dispatch, 'START_CONVERSATION') as { initialMessage: { text: string } };
    expect(payload.initialMessage.text).toContain('Elara Vance');
    expect(payload.initialMessage.text).toContain('cleric');
    expect(payload.initialMessage.text).toContain('restore the desecrated Temple of the Morning');
    expect(payload.initialMessage.text).not.toContain('paladin');
    expect(dispatchedPayload(dispatch, 'ADD_NPC_KNOWN_FACT')).toMatchObject({
      npcId: 'elara_vance', fact: { factKey: 'player_met_npc', timestamp: savedTime.getTime() },
    });
    expect(dispatchedPayload(dispatch, 'ADD_MET_NPC')).toEqual({npcId:'elara_vance'});
    expect(dispatchedPayload(dispatch, 'ADD_DISCOVERED_FACT')).toMatchObject({
      companionId: 'elara_vance', fact: {
        id: 'elara_vance:public-goal:restore_temple', source: 'conversation',
        fact: 'Restore the desecrated Temple of the Morning', discoveredAt: savedTime.getTime(),
      },
    });
    expect(dispatchedTypes(dispatch)).not.toContain('RECRUIT_COMPANION');
    expect(dispatchedTypes(dispatch)).not.toContain('UPDATE_COMPANION_APPROVAL');
    expect(OllamaService.continueConversation).not.toHaveBeenCalled();
  });

  it('records direct confirmation when an existing met flag has only hearsay behind it', async () => {
    const gossip:KnownFact={id:'earlier-hearsay',text:'Met Mara Tanner.',source:'gossip',sourceNpcId:'elara_vance',isPublic:true,timestamp:1,strength:2,lifespan:999,factKey:'player_met_npc'};
    const dispatch=await meet('kaelen_thorne',['kaelen_thorne'],undefined,undefined,[gossip]);
    expect(dispatchedPayload(dispatch,'ADD_NPC_KNOWN_FACT')).toMatchObject({npcId:'kaelen_thorne',fact:{source:'direct',factKey:'player_met_npc',timestamp:savedTime.getTime()}});
    expect(dispatchedTypes(dispatch)).not.toContain('ADD_MET_NPC');
    expect(dispatchedTypes(dispatch)).not.toContain('UPDATE_COMPANION_APPROVAL');
  });

  it('recognizes a returning person without replacing the first-meeting fact', async () => {
    const dispatch = await meet('elara_vance', ['elara_vance'], undefined, undefined, [{id:'first-direct',text:'Met Mara Tanner.',source:'direct',isPublic:true,timestamp:savedTime.getTime()-60000,strength:3,lifespan:999,factKey:'player_met_npc'}]);
    const payload = dispatchedPayload(dispatch, 'START_CONVERSATION') as { initialMessage: { text: string } };
    expect(payload.initialMessage.text).toContain('recognizes you');
    expect(dispatchedTypes(dispatch)).not.toContain('ADD_NPC_KNOWN_FACT');
    expect(dispatchedTypes(dispatch)).not.toContain('ADD_MET_NPC');
    expect(dispatchedPayload(dispatch, 'UPDATE_NPC_INTERACTION_TIMESTAMP')).toEqual({
      npcId: 'elara_vance', timestamp: savedTime.getTime(),
    });
  });

  it('recognizes a retained invitation without treating it as consent or a promise', async () => {
    const dispatch = await meet('elara_vance', ['elara_vance'], [{
      id:'prior-invitation',type:'event',text:'Elara declined.',tags:['recruitment','refused'],importance:7,timestamp:savedTime.getTime(),
    }]);
    const payload = dispatchedPayload(dispatch, 'START_CONVERSATION') as { initialMessage: { text: string } };
    expect(payload.initialMessage.text).toContain('I remember your invitation to travel together.');
    expect(dispatchedTypes(dispatch)).not.toContain('RECRUIT_COMPANION');
  });

  it('recalls an actual open preparations promise at a returning meeting', async () => {
    const dispatch = await meet('elara_vance', ['elara_vance'], [{
      id: 'promise', type: 'event', text: 'Mara promised supplies.', tags: ['elara_road_preparations', 'promise-open'], importance: 7, timestamp: savedTime.getTime(),
    }], { id: 'elara_road_preparations', title: 'Road Preparations', currentStageId: 'collecting', stages: {} });
    expect(dispatchedPayload(dispatch, 'START_CONVERSATION')).toMatchObject({
      initialMessage: { text: expect.stringContaining('I am still counting on the road supplies you promised.') },
    });
  });

  it('does not invent a promise from a chapter stage without its event memory', async () => {
    const dispatch = await meet('elara_vance', ['elara_vance'], [], {
      id: 'elara_road_preparations', title: 'Road Preparations', currentStageId: 'collecting', stages: {},
    });
    const payload = dispatchedPayload(dispatch, 'START_CONVERSATION') as { initialMessage: { text: string } };
    expect(payload.initialMessage.text).not.toContain('supplies you promised');
  });

  it('does not reveal Kaelen’s secret debt or family search in a first introduction', async () => {
    const dispatch = await meet('kaelen_thorne');
    const payload = dispatchedPayload(dispatch, 'START_CONVERSATION') as { initialMessage: { text: string } };
    expect(payload.initialMessage.text).toContain('Kaelen');
    expect(payload.initialMessage.text).not.toMatch(/sister|debt|Zhentarim|Underdark/i);
    expect(dispatchedTypes(dispatch)).not.toContain('ADD_DISCOVERED_FACT');
  });

  it('opens the authored greeting when model discovery never responds', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(OllamaService.isAvailable).mockImplementationOnce(() => new Promise(() => {}));
      const pending = meet('elara_vance');
      await vi.advanceTimersByTimeAsync(1500);
      const dispatch = await pending;
      expect(dispatchedPayload(dispatch, 'START_CONVERSATION')).toMatchObject({
        initialMessage: { speakerId: 'elara_vance', text: expect.stringContaining('Temple of the Morning') },
      });
      expect(OllamaService.continueConversation).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('ignores a model greeting that finishes after the authored introduction has opened', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(OllamaService.isAvailable).mockResolvedValueOnce(true);
      let finish!: (result: Awaited<ReturnType<typeof OllamaService.continueConversation>>) => void;
      vi.mocked(OllamaService.continueConversation).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      const pending = meet('elara_vance');
      await vi.advanceTimersByTimeAsync(8000);
      const dispatch = await pending;
      const calls = dispatch.mock.calls.length;
      // The UI already has its authored introduction; release actual provider
      // work before the player submits another line, not merely its late text.
      const signal = vi.mocked(OllamaService.continueConversation).mock.calls[0][3]?.signal;
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal?.aborted).toBe(true);
      finish({ success: true, data: { speakerId: 'elara_vance', text: 'Late greeting' } } as Awaited<ReturnType<typeof OllamaService.continueConversation>>);
      await Promise.resolve();
      expect(dispatch.mock.calls).toHaveLength(calls);
      expect(dispatchedPayload(dispatch, 'START_CONVERSATION')).toMatchObject({
        initialMessage: { text: expect.stringContaining('Temple of the Morning') },
      });
    } finally { vi.useRealTimers(); }
  });
});

describe('handleTalk guard confrontation', () => {
  const gameTime = new Date(Date.UTC(2026, 6, 4, 10, 0, 0));
  const mockDispatch = vi.fn<(action: AppAction) => void>();
  const mockAddMessage = vi.fn<(text: string, sender?: 'system' | 'player' | 'npc') => void>();
  const mockAddGeminiLog = vi.fn();
  const mockPlayPcmAudio = vi.fn(async () => undefined);

  const wantedCrime = {
    id: 'c1', type: CrimeType.Assault, locationId: 'oakhaven', timestamp: 0, severity: 60, witnessed: true,
  };

  function baseState(overrides: Partial<GameState> = {}): GameState {
    return {
      gameTime,
      currentLocationId: 'oakhaven',
      metNpcIds: ['town_guard'],
      npcMemory: { town_guard: { disposition: 0, goals: [], knownFacts: [] } },
      lastInteractedNpcId: null,
      lastNpcResponse: null,
      questLog: [],
      companions: {},
      generatedNpcs: {},
      activeConversation: null,
      activeDialogueSession: null,
      notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [], bounties: [] },
      ...overrides,
    } as unknown as GameState;
  }

  function runTalk(state: GameState) {
    return handleTalk({
      action: { type: 'talk', payload: { targetNpcId: 'town_guard' }, targetId: 'town_guard' } as unknown as Action,
      gameState: state,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing guard confrontation',
    });
  }

  beforeEach(() => vi.clearAllMocks());

  it('fails a static authored-town confrontation closed without generic guards', async () => {
    await runTalk(baseState({ notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [wantedCrime], bounties: [] } }));
    expect(vi.mocked(handleStartBattleMapEncounter)).toHaveBeenCalledWith(
      expect.any(Function),
      {
        monsters: [],
        sourceGap: expect.objectContaining({
          code: 'authored-town-watch-no-worldforge-location',
          encounterLabel: 'Wanted watch confrontation',
          locationLabel: 'Authored town "oakhaven"',
          missingSourceFacts: [
            'WorldForge cell',
            'settlement site',
            'tactical terrain projection',
          ],
        }),
      },
    );
    expect(JSON.stringify(vi.mocked(handleStartBattleMapEncounter).mock.calls[0]?.[1])).not.toMatch(/"name":"Guard"/);
    expect(mockDispatch.mock.calls.some(([d]) => d.type === 'START_DIALOGUE_SESSION')).toBe(false);
    expect(mockAddMessage.mock.calls.some(([m]) => /wanted|surrender/i.test(m))).toBe(true);
  });

  it('uses the same source-gap record when a mounted world says the authored town is not applicable', async () => {
    const cleanup = registerActiveGroundCombatProvider(async () => ({
      status: 'not-applicable',
      detail: 'The interaction is not inside a generated settlement.',
    }));

    try {
      await runTalk(baseState({
        notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [wantedCrime], bounties: [] },
      }));
    } finally {
      cleanup();
    }

    expect(vi.mocked(handleStartBattleMapEncounter)).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        monsters: [],
        sourceGap: expect.objectContaining({
          code: 'authored-town-watch-no-worldforge-location',
        }),
      }),
    );
  });

  it('uses a prepared GroundWorld encounter instead of the generic Guard fallback', async () => {
    const sourcePayload = {
      monsters: [],
      combatants: [{ id: 'worldforge-defender:6:0:infantry:1' }],
    } as unknown as Parameters<typeof handleStartBattleMapEncounter>[1];
    const cleanup = registerActiveGroundCombatProvider(async (request) => ({
      status: 'ready',
      detail: `Prepared ${request.trigger.sourceId}.`,
      payload: sourcePayload,
    }));

    try {
      await runTalk(baseState({
        notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [wantedCrime], bounties: [] },
      }));
    } finally {
      cleanup();
    }

    expect(vi.mocked(handleStartBattleMapEncounter)).toHaveBeenCalledWith(
      expect.any(Function),
      sourcePayload,
    );
  });

  it('talks normally to a guard when the player is NOT wanted here', async () => {
    await runTalk(baseState());
    expect(vi.mocked(handleStartBattleMapEncounter)).not.toHaveBeenCalled();
  });

  it('does not confront when the crime is in a DIFFERENT town', async () => {
    const elsewhere = { ...wantedCrime, locationId: 'far-city' };
    await runTalk(baseState({ notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [elsewhere], bounties: [] } }));
    expect(vi.mocked(handleStartBattleMapEncounter)).not.toHaveBeenCalled();
  });
});


describe('generated resident Talk greeting snapshot', () => {
  it.each([false,true])('keeps prior direct meeting=%s across contact recording', async returning => {
    const knownFacts: KnownFact[] = returning ? [{id:'original',text:'Met Sana.',source:'direct',isPublic:true,timestamp:1,strength:3,lifespan:999,factKey:'player_met_npc'}] : [];
    const state = createMockGameState({generatedNpcs:{npc_1:generatedNpc as unknown as GameState['generatedNpcs'][string]},companions:{},metNpcIds:returning?['npc_1']:[],npcMemory:{npc_1:{...createEmptyMemory(),knownFacts}}});
    const dispatch = vi.fn<(action:AppAction)=>void>();
    await handleTalk({action:{type:'talk',targetId:'npc_1',label:'Talk to resident'} as Action,gameState:state,dispatch,addMessage:vi.fn(),addGeminiLog:vi.fn(),playPcmAudio:vi.fn(async()=>undefined),playerContext:'Sana',generalActionContext:'Town Talk'});
    expect(dispatchedPayload(dispatch,'START_DIALOGUE_SESSION')).toEqual({npcId:'npc_1',contactStatus:returning?'returning':'first-meeting'});
    expect(dispatchedTypes(dispatch).filter(t=>t==='ADD_NPC_KNOWN_FACT')).toHaveLength(returning?0:1);
  });
});
