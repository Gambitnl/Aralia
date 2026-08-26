/**
 * @file townSituationResolution.test.ts — Root-pipeline integration proof.
 *
 * One player decision must write every durable consequence together: canonical
 * town history, prosperity, purse, feedback, and the player's regional fact.
 * Replaying the same action must not duplicate any of those surfaces.
 */

import { describe, expect, it } from 'vitest';
import { appReducer } from '../../appState';
import type { AppAction } from '../../actionTypes';
import { createMockGameState } from '../../../utils/core/factories';
import { hasWorldFact } from '../../../systems/facts/worldFactStore';
import { townSituationKey } from '../../../systems/worldforge/townsim/townSituation';
import type { TownSimState } from '../../../systems/worldforge/townsim/types';

function trackedTown(): TownSimState {
  return {
    burgId: 3,
    villagers: {},
    chronicle: {
      burgId: 3,
      events: [
        {
          id: 7,
          day: 1,
          kind: 'disaster',
          subjectId: 0,
          relatedIds: [],
          summary: 'Floodwater damaged the riverside storehouses.',
        },
      ],
      nextEventId: 8,
    },
    prosperity: 50,
    lastSimDay: 1,
    nextVillagerId: 1,
  };
}

const fundAction: AppAction = {
  type: 'RESOLVE_TOWN_SITUATION',
  payload: { burgId: 3, sourceEventId: 7, resolutionId: 'fund_response' },
};

describe('RESOLVE_TOWN_SITUATION root transaction', () => {
  it('projects one canonical outcome across town, economy, feedback, and knowledge', () => {
    const base = createMockGameState({
      gold: 40,
      townSim: { 3: trackedTown() },
      messages: [],
    });
    const next = appReducer(base, fundAction);
    const key = townSituationKey(3, 7);
    const outcome = next.townSim?.[3].chronicle.events.at(-1);

    expect(next.gold).toBe(15);
    expect(next.townSim?.[3].prosperity).toBe(55);
    expect(outcome).toMatchObject({
      kind: 'player_intervention',
      provenance: { sourceKey: key, resolutionId: 'fund_response' },
    });
    expect(next.messages.at(-1)?.text).toBe(outcome?.summary);
    expect(hasWorldFact(next.worldFacts, key)).toBe(true);
    expect(next.worldFacts?.facts[key]).toMatchObject({
      value: 'fund_response',
      scope: 'region',
      regionId: 'burg:3',
    });
  });

  it('does not duplicate consequences when the action is replayed', () => {
    const base = createMockGameState({
      gold: 40,
      townSim: { 3: trackedTown() },
      messages: [],
    });
    const once = appReducer(base, fundAction);
    const replay = appReducer(once, fundAction);

    expect(replay.gold).toBe(once.gold);
    expect(replay.townSim?.[3].chronicle.events).toHaveLength(2);
    expect(replay.messages).toHaveLength(1);
    expect(Object.keys(replay.worldFacts?.facts ?? {})).toHaveLength(1);
  });

  it('fails closed when the player cannot afford the selected response', () => {
    const base = createMockGameState({
      gold: 10,
      townSim: { 3: trackedTown() },
      messages: [],
    });
    const next = appReducer(base, fundAction);

    expect(next.gold).toBe(10);
    expect(next.townSim?.[3].chronicle.events).toHaveLength(1);
    expect(next.messages).toHaveLength(0);
    expect(hasWorldFact(next.worldFacts, townSituationKey(3, 7))).toBe(false);
  });
});
