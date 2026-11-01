/**
 * @file src/utils/economy/__tests__/marketEvents.test.ts
 *
 * Tests for deterministic market events, template pricing, expiry, and coexistence
 * with trade-route events (agora-a047 / GG-444).
 *
 * What this tests:
 * 1. Pricing effects for all six defined templates in MARKET_EVENT_TEMPLATES
 *    (Bumper Harvest, War shortage, Magic Surge, Trade Fair, Plague Outbreak, Bandit Activity).
 * 2. Fallback pricing and factor derivation for all MarketEventType enum values
 *    (SHORTAGE, SURPLUS, BUST, FESTIVAL, WAR_TAX, BOOM).
 * 3. Deterministic day seeding and lifecycle expiry in generateMarketEvents.
 * 4. Coexistence of generated template events and route-generated events in
 *    the daily world tick without overwriting or dropped state.
 */

import { describe, it, expect } from 'vitest';
import {
  generateMarketEvents,
  MARKET_EVENT_TEMPLATES,
  calculateMarketFactors,
} from '../marketEvents';
import { calculatePrice } from '../economyUtils';
import { Item, ItemType } from '../../../types';
import { EconomyState, MarketEventType, MarketEvent } from '../../../types/economy';
import { processWorldEvents } from '../../../systems/world/WorldEventManager';
import { createMockGameState } from '../../core/factories';
import { processDailyRoutes } from '../../../systems/economy/TradeRouteManager';
import { INITIAL_TRADE_ROUTES } from '../../../data/tradeRoutes';
import { ALL_ITEMS } from '../../../data/items';
import type { SeededRandom } from '../../random';
import type { TradeRoute } from '../../../types/economy';

