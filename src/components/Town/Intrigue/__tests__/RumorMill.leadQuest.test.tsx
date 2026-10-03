/**
 * @file RumorMill.leadQuest.test.tsx
 * Proof for agora-6820.4: buying a 'lead' rumor accepts the quest it points at,
 * so the quest lands in the log through the real ACCEPT_QUEST seam.
 *
 * The map-marker half of the old TODO is intentionally absent: MapMarker has no
 * reducer and no renderer, so there is nothing to dispatch a marker to.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TavernGossipSystem } from '../../../../systems/intrigue/TavernGossipSystem';
import type { PurchaseableRumor } from '../../../../systems/intrigue/TavernGossipSystem';
import { INITIAL_QUESTS } from '../../../../data/quests';
import { questReducer } from '../../../../state/reducers/questReducer';
import { createMockGameState } from '../../../../utils/core';
import type { Action } from '../../../../types';

vi.mock('../../../../state/GameContext', () => ({
  useGameState: () => ({ state: {} }),
}));

import { RumorMill } from '../RumorMill';

const LEAD: PurchaseableRumor = {
  id: 'lead_7',
  type: 'lead',
  cost: 10,
  title: 'Ask about work or trouble',
  content: "I heard there's an old ruin to the north that's been glowing at night.",
  questId: 'explore_ruins',
};

const PLAIN_RUMOR: PurchaseableRumor = {
  id: 'gossip_1',
  type: 'rumor',
  cost: 2,
  title: 'Hear the latest gossip',
  content: 'The mill burned down.',
};

const renderMill = (rumors: PurchaseableRumor[], onAction: (action: Action) => void) => {
  vi.spyOn(TavernGossipSystem, 'getAvailableRumors').mockReturnValue(rumors);
  render(
    <RumorMill
      merchantName="Barkeep"
      playerGold={100}
      playerInventory={[]}
      onAction={onAction}
    />
  );
};

describe('RumorMill lead rumors (agora-6820.4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts the lead quest on purchase and lands it in the quest log', () => {
    const actions: Action[] = [];
    renderMill([LEAD], action => actions.push(action));

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(actions.map(a => a.type)).toEqual(['BUY_ITEM', 'ACCEPT_QUEST']);

    const accept = actions[1] as Extract<Action, { type: 'ACCEPT_QUEST' }>;
    expect(accept.payload).toBe(INITIAL_QUESTS['explore_ruins']);

    // Drive the real reducer so the proof is "the quest is in the log", not "an action was sent".
    const state = createMockGameState({ questLog: [] });
    const next = questReducer(state, accept as never);
    expect(next.questLog?.map(q => q.id)).toContain('explore_ruins');
  });

  it('does not start a quest for a rumor that is not a lead', () => {
    const actions: Action[] = [];
    renderMill([PLAIN_RUMOR], action => actions.push(action));

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(actions.map(a => a.type)).toEqual(['BUY_ITEM']);
  });
});
