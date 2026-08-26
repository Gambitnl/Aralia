/**
 * @file src/systems/memory/__tests__/actionMemoryMatrix.test.ts
 * Tests for the action -> NPC memory mapping matrix (agora-1024).
 *
 * These are integration tests where it matters: the mapping is only worth
 * anything if the dispatches it emits survive the REAL `npcReducer` and land on
 * a REAL `GameState.npcMemory` slice, including the fan-out into the sibling
 * grudge/bond and witness systems. Pure-shape assertions are reserved for the
 * table numbers the task specifies verbatim.
 */

import { describe, it, expect } from 'vitest';
import { npcReducer } from '../../../state/reducers/npcReducer';
import type { AppAction } from '../../../state/actionTypes';
import type { GameState } from '../../../types';
import { createEmptyMemory } from '../../../utils/world/memoryUtils';
import { getEmotionalMarkers, getEmotionalStanding } from '../../social/npcEmotionalMemory';
import { getWitnessedActs } from '../../social/npcWitnessMemory';
import {
  ACTION_CATEGORIES,
  ACTION_MEMORY_MATRIX,
  applyActionMemory,
  buildActionMemoryDispatches,
  buildActionMemoryDispatchesForObservers,
  normalizeActionType,
  resolveActionMemory,
  resolveMemoryEffect,
  type ActionContext,
} from '../actionMemoryMatrix';

const GUARD = 'npc-guard-hallen';
const PRIEST = 'npc-priest-ilma';
const SMITH = 'npc-smith-orren';

const makeState = (): GameState =>
  ({
    npcMemory: {
      [GUARD]: createEmptyMemory(),
      [PRIEST]: createEmptyMemory(),
      [SMITH]: createEmptyMemory(),
    },
  }) as unknown as GameState;

const dispatchAll = (state: GameState, actions: AppAction[]): GameState =>
  actions.reduce((acc, action) => ({ ...acc, ...npcReducer(acc, action) }), state);

/** Runs an action through the matrix and the reducer in one step. */
const act = (state: GameState, context: ActionContext): GameState =>
  dispatchAll(state, buildActionMemoryDispatches(context));

const baseContext = (overrides: Partial<ActionContext> & { actionType: string }): ActionContext => ({
  observerNpcId: GUARD,
  gameDay: 12,
  ...overrides,
});

