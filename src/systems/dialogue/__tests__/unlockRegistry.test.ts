/**
 * @file src/systems/dialogue/__tests__/unlockRegistry.test.ts
 * Covers the DIAL-004 durable global unlock-fact registry.
 *
 * The four tests the task asks for are driven end to end rather than against
 * the pure helpers alone: every write goes through the REAL `factReducer` over
 * a REAL `initialGameState`, and the persistence test round-trips the state
 * through `JSON.stringify`/`JSON.parse` the way `saveLoadService` does. A test
 * that only exercised the helpers would pass even if the registry were never
 * wired to state or never serialized, which is the exact failure this task is
 * meant to rule out.
 *
 * Called by: focused Vitest runs for agora-7fe1.
 * Depends on: unlockRegistry.ts, state/reducers/factReducer.ts,
 *             dialogueGraphRuntime.ts, dialogueGraphTypes.ts.
 */
import { describe, it, expect } from 'vitest';

import {
  STANDARD_UNLOCK_FLAGS,
  canonicalUnlockFlag,
  clearUnlockFlag,
  createEmptyUnlockRegistry,
  getUnlockFlagValue,
  hasUnlockFlag,
  listStandardUnlockFlags,
  listUnlockFlags,
  setUnlockFlag,
  unlockActionsFromDialogueEffects,
  unlockFlagKey,
  unlockFlagsForDialogueContext,
  withUnlockFlags,
} from '../unlockRegistry';
import {
  applyDialogueEffects,
  evaluateDialogueCondition,
  getAvailableChoices,
} from '../dialogueGraphRuntime';
import type { DialogueGraph, DialogueNode } from '../dialogueGraphTypes';
import { factReducer } from '../../../state/reducers/factReducer';
import { initialGameState } from '../../../state/initialState';
import type { GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';

/** Applies one action through the real reducer and folds the slice back in. */
function reduce(state: GameState, action: AppAction): GameState {
  return { ...state, ...factReducer(state, action) };
}

// ---------------------------------------------------------------------------
// 1. setFlag round-trip
// ---------------------------------------------------------------------------

describe('unlock registry: setFlag round-trip', () => {
  it('sets, reads, and clears a flag through SET_UNLOCK_FLAG / CLEAR_UNLOCK_FLAG', () => {
    const flag = STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD;

    // A fresh game knows nothing.
    expect(hasUnlockFlag(initialGameState.worldFacts, flag)).toBe(false);

    const set = reduce(initialGameState, {
      type: 'SET_UNLOCK_FLAG',
      payload: { flag, sourceNpcId: 'npc_gatekeeper', sourceTopicId: 'ask_password', setAt: 1000 },
    });

    expect(hasUnlockFlag(set.worldFacts, flag)).toBe(true);
    expect(getUnlockFlagValue(set.worldFacts, flag)).toBe(true);

    // Provenance survives, and the flag is a fact under the reserved namespace
    // of the SAME durable store — not a second slice.
    const entry = listUnlockFlags(set.worldFacts).find((row) => row.flag === flag);
    expect(entry).toMatchObject({
      flag,
      isSet: true,
      sourceNpcId: 'npc_gatekeeper',
      sourceTopicId: 'ask_password',
      setAt: 1000,
    });
    expect(set.worldFacts?.facts[unlockFlagKey(flag)]).toBeDefined();

    // Re-setting the same flag with the same payload is a genuine no-op: the
    // reducer returns no slice at all, so nothing re-renders.
    expect(factReducer(set, { type: 'SET_UNLOCK_FLAG', payload: { flag } })).toEqual({});

    const cleared = reduce(set, { type: 'CLEAR_UNLOCK_FLAG', payload: { flag } });
    expect(hasUnlockFlag(cleared.worldFacts, flag)).toBe(false);
    expect(listUnlockFlags(cleared.worldFacts)).toHaveLength(0);

    // Clearing an unset flag is also a no-op.
    expect(factReducer(cleared, { type: 'CLEAR_UNLOCK_FLAG', payload: { flag } })).toEqual({});
  });

  it('carries a payload, updates it in place, and keeps the original unlock time', () => {
    const flag = STANDARD_UNLOCK_FLAGS.GAINED_FACTION_TRUST;
    const first = setUnlockFlag(createEmptyUnlockRegistry(), flag, {
      value: 'initiate',
      setAt: 500,
    });
    const second = setUnlockFlag(first, flag, { value: 'sworn', setAt: 9999 });

    expect(getUnlockFlagValue(second, flag)).toBe('sworn');
    // The moment of unlock is the durable part; only the tier moved.
    expect(second.facts[unlockFlagKey(flag)].learnedAt).toBe(500);
    // Same payload again returns the identical reference.
    expect(setUnlockFlag(second, flag, { value: 'sworn' })).toBe(second);
  });

  it('normalizes flag names and resolves the task body\'s misspelling', () => {
    // The DIAL-004 task text spells this flag `learnednpc_secret`; authored
    // content written against that text must still hit the canonical flag.
    expect(canonicalUnlockFlag('learnednpc_secret')).toBe(
      STANDARD_UNLOCK_FLAGS.LEARNED_NPC_SECRET,
    );
    expect(canonicalUnlockFlag('  Discovered_Hidden_Passage  ')).toBe(
      STANDARD_UNLOCK_FLAGS.DISCOVERED_HIDDEN_PASSAGE,
    );

    const registry = setUnlockFlag(createEmptyUnlockRegistry(), 'learnednpc_secret');
    expect(hasUnlockFlag(registry, STANDARD_UNLOCK_FLAGS.LEARNED_NPC_SECRET)).toBe(true);

    // All four standard flags are always inspectable, set or not.
    const standard = listStandardUnlockFlags(registry);
    expect(standard.map((row) => row.flag)).toEqual([
      'learned_secret_password',
      'discovered_hidden_passage',
      'gained_faction_trust',
      'learned_npc_secret',
    ]);
    expect(standard.filter((row) => row.isSet)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 2. save/load persistence
// ---------------------------------------------------------------------------

describe('unlock registry: save/load persistence', () => {
  it('survives the JSON round trip saveLoadService performs', () => {
    let state = initialGameState;
    state = reduce(state, {
      type: 'SET_UNLOCK_FLAG',
      payload: {
        flag: STANDARD_UNLOCK_FLAGS.DISCOVERED_HIDDEN_PASSAGE,
        value: 'undercroft',
        sourceNpcId: 'npc_smuggler',
        setAt: 2000,
      },
    });
    state = reduce(state, {
      type: 'SET_UNLOCK_FLAG',
      payload: { flag: STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD, setAt: 3000 },
    });

    // saveLoadService spreads the whole GameState into the payload and
    // JSON.stringifies it; this is that exact trip.
    const reloaded = JSON.parse(JSON.stringify({ ...state })) as GameState;

    expect(hasUnlockFlag(reloaded.worldFacts, STANDARD_UNLOCK_FLAGS.DISCOVERED_HIDDEN_PASSAGE)).toBe(true);
    expect(getUnlockFlagValue(reloaded.worldFacts, STANDARD_UNLOCK_FLAGS.DISCOVERED_HIDDEN_PASSAGE)).toBe('undercroft');
    expect(hasUnlockFlag(reloaded.worldFacts, STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD)).toBe(true);
    expect(hasUnlockFlag(reloaded.worldFacts, STANDARD_UNLOCK_FLAGS.GAINED_FACTION_TRUST)).toBe(false);
    expect(listUnlockFlags(reloaded.worldFacts)).toHaveLength(2);

    // A pre-DIAL-004 save has no store at all. It must load as an empty
    // registry rather than crashing, and must accept a write immediately.
    const legacy = { ...state, worldFacts: undefined } as GameState;
    expect(hasUnlockFlag(legacy.worldFacts, STANDARD_UNLOCK_FLAGS.LEARNED_NPC_SECRET)).toBe(false);
    expect(listUnlockFlags(legacy.worldFacts)).toEqual([]);
    const healed = reduce(legacy, {
      type: 'SET_UNLOCK_FLAG',
      payload: { flag: STANDARD_UNLOCK_FLAGS.LEARNED_NPC_SECRET },
    });
    expect(hasUnlockFlag(healed.worldFacts, STANDARD_UNLOCK_FLAGS.LEARNED_NPC_SECRET)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. dialogue condition check
// ---------------------------------------------------------------------------

describe('unlock registry: dialogue condition check', () => {
  const gatedNode: DialogueNode = {
    id: 'gate',
    speaker: 'npc',
    text: 'State your business.',
    choices: [
      { text: 'Nothing, sorry.', nextNodeId: 'leave' },
      {
        text: '"The heron flies at dusk."',
        nextNodeId: 'admitted',
        condition: {
          type: 'unlock_flag',
          params: { flag: STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD },
        },
      },
      {
        text: 'I have no idea what you want.',
        nextNodeId: 'leave',
        condition: {
          type: 'unlock_flag',
          params: { flag: STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD, negate: true },
        },
      },
    ],
  };

  it('gates a choice on a registry flag, in both directions', () => {
    const locked = initialGameState;
    const lockedContext = withUnlockFlags({ disposition: 0 }, locked.worldFacts);
    expect(getAvailableChoices(gatedNode, lockedContext).map((c) => c.nextNodeId)).toEqual([
      'leave',
      'leave',
    ]);

    const unlocked = reduce(locked, {
      type: 'SET_UNLOCK_FLAG',
      payload: { flag: STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD, sourceNpcId: 'npc_informant' },
    });
    const unlockedContext = withUnlockFlags({ disposition: 0 }, unlocked.worldFacts);

    // The registry flag reaches the graph's `flags` map...
    expect(unlockedContext.flags?.[STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD]).toBe(true);
    // ...the gated line opens, and the negated "I have no idea" line closes.
    expect(getAvailableChoices(gatedNode, unlockedContext).map((c) => c.nextNodeId)).toEqual([
      'leave',
      'admitted',
    ]);

    expect(
      evaluateDialogueCondition(
        { type: 'unlock_flag', params: { flag: STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD } },
        unlockedContext,
      ),
    ).toBe(true);

    // Clearing the flag re-locks the line — the registry, not the graph, owns
    // the truth, and a cleared flag must be ABSENT (not stored as false) for
    // the evaluator to agree.
    const recleared = reduce(unlocked, {
      type: 'CLEAR_UNLOCK_FLAG',
      payload: { flag: STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD },
    });
    const reclearedContext = withUnlockFlags({}, recleared.worldFacts);
    expect(reclearedContext.flags).toEqual({});
    expect(getAvailableChoices(gatedNode, reclearedContext).map((c) => c.nextNodeId)).toEqual([
      'leave',
      'leave',
    ]);
  });

  it('exposes flag payloads to the graph so a choice can branch on a tier', () => {
    const state = reduce(initialGameState, {
      type: 'SET_UNLOCK_FLAG',
      payload: { flag: STANDARD_UNLOCK_FLAGS.GAINED_FACTION_TRUST, value: 'sworn' },
    });
    expect(unlockFlagsForDialogueContext(state.worldFacts)).toEqual({
      gained_faction_trust: 'sworn',
    });
  });
});

// ---------------------------------------------------------------------------
// 4. dialogue effect set
// ---------------------------------------------------------------------------

describe('unlock registry: dialogue effect set', () => {
  const graph: DialogueGraph = {
    id: 'informant',
    startNodeId: 'tell',
    nodes: {
      tell: {
        id: 'tell',
        speaker: 'npc',
        text: 'The word is "heron". And there is a way in under the chapel.',
        effects: [
          {
            type: 'set_flag',
            params: { flag: STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD },
          },
          {
            type: 'set_flag',
            params: { flag: STANDARD_UNLOCK_FLAGS.DISCOVERED_HIDDEN_PASSAGE, value: 'chapel' },
          },
          // Malformed on purpose: the runtime marks it unapplied and the
          // bridge must not dispatch a broken write.
          { type: 'set_flag', params: {} },
          // Not our kind; the caller applies this one.
          { type: 'start_quest', params: { questId: 'q_undercroft' } },
        ],
      },
    },
  };

  it('turns graph set_flag effects into reducer writes the registry then serves back', () => {
    const run = applyDialogueEffects(graph.nodes.tell.effects, {});
    const actions = unlockActionsFromDialogueEffects(run.outcomes, {
      sourceNpcId: 'npc_informant',
      sourceTopicId: graph.id,
      setAt: 4242,
    });

    // Two valid set_flag effects in, two actions out; the malformed one and
    // the start_quest are correctly ignored.
    expect(actions).toHaveLength(2);
    expect(actions[0]).toEqual({
      type: 'SET_UNLOCK_FLAG',
      payload: {
        flag: STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD,
        value: true,
        sourceNpcId: 'npc_informant',
        sourceTopicId: 'informant',
        setAt: 4242,
      },
    });
    expect(actions[1].payload.value).toBe('chapel');

    const state = actions.reduce<GameState>((acc, action) => reduce(acc, action), initialGameState);

    expect(hasUnlockFlag(state.worldFacts, STANDARD_UNLOCK_FLAGS.LEARNED_SECRET_PASSWORD)).toBe(true);
    expect(getUnlockFlagValue(state.worldFacts, STANDARD_UNLOCK_FLAGS.DISCOVERED_HIDDEN_PASSAGE)).toBe('chapel');
    expect(listUnlockFlags(state.worldFacts).map((row) => row.sourceNpcId)).toEqual([
      'npc_informant',
      'npc_informant',
    ]);

    // Full loop: what the graph wrote is what a LATER conversation reads, and
    // it is still there after a save/reload.
    const reloaded = JSON.parse(JSON.stringify(state)) as GameState;
    const laterContext = withUnlockFlags({ disposition: 10 }, reloaded.worldFacts);
    expect(
      evaluateDialogueCondition(
        { type: 'unlock_flag', params: { flag: STANDARD_UNLOCK_FLAGS.DISCOVERED_HIDDEN_PASSAGE } },
        laterContext,
      ),
    ).toBe(true);
  });

  it('does not let a cleared flag linger in the registry', () => {
    let registry = setUnlockFlag(createEmptyUnlockRegistry(), 'temp_access', { value: 'day_pass' });
    expect(hasUnlockFlag(registry, 'temp_access')).toBe(true);
    registry = clearUnlockFlag(registry, 'temp_access');
    expect(registry.facts[unlockFlagKey('temp_access')]).toBeUndefined();
    expect(unlockFlagsForDialogueContext(registry)).toEqual({});
  });
});
