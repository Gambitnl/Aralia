/**
 * @file src/systems/social/__tests__/npcWitnessMemory.test.ts
 * Integration tests for NPC Reaction Memory (agora-9712).
 *
 * These are integration tests, not unit tests: each one drives the REAL
 * `npcReducer` over a REAL `GameState.npcMemory` slice, and the second-hand test
 * drives the REAL `RumorMillSystem` spread rather than hand-building a rumor.
 * The point is to prove an observation survives the whole path an encounter
 * would actually use — dispatch, storage, decay, and read-back.
 */

import { describe, it, expect } from 'vitest';
import { npcReducer } from '../../../state/reducers/npcReducer';
import type { AppAction } from '../../../state/actionTypes';
import type { GameState } from '../../../types';
import { createEmptyMemory } from '../../../utils/world/memoryUtils';
import { buildProximityGraph } from '../../intrigue/RumorMillSystem';
import { getEmotionalMarkers, getEmotionalStanding } from '../npcEmotionalMemory';
import {
  buildWitnessDialogueContext,
  createWitnessedAct,
  deriveEncounterStance,
  deriveWitnessDispositionShift,
  getWitnessReputation,
  getWitnessedActs,
  learnFromRumors,
  spreadWitnessedActs,
  witnessWeight,
  WITNESS_HALF_LIFE_DAYS,
  type WitnessedAct,
} from '../npcWitnessMemory';

const BANDIT = 'npc-bandit-korr';
const BRUTE = 'npc-bandit-vesh';
const PRIEST = 'npc-priest-ilma';
const FARMER = 'npc-farmer-doss';

/** A minimal but real state slice: four NPCs with canonical empty memories. */
const makeState = (): GameState =>
  ({
    npcMemory: {
      [BANDIT]: createEmptyMemory(),
      [BRUTE]: createEmptyMemory(),
      [PRIEST]: createEmptyMemory(),
      [FARMER]: createEmptyMemory(),
    },
  }) as unknown as GameState;

/** Applies actions in sequence, folding each reducer patch back into state. */
const dispatchAll = (state: GameState, actions: AppAction[]): GameState =>
  actions.reduce((acc, action) => ({ ...acc, ...npcReducer(acc, action) }), state);

const saw = (npcId: string, act: WitnessedAct): AppAction => ({
  type: 'RECORD_NPC_WITNESSED_ACT',
  payload: { npcId, act },
});

