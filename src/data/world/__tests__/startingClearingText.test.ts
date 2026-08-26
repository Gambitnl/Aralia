/**
 * @file src/data/world/__tests__/startingClearingText.test.ts
 * Pins the starting clearing's prose to the affordances the UI actually offers.
 *
 * agora-db71.29: the clearing used to read "Paths lead north, east, south, and
 * a well-trodden one heads west towards Aralia Town Center", but the grid
 * retirement removed the named-exit "Go <dir>" actions from
 * useActionGeneration. A new player therefore read a promise the Actions pane
 * could not keep. Overworld travel is the cell-native World Map, so the text
 * points there instead. This test fails if anyone re-adds directional travel
 * language without also re-adding the travel buttons.
 */
import { describe, expect, it } from 'vitest';
import { LOCATIONS, STARTING_LOCATION_ID } from '../locations';

/**
 * Phrases that promise the player can travel by naming a compass direction.
 * Matching is done on the whole description, so an incidental "north" used as
 * scenery ("the northern ridge") does not trip the guard.
 */
const DIRECTIONAL_TRAVEL_PROMISES = [
  /paths?\s+lead/i,
  /(?:^|\W)(?:go|head|travel|walk)\s+(?:north|south|east|west)\b/i,
  /(?:road|path|trail)\s+(?:leads?|heads?|runs?)\s+(?:north|south|east|west)\b/i,
];

describe('starting clearing description', () => {
  const clearing = LOCATIONS[STARTING_LOCATION_ID];

  it('resolves the starting location', () => {
    expect(clearing).toBeDefined();
    expect(clearing.id).toBe('clearing');
  });

  it('does not promise directional travel the action pane cannot offer', () => {
    for (const pattern of DIRECTIONAL_TRAVEL_PROMISES) {
      expect(
        pattern.test(clearing.baseDescription),
        `clearing description matched ${pattern} but named exits do not render as actions`
      ).toBe(false);
    }
  });

  it('points the player at the World Map, which is how overworld travel works', () => {
    expect(clearing.baseDescription).toMatch(/World Map/);
  });

  it('keeps the authored exit adjacency as data for gossip and routing', () => {
    // The exits are not retired as data — only their "Go <dir>" buttons were.
    // Removing them would break gossipLinks-adjacent world authoring.
    expect(Object.keys(clearing.exits)).toEqual(
      expect.arrayContaining(['North', 'East', 'South', 'West'])
    );
  });
});
