/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/world/__tests__/dungeonRumorsToWorldRumors.test.ts
 * Tests for the pure dungeon-rumor → WorldRumor converter (Pillar 2, Task 7).
 */
import { dungeonRumorsToWorldRumors } from '../dungeonRumorsToWorldRumors';
import type { BurgRumor } from '../../../systems/worldforge/dungeon/world/rumors';

const makeRumor = (over: Partial<BurgRumor> = {}): BurgRumor => ({
  sitePath: 'wf:7/burg:44/dungeon:sewer' as BurgRumor['sitePath'],
  dungeonName: 'The Kober Channels',
  text: 'They say the undercity flooded a generation back.',
  speakerBias: 'scholar',
  eventRef: 0,
  ...over,
});

describe('dungeonRumorsToWorldRumors', () => {
  it('maps every dungeon rumor to an event-type WorldRumor', () => {
    const rumors = dungeonRumorsToWorldRumors([makeRumor()], 100, 'coord_3_4');
    expect(rumors).toHaveLength(1);
    expect(rumors[0].type).toBe('event');
  });

  it('produces stable, unique ids derived from location + sitePath + eventRef', () => {
    const src = [makeRumor({ eventRef: 0 }), makeRumor({ eventRef: 2 })];
    const first = dungeonRumorsToWorldRumors(src, 50, 'coord_1_1');
    const second = dungeonRumorsToWorldRumors(src, 999, 'coord_1_1');

    // Ids do not depend on currentDay — stable across syncs, so ADD_RUMORS dedups.
    expect(first.map((r) => r.id)).toEqual(second.map((r) => r.id));
    expect(new Set(first.map((r) => r.id)).size).toBe(first.length);
    expect(first[0].id).toBe('dungeon-coord_1_1-wf:7/burg:44/dungeon:sewer-0');
    expect(first[1].id).toBe('dungeon-coord_1_1-wf:7/burg:44/dungeon:sewer-2');
  });

  it('sets expiration to currentDay + 30, timestamp to currentDay', () => {
    const rumors = dungeonRumorsToWorldRumors([makeRumor()], 200, 'coord_0_0');
    expect(rumors[0].timestamp).toBe(200);
    expect(rumors[0].expiration).toBe(230);
  });

  it('carries text + locationId, and stays put (spreadDistance 0, virality 0)', () => {
    const rumors = dungeonRumorsToWorldRumors(
      [makeRumor({ text: 'The dead of the crypt do not lie quiet.' })],
      10,
      'coord_5_6',
    );
    expect(rumors[0].text).toBe('The dead of the crypt do not lie quiet.');
    expect(rumors[0].locationId).toBe('coord_5_6');
    expect(rumors[0].spreadDistance).toBe(0);
    expect(rumors[0].virality).toBe(0);
  });

  it('returns an empty array for no rumors', () => {
    expect(dungeonRumorsToWorldRumors([], 100, 'coord_0_0')).toEqual([]);
  });
});
