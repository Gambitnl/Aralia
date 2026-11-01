/**
 * @file townReducer.rumors.test.ts
 * The town rumor mill wiring (agora-049c): live deed actions become town talk,
 * and ADVANCE_TIME spreads that talk through the town sim's relationship web.
 *
 * `resolveTownForLocation` is mocked: the real one resolves the player's burg
 * through the FMG bridge atlas, which is a world-generation concern, not the
 * thing under test here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../../../types';
import { AppAction } from '../../actionTypes';
import { CrimeType } from '../../../types/crime';
import { createMockGameState } from '../../../utils/core';
import type { TownSimState } from '../../../systems/worldforge/townsim/types';
import type { TownRumor } from '../../../systems/intrigue/RumorMillSystem';

const resolveTownForLocation = vi.fn();

vi.mock('../../../systems/worldforge/townsim/chronicleForLocation', () => ({
  resolveTownForLocation: (...args: unknown[]) => resolveTownForLocation(...args),
}));

// Imported after the mock so the reducer binds the mocked resolver.
const { townReducer } = await import('../townReducer');

const BURG = 7;

function villager(occupantId: number, overrides: Record<string, unknown> = {}) {
  return {
    occupantId,
    name: `Villager ${occupantId}`,
    race: 'human',
    bornDay: -3000,
    parentIds: [],
    childIds: [],
    homePlotId: 1,
    wealth: 10,
    ...overrides,
  };
}

/** A tracked town with three living residents, all bonded to one another. */
function makeTown(): TownSimState {
  return {
    burgId: BURG,
    villagers: {
      1: villager(1),
      2: villager(2),
      3: villager(3),
    },
    chronicle: { burgId: BURG, events: [], nextEventId: 1 },
    agentDeepening: {
      economy: { priceIndex: 100, shopIncomeByPlot: {}, districtWealthByHomePlot: {}, lastUpdatedDay: 1 },
      relationships: {
        '1-2': { leftId: 1, rightId: 2, affinity: 90, contactDays: 60, status: 'friend', lastContactDay: 1 },
        '2-3': { leftId: 2, rightId: 3, affinity: 90, contactDays: 60, status: 'friend', lastContactDay: 1 },
        '1-3': { leftId: 1, rightId: 3, affinity: 90, contactDays: 60, status: 'friend', lastContactDay: 1 },
      },
      townEvents: { weather: 'mild', lastUpdatedDay: 1 },
    },
    lastSimDay: 1,
    nextVillagerId: 4,
  } as unknown as TownSimState;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = createMockGameState({
    worldSeed: 4242,
    currentLocationId: 'village-center',
    townSim: { [BURG]: makeTown() },
    ...overrides,
  });
  return base;
}

