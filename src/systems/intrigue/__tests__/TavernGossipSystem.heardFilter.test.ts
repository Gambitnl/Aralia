/**
 * @file TavernGossipSystem.heardFilter.test.ts
 * agora-5454: rumors the player has already bought are not offered again.
 * agora-049c: town talk that has actually spread is offered over the bar.
 */
import { describe, it, expect } from 'vitest';
import { TavernGossipSystem } from '../TavernGossipSystem';
import { createMockGameState } from '../../../utils/core';
import { ItemType, type Item, type WorldRumor } from '../../../types';
import type { TownRumor } from '../RumorMillSystem';
import { getGameDay } from '../../../utils/core/timeUtils';

function worldRumor(id: string, text: string): WorldRumor {
  return { id, text, type: 'misc', timestamp: 0, expiration: 9999 };
}

/** The Service receipt RumorMill.handlePurchase leaves behind for a bought offer. */
function receipt(offerId: string): Item {
  return {
    id: `rumor_${offerId}`,
    sourceId: offerId,
    name: 'Rumor',
    type: ItemType.Service,
    cost: '0',
    description: 'Purchased',
    weight: 0,
    icon: 'x',
  } as Item;
}

describe('TavernGossipSystem — already-heard filtering (agora-5454)', () => {
  it('offers a world rumor the player has not bought', () => {
    const state = createMockGameState({
      activeRumors: [worldRumor('r1', 'The bridge is out.')],
    });

    const offers = TavernGossipSystem.getAvailableRumors(state, 'Tavern');

    expect(offers.some((offer) => offer.id === 'gossip_r1')).toBe(true);
  });

  it('does not offer a rumor whose purchase receipt is in the inventory', () => {
    const state = createMockGameState({
      activeRumors: [worldRumor('r1', 'The bridge is out.')],
      inventory: [receipt('gossip_r1')],
    });

    const offers = TavernGossipSystem.getAvailableRumors(state, 'Tavern');

    expect(offers.some((offer) => offer.id === 'gossip_r1')).toBe(false);
  });

  it('offers the next unheard rumor once the first is bought', () => {
    const state = createMockGameState({
      activeRumors: [worldRumor('r1', 'The bridge is out.'), worldRumor('r2', 'The miller is drunk.')],
      inventory: [receipt('gossip_r1')],
    });

    const offers = TavernGossipSystem.getAvailableRumors(state, 'Tavern');

    expect(offers.some((offer) => offer.id === 'gossip_r2')).toBe(true);
  });

  it('falls back to the generic line once every rumor has been heard', () => {
    const state = createMockGameState({
      activeRumors: [worldRumor('r1', 'The bridge is out.')],
      inventory: [receipt('gossip_r1')],
    });

    const offers = TavernGossipSystem.getAvailableRumors(state, 'Tavern');
    const generic = offers.find((offer) => offer.id.startsWith('gossip_generic'));

    expect(generic).toBeDefined();
    expect(generic?.content).toContain('Not much happening');
  });

  it('ignores a receipt for a different offer', () => {
    const state = createMockGameState({
      activeRumors: [worldRumor('r1', 'The bridge is out.')],
      inventory: [receipt('gossip_somethingelse')],
    });

    const offers = TavernGossipSystem.getAvailableRumors(state, 'Tavern');

    expect(offers.some((offer) => offer.id === 'gossip_r1')).toBe(true);
  });
});

describe('TavernGossipSystem — town talk over the bar (agora-049c)', () => {
  function townRumor(state: ReturnType<typeof createMockGameState>, overrides: Partial<TownRumor> = {}): TownRumor {
    return {
      id: 'town1',
      text: 'They say the stranger put down something with too many teeth.',
      sourceNpc: 'villager_7_1',
      spreadDay: getGameDay(state.gameTime),
      reachedNpcs: ['villager_7_1', 'villager_7_2'],
      tone: 'positive',
      kind: 'combat_victory',
      virality: 0.45,
      weight: 0.6,
      lastSpreadDay: getGameDay(state.gameTime),
      subject: 'the stranger',
      locationId: state.currentLocationId,
      ...overrides,
    };
  }

  it('offers town talk that has been retold at least once', () => {
    const base = createMockGameState({ activeRumors: [] });
    const state = createMockGameState({ activeRumors: [], townRumors: [townRumor(base)] });

    const offers = TavernGossipSystem.getAvailableRumors(state, 'Tavern');
    const offer = offers.find((candidate) => candidate.id === 'gossip_town1');

    expect(offer).toBeDefined();
    expect(offer?.content).toContain('too many teeth');
  });

  it('does not offer talk only the witness knows', () => {
    const base = createMockGameState({ activeRumors: [] });
    const state = createMockGameState({
      activeRumors: [],
      townRumors: [townRumor(base, { reachedNpcs: ['villager_7_1'] })],
    });

    const offers = TavernGossipSystem.getAvailableRumors(state, 'Tavern');

    expect(offers.some((offer) => offer.id === 'gossip_town1')).toBe(false);
  });

  it('does not offer talk belonging to another town', () => {
    const base = createMockGameState({ activeRumors: [] });
    const state = createMockGameState({
      activeRumors: [],
      townRumors: [townRumor(base, { locationId: 'somewhere-else' })],
    });

    const offers = TavernGossipSystem.getAvailableRumors(state, 'Tavern');

    expect(offers.some((offer) => offer.id === 'gossip_town1')).toBe(false);
  });

  it('does not offer town talk the player already bought', () => {
    const base = createMockGameState({ activeRumors: [] });
    const state = createMockGameState({
      activeRumors: [],
      townRumors: [townRumor(base)],
      inventory: [receipt('gossip_town1')],
    });

    const offers = TavernGossipSystem.getAvailableRumors(state, 'Tavern');

    expect(offers.some((offer) => offer.id === 'gossip_town1')).toBe(false);
  });
});