describe('NPC Reaction Memory', () => {
  it('records combat outcomes through the reducer and turns mercy into a surrender stance', () => {
    // Day 4, in the square: two bandits watch the player win, then let the
    // beaten man live. Requirement (1): the outcome, not just the fight.
    const defeat = createWitnessedAct('defeated_foes', 4, {
      magnitude: 3,
      detail: 'guards',
      locationId: 'town-ashfen',
    });
    const mercy = createWitnessedAct('spared_surrendering', 4, {
      detail: 'the surrendering bandit',
      locationId: 'town-ashfen',
    });

    let state = dispatchAll(makeState(), [
      saw(BANDIT, defeat),
      saw(BANDIT, mercy),
      // The brute saw the same fight but only the killing part of it.
      saw(BRUTE, defeat),
      saw(
        BRUTE,
        createWitnessedAct('executed_surrendering', 4, { detail: 'a man on his knees' })
      ),
    ]);

    // The records really are on the state slice, and are per-NPC.
    const banditActs = getWitnessedActs(state.npcMemory[BANDIT]);
    expect(banditActs.map(a => a.observation)).toEqual(['defeated_foes', 'spared_surrendering']);
    expect(banditActs[0]).toMatchObject({ channel: 'firsthand', confidence: 1, magnitude: 3 });
    // Requirement (2)/(3) bridge: the mercy also planted a bond, via the
    // existing emotional-memory model rather than a second copy of it.
    expect(getEmotionalMarkers(state.npcMemory[BANDIT]).map(m => m.type)).toEqual(['bond']);
    expect(getEmotionalStanding(state.npcMemory[BANDIT], 4).bond).toBeGreaterThan(0);

    // Requirement (4): a later encounter reads differently for each witness.
    // The player was merciful but not yet terrifying, so this one bargains.
    const merciful = deriveEncounterStance(state.npcMemory[BANDIT], 6);
    expect(merciful.reputation.mercy).toBeGreaterThan(merciful.reputation.brutality);
    expect(merciful.stance).toBe('negotiate');
    expect(merciful.surrender).toBeGreaterThan(0);
    expect(merciful.negotiate).toBeGreaterThan(merciful.surrender);

    // Same mercy, far more demonstrated force: yielding beats bargaining once
    // the NPC believes they would lose the fight.
    const outmatched = dispatchAll(state, [
      saw(
        BANDIT,
        createWitnessedAct('defeated_foes', 5, { magnitude: 40, detail: 'of the baron\'s levy' })
      ),
    ]);
    const yielding = deriveEncounterStance(outmatched.npcMemory[BANDIT], 6);
    expect(yielding.reputation.prowess).toBeGreaterThan(merciful.reputation.prowess);
    expect(yielding.stance).toBe('surrender');
    expect(yielding.surrender).toBeGreaterThan(merciful.surrender);

    const terrified = deriveEncounterStance(state.npcMemory[BRUTE], 6);
    expect(terrified.reputation.brutality).toBeGreaterThan(terrified.reputation.mercy);
    expect(terrified.stance).toBe('flee');

    // ...and the same brutal memory becomes a last stand when there is nowhere
    // to run, instead of an impossible flee.
    const cornered = deriveEncounterStance(state.npcMemory[BRUTE], 6, { cornered: true });
    expect(cornered.stance).toBe('fight_to_death');
    expect(cornered.flee).toBe(0);
    expect(cornered.fightToDeath).toBeGreaterThan(terrified.fightToDeath);

    // An NPC who saw nothing is unmoved either way.
    expect(deriveEncounterStance(state.npcMemory[FARMER], 6).stance).toBe('stand_ground');
  });

  it('records social acts, feeds disposition and dialogue context, and fades with time', () => {
    // Requirement (2): the two social examples from the task, verbatim.
    let state = dispatchAll(makeState(), [
      saw(
        PRIEST,
        createWitnessedAct('donated_to_temple', 10, { magnitude: 100, detail: 'the temple' })
      ),
      saw(FARMER, createWitnessedAct('insulted_authority', 10, { detail: 'the magistrate' })),
    ]);

    // Requirement (3), disposition half: opposite signs from opposite acts.
    const priestShift = deriveWitnessDispositionShift(state.npcMemory[PRIEST], 11);
    const farmerShift = deriveWitnessDispositionShift(state.npcMemory[FARMER], 11);
    expect(priestShift).toBeGreaterThan(0);
    expect(farmerShift).toBeLessThan(0);

    // Requirement (3), dialogue half: prompt-ready lines in the NPC's mouth.
    expect(buildWitnessDialogueContext(state.npcMemory[PRIEST], 11)).toEqual([
      'I saw you give 100 to the temple.',
    ]);
    expect(buildWitnessDialogueContext(state.npcMemory[FARMER], 11)).toEqual([
      'I saw you insult the magistrate.',
    ]);

    // Memory fades: one half-life later the act counts for about half as much,
    // and the disposition it drives shrinks with it.
    const act = getWitnessedActs(state.npcMemory[PRIEST])[0];
    expect(witnessWeight(act, 10)).toBeCloseTo(1, 6);
    expect(witnessWeight(act, 10 + WITNESS_HALF_LIFE_DAYS)).toBeCloseTo(0.5, 6);
    expect(deriveWitnessDispositionShift(state.npcMemory[PRIEST], 10 + WITNESS_HALF_LIFE_DAYS))
      .toBeLessThan(priestShift);

    // Long after everyone has stopped caring, the maintenance pass forgets it.
    const stale = dispatchAll(state, [
      { type: 'PRUNE_NPC_WITNESSED_ACTS', payload: { gameDay: 10 + WITNESS_HALF_LIFE_DAYS * 6 } },
    ]);
    expect(getWitnessedActs(stale.npcMemory[PRIEST])).toHaveLength(0);
    // Pruning is per-NPC bookkeeping only; it must not disturb other slices.
    expect(Object.keys(stale.npcMemory)).toHaveLength(4);
  });

  it('carries an act to NPCs who were not there, as weaker second-hand knowledge', () => {
    // Requirement (5). The farmer alone sees the deed; the rumor mill (the real
    // one) carries it to the rest of the village over three days.
    const deed = createWitnessedAct('defeated_foes', 1, {
      detail: 'the goblins in the caves',
      locationId: 'village-mereholt',
    });

    let state = dispatchAll(makeState(), [saw(FARMER, deed)]);

    const graph = buildProximityGraph(
      [BANDIT, BRUTE, PRIEST, FARMER].map(id => ({ id, locationId: 'village-mereholt' }))
    );
    const { rumors, index } = spreadWitnessedActs(
      [deed],
      { [deed.id]: FARMER },
      graph,
      1,
      4,
      { subject: 'the stranger', seed: 7 }
    );

    // The talk really did travel through the shared engine.
    expect(rumors).toHaveLength(1);
    expect(rumors[0].reachedNpcs).toContain(PRIEST);

    // The priest learns it the way an NPC would: off the rumors they heard.
    const priestMemory = learnFromRumors(state.npcMemory[PRIEST], rumors, index, PRIEST, 4);
    const learned = getWitnessedActs(priestMemory);
    expect(learned).toHaveLength(1);
    expect(learned[0]).toMatchObject({
      observation: 'defeated_foes',
      channel: 'secondhand',
      hops: 1,
      toldBy: FARMER,
      // The act is dated when it HAPPENED, not when it was overheard.
      day: 1,
    });

    // The grammar is the feature: "I heard", not "I saw".
    expect(buildWitnessDialogueContext(priestMemory, 4)).toEqual([
      'I heard you defeat the goblins in the caves.',
    ]);

    // Hearsay is believed less than eyewitness, so it moves reputation less.
    expect(learned[0].confidence).toBeLessThan(1);
    expect(getWitnessReputation(priestMemory, 4).prowess).toBeLessThan(
      getWitnessReputation(state.npcMemory[FARMER], 4).prowess
    );

    // The eyewitness does not "learn" gossip about their own account, and an
    // eyewitness account is never downgraded by a weaker retelling of it.
    const farmerAfter = learnFromRumors(state.npcMemory[FARMER], rumors, index, FARMER, 4);
    expect(getWitnessedActs(farmerAfter)).toHaveLength(1);
    expect(getWitnessedActs(farmerAfter)[0].channel).toBe('firsthand');
  });

  it('lets a first-hand account overwrite an earlier rumor about the same event', () => {
    // An NPC who heard a garbled story and then saw the truth should end up with
    // one record, at full belief — not two contradictory ones.
    const heard = createWitnessedAct('slaughtered_helpless', 12, {
      channel: 'secondhand',
      magnitude: 2,
      detail: 'villagers',
    });
    const seen = createWitnessedAct('slaughtered_helpless', 12, {
      magnitude: 5,
      detail: 'villagers',
    });

    const state = dispatchAll(makeState(), [saw(PRIEST, heard), saw(PRIEST, seen)]);
    const acts = getWitnessedActs(state.npcMemory[PRIEST]);

    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ channel: 'firsthand', confidence: 1, magnitude: 5 });
    // The id of the original record is kept, so anything holding a reference to
    // it (a quest, a log entry) still resolves.
    expect(acts[0].id).toBe(heard.id);
  });
});
