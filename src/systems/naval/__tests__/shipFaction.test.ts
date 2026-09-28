import { describe, it, expect } from 'vitest';
import {
  CAMPAIGN_HOME_FACTION_ID,
  NEUTRAL_FACTION_STANDING,
  resolveShipFactionId,
  shipFactionStanding,
  withResolvedShipFaction,
} from '../shipFaction';
import { CrewManager } from '../CrewManager';
import type { Ship } from '../../../types/naval';
import type { PlayerFactionStanding } from '../../../types/factions';

/**
 * Ship.factionId was added after saves already existed (agora-db71.8), so every
 * hull must resolve to exactly one flag: the recorded one, the port it last tied
 * up at, or the campaign home faction.
 */
function shipWith(overrides: Partial<Ship> = {}): Ship {
  return {
    id: 'test-ship',
    name: 'Test Hull',
    type: 'Sloop',
    size: 'Medium',
    description: 'A test hull.',
    stats: {
      speed: 30, maneuverability: 0, hullPoints: 100, maxHullPoints: 100,
      armorClass: 12, cargoCapacity: 10, crewMin: 1, crewMax: 20,
    },
    crew: CrewManager.calculateCrewStats([]),
    cargo: { items: [], totalWeight: 0, capacityUsed: 0, supplies: { food: 10, water: 10 } },
    modifications: [],
    weapons: [],
    flags: {},
    ...overrides,
  };
}

const standing = (factionId: string, publicStanding: number): PlayerFactionStanding => ({
  factionId,
  publicStanding,
  secretStanding: 0,
  rankId: 'outsider',
  favorsOwed: 0,
  renown: 0,
  history: [],
});

const PORTS = { 7: 'house_vane', 12: 'iron_ledger' } as const;

describe('resolveShipFactionId', () => {
  it('keeps the flag the save already recorded', () => {
    const ship = shipWith({ factionId: 'unseen_hand', dockedPortBurgId: 7 });
    expect(resolveShipFactionId(ship, PORTS)).toBe('unseen_hand');
  });

  it('flags an unrecorded hull with the faction that holds its docked port', () => {
    const ship = shipWith({ dockedPortBurgId: 7 });
    expect(resolveShipFactionId(ship, PORTS)).toBe('house_vane');
  });

  it('falls to the campaign home faction when the hull has no port on record', () => {
    expect(resolveShipFactionId(shipWith(), PORTS)).toBe(CAMPAIGN_HOME_FACTION_ID);
  });

  it('falls to the campaign home faction when the registry does not know the port', () => {
    const ship = shipWith({ dockedPortBurgId: 999 });
    expect(resolveShipFactionId(ship, PORTS)).toBe(CAMPAIGN_HOME_FACTION_ID);
  });

  it('resolves every hull, so the mutiny check never asks whether a ship has a flag', () => {
    const hulls = [shipWith(), shipWith({ dockedPortBurgId: 7 }), shipWith({ factionId: 'ironhead_clan' })];
    for (const hull of hulls) {
      expect(typeof resolveShipFactionId(hull, PORTS)).toBe('string');
      expect(resolveShipFactionId(hull, PORTS).length).toBeGreaterThan(0);
    }
  });
});

describe('withResolvedShipFaction', () => {
  it('stamps the resolved flag onto an old save so the next write carries it', () => {
    const stamped = withResolvedShipFaction(shipWith({ dockedPortBurgId: 12 }), PORTS);
    expect(stamped.factionId).toBe('iron_ledger');
  });

  it('is idempotent: a stamped hull is returned untouched', () => {
    const ship = shipWith({ factionId: 'deepkings_guard' });
    expect(withResolvedShipFaction(ship, PORTS)).toBe(ship);
  });

  it('does not mutate the ship it is given', () => {
    const ship = shipWith({ dockedPortBurgId: 7 });
    withResolvedShipFaction(ship, PORTS);
    expect(ship.factionId).toBeUndefined();
  });
});

describe('shipFactionStanding', () => {
  it("reads the player's public standing with the flag the hull sails under", () => {
    const ship = shipWith({ factionId: 'unseen_hand' });
    const standings = { unseen_hand: standing('unseen_hand', -70) };
    expect(shipFactionStanding(ship, standings, PORTS)).toBe(-70);
  });

  it('reads the standing of the port faction for an unflagged hull', () => {
    const ship = shipWith({ dockedPortBurgId: 7 });
    const standings = { house_vane: standing('house_vane', 40) };
    expect(shipFactionStanding(ship, standings, PORTS)).toBe(40);
  });

  it('treats a faction with no standing record as neutral', () => {
    expect(shipFactionStanding(shipWith(), {}, PORTS)).toBe(NEUTRAL_FACTION_STANDING);
  });

  it('uses public standing, not the secret one — the deck grumbles about what it has heard', () => {
    const ship = shipWith({ factionId: 'iron_ledger' });
    const standings = { iron_ledger: { ...standing('iron_ledger', 10), secretStanding: -90 } };
    expect(shipFactionStanding(ship, standings, PORTS)).toBe(10);
  });
});
