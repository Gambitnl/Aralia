/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/world/__tests__/chronicleNewsToRumors.test.ts
 * Tests for the pure chronicle-news → WorldRumor converter.
 */

import { chronicleNewsToRumors } from '../chronicleNewsToRumors';
import type { TownNewsItem } from '../../../systems/worldforge/townsim/townNews';

const makeNews = (over: Partial<TownNewsItem> = {}): TownNewsItem => ({
  id: 1,
  day: 100,
  kind: 'economy',
  prominence: 'notice',
  text: 'The market thrived this season.',
  ...over,
});

describe('chronicleNewsToRumors', () => {
  it('maps event kinds to rumor types correctly', () => {
    const news: TownNewsItem[] = [
      makeNews({ id: 1, kind: 'economy' }),
      makeNews({ id: 2, kind: 'disaster' }),
      makeNews({ id: 3, kind: 'death' }),
      makeNews({ id: 4, kind: 'role_succession' }),
      makeNews({ id: 5, kind: 'birth' }),
      makeNews({ id: 6, kind: 'festival' }),
      makeNews({ id: 7, kind: 'marriage' }),
    ];

    const rumors = chronicleNewsToRumors(news, 100, 'coord_3_4');
    const byId = Object.fromEntries(rumors.map((r) => [r.id, r.type]));

    expect(byId['chronicle-coord_3_4-1']).toBe('market'); // economy
    expect(byId['chronicle-coord_3_4-2']).toBe('event'); // disaster
    expect(byId['chronicle-coord_3_4-3']).toBe('event'); // death
    expect(byId['chronicle-coord_3_4-4']).toBe('event'); // role_succession
    expect(byId['chronicle-coord_3_4-5']).toBe('misc'); // birth
    expect(byId['chronicle-coord_3_4-6']).toBe('misc'); // festival
    expect(byId['chronicle-coord_3_4-7']).toBe('misc'); // marriage
  });

  it('produces stable, unique ids derived from locationId + event id', () => {
    const news: TownNewsItem[] = [makeNews({ id: 11 }), makeNews({ id: 22 })];

    const first = chronicleNewsToRumors(news, 50, 'coord_1_1');
    const second = chronicleNewsToRumors(news, 999, 'coord_1_1');

    // Stable across calls/days (id does not depend on currentDay).
    expect(first.map((r) => r.id)).toEqual(second.map((r) => r.id));
    // Unique per event.
    expect(new Set(first.map((r) => r.id)).size).toBe(first.length);
    expect(first[0].id).toBe('chronicle-coord_1_1-11');
    expect(first[1].id).toBe('chronicle-coord_1_1-22');
  });

  it('sets expiration to currentDay + 30 and timestamp to the event day', () => {
    const rumors = chronicleNewsToRumors([makeNews({ id: 1, day: 120 })], 200, 'coord_0_0');
    expect(rumors[0].timestamp).toBe(120);
    expect(rumors[0].expiration).toBe(230);
  });

  it('maps prominence tiers to the correct virality', () => {
    const news: TownNewsItem[] = [
      makeNews({ id: 1, prominence: 'headline' }),
      makeNews({ id: 2, prominence: 'notice' }),
      makeNews({ id: 3, prominence: 'gossip' }),
    ];
    const rumors = chronicleNewsToRumors(news, 0, 'coord_2_2');

    expect(rumors[0].virality).toBe(0.9); // headline
    expect(rumors[1].virality).toBe(0.6); // notice
    expect(rumors[2].virality).toBe(0.3); // gossip
  });

  it('carries text, locationId, and spreadDistance=0 onto each rumor', () => {
    const rumors = chronicleNewsToRumors(
      [makeNews({ id: 7, text: 'A new harbormaster took office.' })],
      10,
      'coord_5_6',
    );
    expect(rumors[0].text).toBe('A new harbormaster took office.');
    expect(rumors[0].locationId).toBe('coord_5_6');
    expect(rumors[0].spreadDistance).toBe(0);
  });

  it('returns an empty array for empty news', () => {
    expect(chronicleNewsToRumors([], 100, 'coord_0_0')).toEqual([]);
  });
});
