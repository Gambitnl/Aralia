import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dispatch } from 'react';
import { handleStartDialogue, handleTalk } from '../handleNpcInteraction';
import type { Action, GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import { evaluateRecruitOffer } from '../../../systems/party/recruitConsent';
import { npcToPartyMember, promoteCompanionToMember } from '../../../systems/party/npcToPartyMember';
import { handleStartBattleMapEncounter } from '../handleEncounter';
import { CrimeType } from '../../../types/crime';
import { registerActiveGroundCombatProvider } from '../../../systems/combat/fightInPlace/activeGroundCombatSession';

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
    continueConversation: vi.fn(async () => ({ success: false, data: null, metadata: null })),
  },
}));

vi.mock('../../../utils/entityIntegrationUtils', () => ({
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

  it('confronts a wanted player into combat instead of opening dialogue', async () => {
    await runTalk(baseState({ notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [wantedCrime], bounties: [] } }));
    expect(vi.mocked(handleStartBattleMapEncounter)).toHaveBeenCalled();
    expect(mockDispatch.mock.calls.some(([d]) => d.type === 'START_DIALOGUE_SESSION')).toBe(false);
    expect(mockAddMessage.mock.calls.some(([m]) => /wanted|surrender/i.test(m))).toBe(true);
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