describe('townReducer — town rumor mill (agora-049c)', () => {
  beforeEach(() => {
    resolveTownForLocation.mockReset();
    resolveTownForLocation.mockReturnValue(makeTown());
  });

  it('turns a completed quest into town talk sourced from a resident witness', () => {
    const state = makeState({
      questLog: [
        { id: 'q1', title: 'the wolves at the mill', description: '', status: 'active', objectives: [] },
      ] as unknown as GameState['questLog'],
    });

    const result = townReducer(state, { type: 'COMPLETE_QUEST', payload: { questId: 'q1' } } as AppAction);

    expect(result.townRumors).toHaveLength(1);
    const rumor = result.townRumors![0];
    expect(rumor.kind).toBe('quest_completed');
    expect(rumor.text).toContain('the wolves at the mill');
    expect(rumor.sourceNpc).toMatch(/^villager_7_[123]$/);
    expect(rumor.reachedNpcs).toEqual([rumor.sourceNpc]);
    expect(rumor.locationId).toBe('village-center');
  });

  it('ignores a COMPLETE_QUEST for a quest that is not in the log', () => {
    const result = townReducer(makeState(), {
      type: 'COMPLETE_QUEST',
      payload: { questId: 'missing' },
    } as AppAction);

    expect(result).toEqual({});
  });

  it('produces no talk when the player is not standing in a tracked town', () => {
    resolveTownForLocation.mockReturnValue(undefined);

    const result = townReducer(makeState(), {
      type: 'COMMIT_CRIME',
      payload: { type: CrimeType.Theft, locationId: 'village-center', severity: 6, witnessed: true },
    } as AppAction);

    expect(result).toEqual({});
  });

  it('keeps an unwitnessed crime out of the rumor mill', () => {
    const result = townReducer(makeState(), {
      type: 'COMMIT_CRIME',
      payload: { type: CrimeType.Theft, locationId: 'village-center', severity: 6, witnessed: false },
    } as AppAction);

    expect(result).toEqual({});
  });

  it('turns a witnessed crime into negative talk weighted by severity', () => {
    const result = townReducer(makeState(), {
      type: 'COMMIT_CRIME',
      payload: { type: CrimeType.Murder, locationId: 'village-center', severity: 9, witnessed: true },
    } as AppAction);

    expect(result.townRumors).toHaveLength(1);
    const rumor = result.townRumors![0];
    expect(rumor.kind).toBe('crime');
    expect(rumor.tone).toBe('negative');
    expect(rumor.text).toContain('the murder');
    // severity 9 normalizes to 90/100 on the canonical crime scale.
    expect(rumor.weight).toBeCloseTo(0.9);
  });

  it('is idempotent for the same deed on the same day', () => {
    const state = makeState({
      questLog: [
        { id: 'q1', title: 'the wolves at the mill', description: '', status: 'active', objectives: [] },
      ] as unknown as GameState['questLog'],
    });
    const action = { type: 'COMPLETE_QUEST', payload: { questId: 'q1' } } as AppAction;

    const first = townReducer(state, action);
    const second = townReducer({ ...state, townRumors: first.townRumors }, action);

    expect(second).toEqual({});
  });

  it('spreads talk along the relationship web when ADVANCE_TIME crosses a day', () => {
    const day = 1;
    const rumor: TownRumor = {
      id: 'rumor_test_1',
      text: 'They say the stranger did something.',
      sourceNpc: 'villager_7_1',
      spreadDay: day,
      reachedNpcs: ['villager_7_1'],
      tone: 'negative',
      kind: 'crime',
      virality: 1,
      weight: 1,
      lastSpreadDay: day,
      subject: 'the stranger',
      locationId: 'village-center',
    };
    const base = makeState({ townRumors: [rumor] });
    // ADVANCE_TIME reaches this reducer with gameTime ALREADY advanced.
    const advanced: GameState = {
      ...base,
      gameTime: new Date(base.gameTime.getTime() + 2 * 24 * 60 * 60 * 1000),
    };

    const result = townReducer(advanced, {
      type: 'ADVANCE_TIME',
      payload: { seconds: 2 * 24 * 60 * 60 },
    } as AppAction);

    expect(result.townRumors).toHaveLength(1);
    // virality 1 on strong ties over two days reaches the rest of the town.
    expect(result.townRumors![0].reachedNpcs.length).toBeGreaterThan(1);
    expect(result.townRumors![0].reachedNpcs.every((id) => id.startsWith('villager_7_'))).toBe(true);
  });

  it('does nothing on an ADVANCE_TIME that stays inside the same day', () => {
    const rumor: TownRumor = {
      id: 'rumor_test_1',
      text: 'They say the stranger did something.',
      sourceNpc: 'villager_7_1',
      spreadDay: 1,
      reachedNpcs: ['villager_7_1'],
      tone: 'neutral',
      kind: 'custom',
      virality: 1,
      weight: 1,
      lastSpreadDay: 1,
      subject: 'the stranger',
      locationId: 'village-center',
    };

    const base = makeState({ townRumors: [rumor] });
    // Midday, so a one-minute tick cannot cross a day boundary.
    const midday: GameState = {
      ...base,
      gameTime: new Date(base.gameTime.getTime() + 12 * 60 * 60 * 1000),
    };

    const result = townReducer(midday, {
      type: 'ADVANCE_TIME',
      payload: { seconds: 60 },
    } as AppAction);

    expect(result).toEqual({});
  });

  it('leaves the temple modal actions untouched', () => {
    const result = townReducer(makeState(), { type: 'CLOSE_TEMPLE' } as AppAction);
    expect(result.templeModal).toEqual({ isOpen: false, temple: null });
  });

  describe('quest completion gossip and duplicate prevention (GG-463)', () => {
    it('turns a quest completed via UPDATE_QUEST_OBJECTIVE into town talk', () => {
      const state = makeState({
        questLog: [
          {
            id: 'q_auto',
            title: 'clear the cellar',
            description: '',
            status: 'active',
            objectives: [
              { id: 'obj_1', description: 'kill rats', isCompleted: false },
              { id: 'obj_2', description: 'speak to barkeep', isCompleted: true },
            ],
          },
        ] as unknown as GameState['questLog'],
      });

      const action = {
        type: 'UPDATE_QUEST_OBJECTIVE',
        payload: { questId: 'q_auto', objectiveId: 'obj_1', isCompleted: true },
      } as AppAction;

      const result = townReducer(state, action);
      expect(result.townRumors).toHaveLength(1);
      const rumor = result.townRumors![0];
      expect(rumor.id).toBe('rumor_quest_q_auto');
      expect(rumor.kind).toBe('quest_completed');
      expect(rumor.text).toContain('clear the cellar');
    });

    it('produces no talk when an objective update leaves remaining incomplete objectives', () => {
      const state = makeState({
        questLog: [
          {
            id: 'q_partial',
            title: 'find the lost ring',
            description: '',
            status: 'active',
            objectives: [
              { id: 'obj_1', description: 'search well', isCompleted: false },
              { id: 'obj_2', description: 'return ring', isCompleted: false },
            ],
          },
        ] as unknown as GameState['questLog'],
      });

      const action = {
        type: 'UPDATE_QUEST_OBJECTIVE',
        payload: { questId: 'q_partial', objectiveId: 'obj_1', isCompleted: true },
      } as AppAction;

      const result = townReducer(state, action);
      expect(result).toEqual({});
    });

    it('does not add a duplicate deed when COMPLETE_QUEST is repeated or quest was already completed', () => {
      const completedState = makeState({
        questLog: [
          {
            id: 'q_done',
            title: 'defend the bridge',
            description: '',
            status: 'Completed',
            objectives: [{ id: 'obj_1', description: 'hold line', isCompleted: true }],
          },
        ] as unknown as GameState['questLog'],
      });

      const completeAction = {
        type: 'COMPLETE_QUEST',
        payload: { questId: 'q_done' },
      } as AppAction;

      const result = townReducer(completedState, completeAction);
      expect(result).toEqual({});

      // Also if a rumor with rumor_quest_q_done already exists in townRumors:
      const stateWithExistingRumor = makeState({
        questLog: [
          {
            id: 'q_done',
            title: 'defend the bridge',
            description: '',
            status: 'active',
            objectives: [{ id: 'obj_1', description: 'hold line', isCompleted: true }],
          },
        ] as unknown as GameState['questLog'],
        townRumors: [
          {
            id: 'rumor_quest_q_done',
            kind: 'quest_completed',
            text: 'They say the stranger defended the bridge.',
            sourceNpc: 'villager_7_1',
            spreadDay: 0,
            reachedNpcs: ['villager_7_1'],
            tone: 'positive',
            virality: 1,
            weight: 1,
            lastSpreadDay: 0,
            subject: 'the stranger',
            locationId: 'village-center',
          },
        ],
      });

      const duplicateResult = townReducer(stateWithExistingRumor, completeAction);
      expect(duplicateResult).toEqual({});

      const updateAction = {
        type: 'UPDATE_QUEST_OBJECTIVE',
        payload: { questId: 'q_done', objectiveId: 'obj_1', isCompleted: true },
      } as AppAction;
      const updateDuplicateResult = townReducer(stateWithExistingRumor, updateAction);
      expect(updateDuplicateResult).toEqual({});
    });
  });
});