describe('action-to-memory mapping matrix', () => {
  it('covers at least eight action types across combat, social and quest', () => {
    const keys = Object.keys(ACTION_MEMORY_MATRIX);
    expect(keys.length).toBeGreaterThanOrEqual(8);

    // Every row is categorized, and all three categories are populated.
    for (const key of keys) expect(ACTION_CATEGORIES[key]).toBeDefined();
    const categories = new Set(keys.map(key => ACTION_CATEGORIES[key]));
    expect([...categories].sort()).toEqual(['combat', 'quest', 'social']);

    // The eight the task names by number are all present.
    for (const named of ['hit', 'kill', 'spare', 'gift', 'insult', 'praise', 'complete', 'fail']) {
      expect(keys).toContain(named);
    }
  });

  it('produces the exact strength, lifespan and disposition the design specifies', () => {
    // The table numbers, asserted straight. If a later edit "tunes" one of these
    // silently, this is the test that says so.
    const expected: Record<string, [number, number, number]> = {
      // action        strength, lifespan, dispositionDelta
      hit: [3, 30, 0],
      kill: [8, 999, 0],
      spare: [5, 60, 0],
      gift: [4, 30, 10],
      insult: [6, 60, -15],
      praise: [3, 30, 5],
      complete: [7, 999, 20],
      fail: [5, 60, -10],
    };

    for (const [actionType, [strength, lifespan, dispositionDelta]] of Object.entries(expected)) {
      const effect = resolveMemoryEffect(baseContext({ actionType }));
      expect(effect, actionType).not.toBeNull();
      expect({ actionType, ...effect! }).toMatchObject({
        actionType,
        strength,
        lifespan,
        dispositionDelta,
      });
    }
  });

  it('renders the specified fact text and stores it on the NPC through the reducer', () => {
    const state = act(
      makeState(),
      baseContext({ actionType: 'hit', targetId: 'npc-drover', targetName: 'the drover' })
    );

    const facts = state.npcMemory[GUARD].knownFacts;
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      text: 'saw you attack the drover',
      strength: 3,
      lifespan: 30,
      source: 'witnessed',
      factKey: 'player_attacked_target',
      // `significance` mirrors `strength` so post-merge readers agree with
      // pre-merge ones; `confidence` is 1 because the guard saw it himself.
      significance: 3,
      confidence: 1,
    });
    // A fact-only combat action must not move disposition (see the note in the
    // matrix header about not double-counting the witness model's shift).
    expect(state.npcMemory[GUARD].disposition).toBe(0);
  });

  it('routes social and quest actions to disposition as well as facts', () => {
    let state = makeState();
    state = act(state, baseContext({ actionType: 'gift' }));
    expect(state.npcMemory[GUARD].disposition).toBe(10);

    state = act(state, baseContext({ actionType: 'complete', gameDay: 13 }));
    expect(state.npcMemory[GUARD].disposition).toBe(30);

    state = act(state, baseContext({ actionType: 'insult', gameDay: 14 }));
    expect(state.npcMemory[GUARD].disposition).toBe(15);

    state = act(state, baseContext({ actionType: 'fail', gameDay: 15 }));
    expect(state.npcMemory[GUARD].disposition).toBe(5);

    const texts = state.npcMemory[GUARD].knownFacts.map(f => f.text);
    expect(texts).toEqual([
      'received a gift from you',
      'completed a task for you',
      'was insulted by you',
      'failed a task for you',
    ]);
  });

  it('forwards to the witness catalog and lets that catalog own the grudge/bond', () => {
    // `spare` is an instance of the existing `spared_surrendering` observation,
    // so the act must land in `witnessedActs` and the bond must come from the
    // catalog's own derivation rather than a second copy in the matrix.
    const spared = resolveActionMemory(
      baseContext({ actionType: 'spare', targetId: 'npc-bandit', targetName: 'the bandit' })
    )!;
    expect(spared.witnessedAct?.observation).toBe('spared_surrendering');
    expect(spared.emotionalMarker).toBeNull();

    const state = act(
      makeState(),
      baseContext({ actionType: 'spare', targetId: 'npc-bandit', targetName: 'the bandit' })
    );

    expect(getWitnessedActs(state.npcMemory[GUARD]).map(a => a.observation)).toEqual([
      'spared_surrendering',
    ]);
    expect(getEmotionalMarkers(state.npcMemory[GUARD]).map(m => m.type)).toEqual(['bond']);
    expect(getEmotionalStanding(state.npcMemory[GUARD], 12).bond).toBeGreaterThan(0);
    // All three lanes moved off one action.
    expect(state.npcMemory[GUARD].knownFacts[0].text).toBe('saw you spare the bandit');
  });

  it('plants its own marker only where the witness catalog has no analog', () => {
    // A gift handed to one person is not a public deed, so there is no witness
    // observation — but `generous_gift` is exactly this event in the grudge/bond
    // catalog, and the bond must still be planted.
    const state = act(makeState(), baseContext({ actionType: 'gift' }));

    expect(getWitnessedActs(state.npcMemory[GUARD])).toHaveLength(0);
    const markers = getEmotionalMarkers(state.npcMemory[GUARD]);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ type: 'bond', trigger: 'generous_gift' });
  });

  it('reads a kill differently depending on how it happened', () => {
    const clean = resolveMemoryEffect(baseContext({ actionType: 'kill' }))!;
    expect(clean.witnessObservation).toBe('defeated_foes');
    // `defeated_foes` carries no emotion, so a clean kill leaves no grudge.
    expect(resolveActionMemory(baseContext({ actionType: 'kill' }))!.emotionalMarker).toBeNull();

    const executed = resolveMemoryEffect(
      baseContext({ actionType: 'kill', targetSurrendered: true })
    )!;
    expect(executed.witnessObservation).toBe('executed_surrendering');

    const slaughtered = resolveMemoryEffect(
      baseContext({ actionType: 'kill', targetHelpless: true })
    )!;
    expect(slaughtered.witnessObservation).toBe('slaughtered_helpless');

    // Killing someone the observer cared about is the catalog's `killed_friend`.
    const personal = act(
      makeState(),
      baseContext({
        actionType: 'kill',
        targetId: 'npc-brother',
        targetName: 'their brother',
        targetMatteredToObserver: true,
      })
    );
    const markers = getEmotionalMarkers(personal.npcMemory[GUARD]);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ type: 'grudge', trigger: 'killed_friend' });
    expect(getEmotionalStanding(personal.npcMemory[GUARD], 12).net).toBeLessThan(0);
    // The fact is permanent: a killing is never forgotten.
    expect(personal.npcMemory[GUARD].knownFacts[0]).toMatchObject({
      text: 'saw you kill their brother',
      strength: 8,
      lifespan: 999,
    });
  });

  it('weakens a second-hand account in every lane at once', () => {
    const firsthand = resolveActionMemory(baseContext({ actionType: 'gift' }))!;
    const hearsay = resolveActionMemory(
      baseContext({ actionType: 'gift', channel: 'secondhand', hops: 2 })
    )!;

    expect(firsthand.fact.confidence).toBe(1);
    expect(firsthand.fact.source).toBe('witnessed');
    expect(hearsay.fact.confidence).toBeLessThan(1);
    expect(hearsay.fact.source).toBe('gossip');
    // The bond it plants is weaker too, matching `emotionalMarkerFromWitnessedAct`.
    expect(hearsay.emotionalMarker!.intensity).toBeLessThan(
      firsthand.emotionalMarker!.intensity
    );
    // Strength and lifespan are properties of the EVENT, not of the telling,
    // so they do not move.
    expect(hearsay.fact.strength).toBe(firsthand.fact.strength);
    expect(hearsay.fact.lifespan).toBe(firsthand.fact.lifespan);
  });

  it('reinforces rather than duplicates when the same act repeats', () => {
    let state = makeState();
    const context = baseContext({ actionType: 'hit', targetId: 'npc-drover' });
    state = act(state, context);
    state = act(state, context);
    state = act(state, context);

    // One deterministic fact id, so repeats fold together instead of letting
    // three identical swings crowd out a murder when MAX_FACTS_PER_NPC trims
    // the list by strength.
    expect(state.npcMemory[GUARD].knownFacts).toHaveLength(1);

    // KNOWN DIVERGENCE between the two application paths, asserted so it cannot
    // drift silently. `applyActionMemory` goes through `learnFact`, which keys
    // on fact id, so the same act on a LATER day is a second, fresher memory:
    const direct = applyActionMemory(state.npcMemory[GUARD], { ...context, gameDay: 20 });
    expect(direct.knownFacts).toHaveLength(2);

    // ...while the `ADD_NPC_KNOWN_FACT` reducer de-duplicates on fact TEXT, so
    // the dispatch path drops the later telling and the memory keeps its
    // original day-12 lifespan. That is the reducer's pre-existing rule, not
    // this matrix's; reported as a cross-file follow-up rather than changed here.
    const viaDispatch = act(state, { ...context, gameDay: 20 });
    expect(viaDispatch.npcMemory[GUARD].knownFacts).toHaveLength(1);
    expect(viaDispatch.npcMemory[GUARD].knownFacts[0].timestamp).toBe(12);
  });

  it('fans one action out to every observer with its own memory', () => {
    const actions = buildActionMemoryDispatchesForObservers([GUARD, PRIEST, SMITH], {
      actionType: 'combat.kill',
      gameDay: 12,
      targetId: 'npc-thief',
      targetName: 'the thief',
      targetSurrendered: true,
      isPublic: true,
    });

    const state = dispatchAll(makeState(), actions);
    for (const npcId of [GUARD, PRIEST, SMITH]) {
      expect(state.npcMemory[npcId].knownFacts[0].text).toBe('saw you kill the thief');
      expect(getWitnessedActs(state.npcMemory[npcId])[0].observation).toBe(
        'executed_surrendering'
      );
      // The catalog's own grudge for an execution, planted once per observer.
      expect(getEmotionalMarkers(state.npcMemory[npcId]).map(m => m.type)).toEqual(['grudge']);
    }
    // Ids are per-observer, so nothing collides in a shared store.
    const ids = [GUARD, PRIEST, SMITH].map(id => state.npcMemory[id].knownFacts[0].id);
    expect(new Set(ids).size).toBe(3);
  });

  it('tolerates the naming styles used across the repo and ignores unmapped actions', () => {
    expect(normalizeActionType('combat:kill')).toBe('kill');
    expect(normalizeActionType('combat.kill')).toBe('kill');
    expect(normalizeActionType(' Kill ')).toBe('kill');

    expect(resolveMemoryEffect(baseContext({ actionType: 'quest:complete' })!)).toMatchObject({
      dispositionDelta: 20,
    });

    // An action with no row changes nothing, and says so by returning empties
    // rather than throwing — an unmapped action is normal, not an error.
    expect(resolveMemoryEffect(baseContext({ actionType: 'sneeze' }))).toBeNull();
    expect(buildActionMemoryDispatches(baseContext({ actionType: 'sneeze' }))).toEqual([]);
    const memory = createEmptyMemory();
    expect(applyActionMemory(memory, baseContext({ actionType: 'sneeze' }))).toBe(memory);
  });

  // -------------------------------------------------------------------------
  // The dialogue lanes (agora-f821.15)
  // -------------------------------------------------------------------------

  describe('dialogue lanes', () => {
    it('writes first contact with the numbers the hand-rolled call sites used', () => {
      // These four values are what `handleNpcInteraction` built by hand at three
      // separate call sites. The row exists to make them one fact, not three
      // copies that can drift apart.
      const effect = resolveMemoryEffect(baseContext({ actionType: 'met' }))!;
      expect(effect).toMatchObject({
        strength: 3,
        lifespan: 999,
        dispositionDelta: 0,
        factSource: 'direct',
        isPublic: true,
      });

      const state = act(
        makeState(),
        baseContext({ actionType: 'met', detail: 'the adventurer', timestamp: 1_750_000_000_000 }),
      );
      const [fact] = state.npcMemory[GUARD].knownFacts;
      expect(fact.text).toBe('Met the adventurer.');
      expect(fact.source).toBe('direct');
      expect(fact.isPublic).toBe(true);
      expect(fact.timestamp).toBe(1_750_000_000_000);
      expect(fact.factKey).toBe('player_met_npc');

      // First contact is bookkeeping, not a deed: no grudge, no bond, no witness
      // record and no disposition move.
      expect(getWitnessedActs(state.npcMemory[GUARD])).toHaveLength(0);
      expect(getEmotionalMarkers(state.npcMemory[GUARD])).toHaveLength(0);
      expect(state.npcMemory[GUARD].disposition).toBe(createEmptyMemory().disposition);
    });

    it('greeting the same NPC twice on one day reinforces one memory', () => {
      // GG-136: the reducer de-duplicates on TEXT, and the matrix id is
      // deterministic, so a repeated greeting must not append a second fact.
      let state = makeState();
      state = act(state, baseContext({ actionType: 'met', detail: 'the adventurer' }));
      state = act(state, baseContext({ actionType: 'met', detail: 'the adventurer' }));
      expect(state.npcMemory[GUARD].knownFacts).toHaveLength(1);
    });

    it('stores a conversation summary verbatim while the table owns everything else', () => {
      const summary = 'The stranger asked about the flooded mine and paid for the answer.';
      const state = act(
        makeState(),
        baseContext({
          actionType: 'converse',
          targetId: 'conv-19',
          detail: summary,
          timestamp: 1_750_000_000_000,
        }),
      );

      const [fact] = state.npcMemory[GUARD].knownFacts;
      // The summarizer owns the wording and nothing else.
      expect(fact.text).toBe(summary);
      expect(fact.strength).toBe(4);
      expect(fact.lifespan).toBe(999);
      expect(fact.source).toBe('direct');
      expect(fact.isPublic).toBe(false);
      // Disposition is moved by the summary's own sentiment score at the call
      // site, so the table must not move it a second time.
      expect(state.npcMemory[GUARD].disposition).toBe(createEmptyMemory().disposition);
    });

    it('keeps two conversations with the same NPC on the same day distinct', () => {
      // Without the conversation id in `targetId` both facts resolve to the same
      // `actionFactId` and `learnFact` drops the second one.
      let memory = createEmptyMemory();
      memory = applyActionMemory(
        memory,
        baseContext({ actionType: 'converse', targetId: 'conv-1', detail: 'Talked about the road.' }),
      );
      memory = applyActionMemory(
        memory,
        baseContext({ actionType: 'converse', targetId: 'conv-2', detail: 'Talked about the well.' }),
      );
      expect(memory.knownFacts).toHaveLength(2);
      expect(new Set(memory.knownFacts.map(fact => fact.id)).size).toBe(2);
    });
  });
});