describe('Deterministic Market Events and Pricing (GG-444 / agora-a047)', () => {
  const baseEconomy: EconomyState = {
    marketEvents: [],
    tradeRoutes: [],
    globalInflation: 0,
    regionalWealth: {},
    marketFactors: { scarcity: [], surplus: [] },
    buyMultiplier: 1.0,
    sellMultiplier: 0.5,
    activeEvents: [],
  };

  const createMockItem = (overrides: Partial<Item>): Item => ({
    id: 'item_1',
    name: 'Standard Item',
    type: ItemType.Consumable,
    cost: '10 gp',
    costInGp: 10,
    weight: 1,
    description: 'A test item',
    ...overrides,
  });

  describe('Template pricing in calculatePrice', () => {
    it('Bumper Harvest (SURPLUS, 0.5x): halves buy price of food items', () => {
      const foodItem = createMockItem({ id: 'rations', name: 'Rations', type: ItemType.FoodDrink, costInGp: 10 });
      const harvestEvent: MarketEvent = {
        id: 'evt_harvest',
        name: 'Bumper Harvest',
        type: MarketEventType.SURPLUS,
        affectedCategories: ['food', 'ingredients'],
        priceModifier: 0.5,
        startTime: 0,
        duration: 7,
        intensity: 1.0,
      };

      const economy: EconomyState = {
        ...baseEconomy,
        marketEvents: [harvestEvent],
      };

      const result = calculatePrice(foodItem, economy, 'buy');
      // 10 gp * 1.0 buyMult * 0.5 priceModifier = 5 gp
      expect(result.finalPrice).toBe(5);
    });

    it('War shortage (SHORTAGE, 1.5x): increases weapon and armor buy prices by 50%', () => {
      const weapon = createMockItem({ id: 'longsword', name: 'Longsword', type: ItemType.Weapon, costInGp: 20 });
      const warEvent: MarketEvent = {
        id: 'evt_war',
        name: 'War shortage',
        type: MarketEventType.SHORTAGE,
        affectedCategories: ['weapon', 'armor', 'ammo'],
        priceModifier: 1.5,
        startTime: 0,
        duration: 14,
        intensity: 1.0,
      };

      const economy: EconomyState = {
        ...baseEconomy,
        marketEvents: [warEvent],
      };

      const result = calculatePrice(weapon, economy, 'buy');
      // 20 gp * 1.0 * 1.5 = 30 gp
      expect(result.finalPrice).toBe(30);
    });

    it('Magic Surge (SHORTAGE, 2.0x): doubles buy prices of potions and scrolls', () => {
      const scroll = createMockItem({ id: 'scroll_fireball', name: 'Scroll of Fireball', type: ItemType.Scroll, costInGp: 100 });
      const surgeEvent: MarketEvent = {
        id: 'evt_surge',
        name: 'Magic Surge',
        type: MarketEventType.SHORTAGE,
        affectedCategories: ['potion', 'scroll', 'magic_item'],
        priceModifier: 2.0,
        startTime: 0,
        duration: 5,
        intensity: 1.0,
      };

      const economy: EconomyState = {
        ...baseEconomy,
        marketEvents: [surgeEvent],
      };

      const result = calculatePrice(scroll, economy, 'buy');
      // 100 gp * 1.0 * 2.0 = 200 gp
      expect(result.finalPrice).toBe(200);
    });

    it('Trade Fair (FESTIVAL, 0.8x): discounts all goods by 20%', () => {
      const anyItem = createMockItem({ id: 'shield', name: 'Iron Shield', type: ItemType.Armor, costInGp: 50 });
      const fairEvent: MarketEvent = {
        id: 'evt_fair',
        name: 'Trade Fair',
        type: MarketEventType.FESTIVAL,
        affectedCategories: ['all'],
        priceModifier: 0.8,
        startTime: 0,
        duration: 3,
        intensity: 1.0,
      };

      const economy: EconomyState = {
        ...baseEconomy,
        marketEvents: [fairEvent],
      };

      const result = calculatePrice(anyItem, economy, 'buy');
      // 50 gp * 1.0 * 0.8 = 40 gp
      expect(result.finalPrice).toBe(40);
    });

    it('Plague Outbreak (BUST, 3.0x): triples buy price of medicine and potions', () => {
      const medicine = createMockItem({ id: 'healing_potion', name: 'Potion of Healing', type: ItemType.Potion, costInGp: 50 });
      const plagueEvent: MarketEvent = {
        id: 'evt_plague',
        name: 'Plague Outbreak',
        type: MarketEventType.BUST,
        affectedCategories: ['medicine', 'potion', 'herb'],
        priceModifier: 3.0,
        startTime: 0,
        duration: 10,
        intensity: 1.0,
      };

      const economy: EconomyState = {
        ...baseEconomy,
        marketEvents: [plagueEvent],
      };

      const result = calculatePrice(medicine, economy, 'buy');
      // 50 gp * 1.0 * 3.0 = 150 gp
      expect(result.finalPrice).toBe(150);
    });

    it('Bandit Activity (BUST, 1.2x): raises luxury goods prices by 20%', () => {
      const luxuryItem = createMockItem({ id: 'diamond_ring', name: 'Diamond Ring', type: ItemType.Treasure, costInGp: 100 });
      const banditEvent: MarketEvent = {
        id: 'evt_bandits',
        name: 'Bandit Activity',
        type: MarketEventType.BUST,
        affectedCategories: ['luxury', 'gold'],
        affectedTags: ['valuable'],
        priceModifier: 1.2,
        startTime: 0,
        duration: 7,
        intensity: 1.0,
      };

      const economy: EconomyState = {
        ...baseEconomy,
        marketEvents: [banditEvent],
      };

      const result = calculatePrice(luxuryItem, economy, 'buy');
      // 100 gp * 1.0 * 1.2 = 120 gp
      expect(result.finalPrice).toBe(120);
    });
  });

  describe('calculateMarketFactors coverage of all MarketEventTypes', () => {
    it('classifies SHORTAGE, BUST, and WAR_TAX as scarcity', () => {
      const events: MarketEvent[] = [
        { id: '1', type: MarketEventType.SHORTAGE, affectedTags: ['iron'], startTime: 0, duration: 1, intensity: 1 },
        { id: '2', type: MarketEventType.BUST, affectedCategories: ['medicine'], startTime: 0, duration: 1, intensity: 1 },
        { id: '3', type: MarketEventType.WAR_TAX, affectedTags: ['grain'], startTime: 0, duration: 1, intensity: 1 },
      ];

      const factors = calculateMarketFactors(events);
      expect(factors.scarcity).toContain('iron');
      expect(factors.scarcity).toContain('medicine');
      expect(factors.scarcity).toContain('grain');
      expect(factors.surplus).toEqual([]);
    });

    it('classifies SURPLUS, FESTIVAL, and BOOM as surplus', () => {
      const events: MarketEvent[] = [
        { id: '1', type: MarketEventType.SURPLUS, affectedTags: ['wood'], startTime: 0, duration: 1, intensity: 1 },
        { id: '2', type: MarketEventType.FESTIVAL, affectedCategories: ['wine'], startTime: 0, duration: 1, intensity: 1 },
        { id: '3', type: MarketEventType.BOOM, affectedTags: ['cloth'], startTime: 0, duration: 1, intensity: 1 },
      ];

      const factors = calculateMarketFactors(events);
      expect(factors.surplus).toContain('wood');
      expect(factors.surplus).toContain('wine');
      expect(factors.surplus).toContain('cloth');
      expect(factors.scarcity).toEqual([]);
    });
  });

  describe('generateMarketEvents determinism and expiry', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it('yields identical events for the same timestamp (deterministic day seeding)', () => {
      const timeA = 10 * DAY_MS;
      const timeB = 10 * DAY_MS + 3600000; // Same day, different hour

      const eventsA = generateMarketEvents(timeA);
      const eventsB = generateMarketEvents(timeB);

      expect(eventsA).toEqual(eventsB);
    });

    it('expires events once elapsed days exceed durationDays', () => {
      // Find a day that generates an event
      let startDay = 0;
      let targetEvent: ReturnType<typeof generateMarketEvents>[number] | undefined;

      for (let day = 1; day < 50; day++) {
        const events = generateMarketEvents(day * DAY_MS);
        const newlyBorn = events.find((e) => e.startTime === day * DAY_MS);
        if (newlyBorn) {
          startDay = day;
          targetEvent = newlyBorn;
          break;
        }
      }

      expect(targetEvent).toBeDefined();
      if (!targetEvent) return;

      const template = MARKET_EVENT_TEMPLATES.find((t) => t.name === targetEvent!.name);
      expect(template).toBeDefined();
      const duration = template!.durationDays;

      // During active days, it is present and remaining duration decrements
      const halfwayTime = (startDay + Math.floor(duration / 2)) * DAY_MS;
      const halfwayEvents = generateMarketEvents(halfwayTime);
      const ongoing = halfwayEvents.find((e) => e.id === targetEvent!.id);
      expect(ongoing).toBeDefined();
      expect(ongoing!.duration).toBe(duration - Math.floor(duration / 2));

      // After durationDays have elapsed, it is no longer present
      const expiredTime = (startDay + duration) * DAY_MS;
      const expiredEvents = generateMarketEvents(expiredTime);
      const missing = expiredEvents.find((e) => e.id === targetEvent!.id);
      expect(missing).toBeUndefined();
    });
  });

  describe('Coexistence with trade-route events in daily simulation', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it('preserves generated template events alongside route events in processWorldEvents', () => {
      const initialGameTime = new Date(15 * DAY_MS);

      const state = createMockGameState({
        gameTime: initialGameTime,
        economy: {
          ...baseEconomy,
          tradeRoutes: [
            {
              id: 'r_coexist',
              name: 'Coastal Run',
              originId: 'A',
              destinationId: 'B',
              goods: ['Salt'],
              status: 'blockaded',
              riskLevel: 0.5,
              profitability: 0.2,
              daysInStatus: 3,
            },
          ],
        },
      });

      const { state: updatedState } = processWorldEvents(state, 1);

      const activeEvents = updatedState.economy.marketEvents;
      expect(activeEvents).toBeDefined();

      // Route event should be present
      const routeEvents = activeEvents.filter((e) => e.id.startsWith('route_event_'));
      expect(routeEvents.length).toBeGreaterThan(0);
      expect(routeEvents.some((e) => e.id.includes('Salt') || e.id.includes('salt'))).toBe(true);

      // Deterministic template events (if any are active on day 15) should coexist
      const templateEvents = activeEvents.filter((e) => e.id.startsWith('evt_'));
      const generatedDirectly = generateMarketEvents(15 * DAY_MS);

      expect(templateEvents.length).toBe(generatedDirectly.length);
      for (const gen of generatedDirectly) {
        expect(activeEvents.some((e) => e.id === gen.id)).toBe(true);
      }
    });
  });

  describe('one price effect per route cause', () => {
    const salt = INITIAL_TRADE_ROUTES.find(route => route.id === 'route_salt_run')!;
    const ration = ALL_ITEMS.rations;
    const event = (good: string, intensity: number, direction: 'surplus' | 'scarcity' = 'surplus', route = salt): MarketEvent => ({
      id: 'route_event_' + route.id + '_' + good + '_' + direction,
      type: direction === 'surplus' ? MarketEventType.SURPLUS : MarketEventType.SHORTAGE,
      startTime: 0, duration: 1, intensity, affectedTags: [good],
    });
    const withEvents = (events: MarketEvent[], routes: TradeRoute[] = [salt]): EconomyState => ({
      ...baseEconomy, tradeRoutes: routes, marketEvents: events, activeEvents: events,
    });

    it('prices real production Salt Run food/consumable reports like the same cause with union tags', () => {
      const state = createMockGameState({ gameTime: new Date('0351-01-04T00:00:00.000Z'),
        economy: { ...baseEconomy, tradeRoutes: [{ ...salt, status: 'booming' }] } });
      const economy = processDailyRoutes(state, 1, { next: () => 0.999999 } as SeededRandom).state.economy;
      const snapshot = JSON.stringify(economy);
      const oneCause = withEvents([{ ...economy.marketEvents[0], affectedTags: ['salt', 'consumable', 'food'] }]);
      expect(economy.marketEvents.map(row => row.id)).toEqual([
        'route_event_route_salt_run_salt_surplus', 'route_event_route_salt_run_consumable_surplus', 'route_event_route_salt_run_food_surplus',
      ]);
      expect(calculatePrice(ration, oneCause, 'buy').finalPrice).toBe(0.22);
      expect(calculatePrice(ration, economy, 'buy')).toEqual(calculatePrice(ration, oneCause, 'buy'));
      expect(JSON.stringify(economy)).toBe(snapshot);
    });

    it.each([['buy', 0.35], ['sell', 0.13]] as const)('applies a single route surplus once when a %s item matches two categories', (kind, price) => {
      const economy = withEvents([event('food', 0.3), event('consumable', 0.3)]);
      expect(calculatePrice(ration, economy, kind).finalPrice).toBe(price);
    });

    it('chooses the strongest matching report, never an unrelated stronger commodity, in either report order', () => {
      const events = [event('salt', 0.9), event('consumable', 0.2), event('food', 0.4)];
      expect(calculatePrice(ration, withEvents(events), 'buy').finalPrice).toBe(0.3);
      expect(calculatePrice(ration, withEvents([...events].reverse()), 'buy').finalPrice).toBe(0.3);
    });

    it('preserves independent routes whose source IDs and commodity names contain underscores', () => {
      const first = { ...salt, id: 'route_with', goods: ['food', 'consumable', 'magic_item'] };
      const second = { ...salt, id: 'route_with_under', goods: ['food', 'consumable', 'magic_item'] };
      const events = [event('food', 0.2, 'surplus', first), event('consumable', 0.2, 'surplus', first),
        event('food', 0.3, 'surplus', second), event('consumable', 0.3, 'surplus', second)];
      expect(calculatePrice(ration, withEvents(events, [first, second]), 'buy').finalPrice).toBe(0.25);
    });

    it('retains opposite route directions as independent impacts', () => {
      const events = [event('food', 0.4, 'scarcity'), event('consumable', 0.4, 'scarcity'),
        event('food', 0.2), event('consumable', 0.2)];
      expect(calculatePrice(ration, withEvents(events), 'buy').multiplier).toBeCloseTo(1.2);
    });

    it('leaves unknown source reports independent even when their names and tags agree', () => {
      const events = [event('food', 0.2), event('consumable', 0.1)].map((row, index) => ({
        ...row, id: 'route_event_unknown_' + index, name: 'Shared display name',
      }));
      expect(calculatePrice(ration, withEvents(events), 'buy').finalPrice).toBe(0.35);
    });

    it('keeps the first cause position around an independent world multiplier when a later report is stronger', () => {
      const fair: MarketEvent = { id: 'evt_independent_fair', type: MarketEventType.FESTIVAL,
        startTime: 0, duration: 1, intensity: 1, affectedTags: ['all'], priceModifier: 0.8 };
      const events = [event('food', 0.2), fair, event('consumable', 0.4)];
      expect(calculatePrice(ration, withEvents(events), 'buy').finalPrice).toBe(0.24);
    });

    it('does not infer a single cause from ambiguous legacy source IDs', () => {
      const first = { ...salt, id: 'route_a', goods: ['b_food', 'consumable'] };
      const second = { ...salt, id: 'route_a_b', goods: ['food', 'consumable'] };
      const events = [event('food', 0.2, 'surplus', second), event('consumable', 0.2, 'surplus', second)];
      // The first report's ID also names first/b_food. Keep it independent.
      expect(calculatePrice(ration, withEvents(events, [first, second]), 'buy')).toEqual(
        calculatePrice(ration, withEvents(events, []), 'buy'));
    });
  });
});
