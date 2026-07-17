import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dispatch } from 'react';
import { handleEndBattle, handleStartBattleMapEncounter } from '../handleEncounter';
import type { GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import type { RichNPC } from '../../../types/world';
import type { RecruitPayload } from '../../../systems/party/recruitTypes';
import type { CombatCharacter, WorldforgeCombatantSource } from '../../../types/combat';
import { createAuthoredTownWatchSourceGap } from '../../../systems/combat/fightInPlace/authoredTownWatchSourceGap';

/**
 * Protects the encounter resolution boundary — specifically the ADDITIVE
 * rescue auto-join branch added to `handleEndBattle` (Packet P10-trigger-rescue).
 *
 * Two behaviours are kept strictly separate so a future agent can change one
 * without disturbing the other:
 *   1. NORMAL battle end (no rescuee) → dispatches only END_BATTLE, untouched.
 *   2. RESCUE branch (rescuee + state) → END_BATTLE, then consent (auto-accepted)
 *      → convert → RECRUIT_COMPANION → join message.
 *
 * The shared recruit modules (consent + converter) are mocked so this file tests
 * exactly the dispatch wiring `handleEndBattle` owns, not their internals (those
 * have their own suites under src/systems/party/__tests__).
 *
 * Called by: Vitest focused action-handler runs.
 * Depends on: handleEncounter.ts, the recruitConsent + npcToPartyMember contracts.
 */

// ============================================================================
// Test Doubles — the shared recruit building blocks.
// ============================================================================
const evaluateRecruitOffer = vi.fn();
const npcToPartyMember = vi.fn();

vi.mock('../../../systems/party/recruitConsent', () => ({
  evaluateRecruitOffer: (...args: unknown[]) => evaluateRecruitOffer(...args),
}));

vi.mock('../../../systems/party/npcToPartyMember', () => ({
  npcToPartyMember: (...args: unknown[]) => npcToPartyMember(...args),
}));

// ============================================================================
// Fixtures
// ============================================================================
const rescuedNpc = {
  id: 'npc_rescued_1',
  name: 'Freed Captive',
} as unknown as RichNPC;

const recruitPayload: RecruitPayload = {
  character: { id: 'npc_rescued_1', name: 'Freed Captive' } as RecruitPayload['character'],
  companion: { id: 'npc_rescued_1' } as RecruitPayload['companion'],
  source: 'rescue',
};

const fakeState = { companions: {}, npcMemory: {}, party: [] } as unknown as GameState;

const rewards = { gold: 10, items: [], xp: 50 };

describe('handleEndBattle', () => {
  let dispatch: ReturnType<typeof vi.fn> & Dispatch<AppAction>;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatch = vi.fn() as unknown as ReturnType<typeof vi.fn> & Dispatch<AppAction>;
    evaluateRecruitOffer.mockReturnValue({
      willJoin: true,
      reason: 'Freed Captive owes you their life and gladly joins the party.',
    });
    npcToPartyMember.mockReturnValue(recruitPayload);
  });

  // --- Normal flow (no rescuee) -------------------------------------------
  it('dispatches only END_BATTLE when no rescuee is supplied', () => {
    handleEndBattle(dispatch, rewards);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'END_BATTLE', payload: { rewards } });
    expect(evaluateRecruitOffer).not.toHaveBeenCalled();
    expect(npcToPartyMember).not.toHaveBeenCalled();
  });

  it('still works with the legacy single-arg form', () => {
    handleEndBattle(dispatch);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'END_BATTLE', payload: { rewards: undefined } });
  });

  it('does NOT recruit when a rescuee is given but gameState is missing', () => {
    handleEndBattle(dispatch, rewards, { rescuedNpc });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'END_BATTLE', payload: { rewards } });
    expect(evaluateRecruitOffer).not.toHaveBeenCalled();
  });

  // --- Rescue branch -------------------------------------------------------
  it('auto-joins a rescued NPC: END_BATTLE, then RECRUIT_COMPANION, then a message', () => {
    handleEndBattle(dispatch, rewards, { rescuedNpc, gameState: fakeState });

    // Consent is evaluated with autoAccept so the disposition gate is bypassed.
    expect(evaluateRecruitOffer).toHaveBeenCalledWith(rescuedNpc, fakeState, { autoAccept: true });
    // Conversion is tagged as a rescue.
    expect(npcToPartyMember).toHaveBeenCalledWith(rescuedNpc, 'rescue');

    const types = dispatch.mock.calls.map((c) => (c[0] as AppAction).type);
    expect(types).toEqual(['END_BATTLE', 'RECRUIT_COMPANION', 'ADD_MESSAGE']);

    expect(dispatch).toHaveBeenCalledWith({ type: 'RECRUIT_COMPANION', payload: recruitPayload });
  });

  it('END_BATTLE is dispatched before the recruit so the battle closes first', () => {
    handleEndBattle(dispatch, rewards, { rescuedNpc, gameState: fakeState });

    const types = dispatch.mock.calls.map((c) => (c[0] as AppAction).type);
    expect(types.indexOf('END_BATTLE')).toBeLessThan(types.indexOf('RECRUIT_COMPANION'));
  });

  it('posts a system join message carrying the verdict reason and companion id', () => {
    handleEndBattle(dispatch, rewards, { rescuedNpc, gameState: fakeState });

    const messageCall = dispatch.mock.calls.find(
      (c) => (c[0] as AppAction).type === 'ADD_MESSAGE',
    );
    expect(messageCall).toBeDefined();
    const payload = (messageCall![0] as Extract<AppAction, { type: 'ADD_MESSAGE' }>).payload;
    expect(payload.sender).toBe('system');
    expect(payload.text).toContain('owes you their life');
    expect(payload.metadata?.companionId).toBe('npc_rescued_1');
    expect(payload.metadata?.source).toBe('rescue');
  });

  it('does not recruit when consent declines (defensive guard)', () => {
    evaluateRecruitOffer.mockReturnValue({ willJoin: false, reason: 'No.' });

    handleEndBattle(dispatch, rewards, { rescuedNpc, gameState: fakeState });

    const types = dispatch.mock.calls.map((c) => (c[0] as AppAction).type);
    expect(types).toEqual(['END_BATTLE']);
    expect(npcToPartyMember).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Prepared Source-World Combatants
// ============================================================================
// WorldForge adapters have already selected bestiary mechanics and stamped
// durable regiment identity. The encounter launcher must preserve those actors
// instead of regenerating anonymous enemies from the Monster[] fallback.
// ============================================================================

describe('handleStartBattleMapEncounter', () => {
  it('dispatches a declared source gap with no prepared enemy roster', async () => {
    const dispatch = vi.fn() as unknown as Dispatch<AppAction>;
    const sourceGap = createAuthoredTownWatchSourceGap('oakhaven', 'Town Guard');

    await handleStartBattleMapEncounter(dispatch, {
      monsters: [],
      sourceGap,
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'START_BATTLE_MAP_ENCOUNTER',
      payload: {
        startBattleMapEncounterData: {
          monsters: [],
          combatants: [],
          sourceGap,
        },
      },
    });
  });

  it('rejects any actor or map smuggled into a declared source gap', async () => {
    const dispatch = vi.fn() as unknown as Dispatch<AppAction>;
    const sourceGap = createAuthoredTownWatchSourceGap('oakhaven', 'Town Guard');

    await expect(handleStartBattleMapEncounter(dispatch, {
      monsters: [{ name: 'Guard', quantity: 2, cr: '1/8', description: 'Counterfeit roster' }],
      sourceGap,
    })).rejects.toThrow(/cannot include monsters, combatants, source identities, or extracted terrain/i);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('preserves prepared WorldForge combatants in the reducer payload', async () => {
    const dispatch = vi.fn() as unknown as Dispatch<AppAction>;
    const defender = {
      id: 'worldforge-defender:6:0:infantry:1',
      name: 'Turino Infantry 1',
      team: 'enemy',
      worldSource: {
        kind: 'worldforge-defender',
        burgId: 14,
        stateId: 6,
        regimentIndex: 0,
        unitType: 'infantry',
        representativeIndex: 1,
      },
    } as unknown as CombatCharacter;

    await handleStartBattleMapEncounter(dispatch, {
      monsters: [],
      combatants: [defender],
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: 'START_BATTLE_MAP_ENCOUNTER',
      payload: {
        startBattleMapEncounterData: {
          monsters: [],
          combatants: [defender],
        },
      },
    });
  });

  it('joins saved opening-scene identities to prepared actors in roster order', async () => {
    const dispatch = vi.fn() as unknown as Dispatch<AppAction>;
    const goblin = {
      id: 'opening-goblin-1',
      name: 'Goblin',
      team: 'enemy',
    } as unknown as CombatCharacter;
    const wolf = {
      id: 'opening-wolf-1',
      name: 'Wolf',
      team: 'enemy',
    } as unknown as CombatCharacter;
    const sources: WorldforgeCombatantSource[] = [
      {
        kind: 'worldforge-opening-threat',
        sceneReceiptId: 'worldforge-opening-scene:test',
        sourceOpeningReceiptId: 'opening:42:cell:829',
        entityId: 'opening:goblin:1',
        monsterName: 'Goblin',
        monsterOrdinal: 1,
        socialRole: 'contact-lead',
        worldGroundMeters: { x: 100, z: 200 },
      },
      {
        kind: 'worldforge-opening-threat',
        sceneReceiptId: 'worldforge-opening-scene:test',
        sourceOpeningReceiptId: 'opening:42:cell:829',
        entityId: 'opening:wolf:1',
        monsterName: 'Wolf',
        monsterOrdinal: 1,
        socialRole: 'scent-flanker',
        worldGroundMeters: { x: 106, z: 197 },
      },
    ];

    await handleStartBattleMapEncounter(dispatch, {
      monsters: [],
      combatants: [goblin, wolf],
      combatantWorldSources: sources,
    });

    const action = (dispatch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Extract<
      AppAction,
      { type: 'START_BATTLE_MAP_ENCOUNTER' }
    >;
    expect(action.payload.startBattleMapEncounterData.combatants).toEqual([
      { ...goblin, worldSource: sources[0] },
      { ...wolf, worldSource: sources[1] },
    ]);
  });

  it('fails closed when source identities cannot cover the prepared roster exactly', async () => {
    const dispatch = vi.fn() as unknown as Dispatch<AppAction>;
    const actor = {
      id: 'opening-goblin-1',
      name: 'Goblin',
      team: 'enemy',
    } as unknown as CombatCharacter;

    // A partial join would assign the wrong ecology and history to later actors.
    // Reject the encounter before the reducer can display counterfeit identities.
    await expect(handleStartBattleMapEncounter(dispatch, {
      monsters: [],
      combatants: [actor],
      combatantWorldSources: [],
    })).rejects.toThrow(/supplied 0 combatant sources for 1 prepared actors/i);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
