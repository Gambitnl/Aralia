import { describe, it, expect } from 'vitest';
import { shipTravelAvailability, shipVoyageFromDestination } from '../shipEmbark';
import type { Ship } from '@/types/naval';
import type { MultiModalRoute } from '@/systems/travel/multiModalRoute';

// ---------------------------------------------------------------------------
// Minimal Ship fixture
// ---------------------------------------------------------------------------

function makeShip(overrides: Partial<Ship> = {}): Ship {
  return {
    id: 'ship-1',
    name: 'The Wanderer',
    type: 'Sloop',
    size: 'Small',
    description: 'A nimble sloop',
    stats: {
      speed: 30,
      maneuverability: 2,
      hullPoints: 100,
      maxHullPoints: 100,
      armorClass: 12,
      cargoCapacity: 10,
      crewMin: 3,
      crewMax: 10,
    },
    crew: { members: [], averageMorale: 80, unrest: 0, quality: 'Average' },
    cargo: { items: [], totalWeight: 0, capacityUsed: 0, supplies: { food: 0, water: 0 } },
    modifications: [],
    weapons: [],
    flags: {},
    ...overrides,
  };
}

// Minimal segmented route fixture
function makeRoute(seaMiles: number): MultiModalRoute {
  return {
    cells: [0, 1, 2],
    points: [[0, 0], [5, 0], [10, 0]],
    segments: [{ kind: 'sea', points: [[0, 0], [10, 0]] }],
    miles: seaMiles,
    landMiles: 0,
    seaMiles,
    minutes: seaMiles * 10,
    danger: 0.2,
  };
}

// ---------------------------------------------------------------------------
// shipTravelAvailability
// ---------------------------------------------------------------------------

describe('shipTravelAvailability', () => {
  it('returns available=false with reason "No ship" when activeShip is null', () => {
    const result = shipTravelAvailability(null, 5);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('No ship');
  });

  it('returns available=false with reason "No ship" when activeShip is undefined', () => {
    const result = shipTravelAvailability(undefined, 5);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('No ship');
  });

  it('returns available=false with reason "Ship is not docked" when ship has no dockedPortBurgId', () => {
    const ship = makeShip({ dockedPortBurgId: undefined });
    const result = shipTravelAvailability(ship, 5);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Ship is not docked');
  });

  it('returns available=false with reason "Not at a port" when player is not standing at any port', () => {
    const ship = makeShip({ dockedPortBurgId: 7 });
    const result = shipTravelAvailability(ship, null);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Not at a port');
  });

  it('returns available=false with reason "Ship is docked elsewhere" when player is at a port but the ship is docked at a different one', () => {
    const ship = makeShip({ dockedPortBurgId: 7 });
    const result = shipTravelAvailability(ship, 12);
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Ship is docked elsewhere');
  });

  it('returns available=true with reason null when player is at the exact port the ship is docked at', () => {
    const ship = makeShip({ dockedPortBurgId: 7 });
    const result = shipTravelAvailability(ship, 7);
    expect(result.available).toBe(true);
    expect(result.reason).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// shipVoyageFromDestination
// ---------------------------------------------------------------------------

describe('shipVoyageFromDestination', () => {
  it('returns null when the destination cell has no burg', () => {
    const pack = {
      cells: { burg: [0, 0, 0] }, // cell 1 → burg 0 (falsy)
      burgs: [],
    };
    const result = shipVoyageFromDestination(1, pack, makeRoute(80));
    expect(result).toBeNull();
  });

  it('returns null when the destination burg is not a port', () => {
    const pack = {
      cells: { burg: [0, 3, 0] }, // cell 1 → burg 3
      burgs: [undefined, undefined, undefined, { cell: 1, port: 0 }], // burg 3 has port=0 (falsy)
    };
    const result = shipVoyageFromDestination(1, pack, makeRoute(80));
    expect(result).toBeNull();
  });

  it('returns null when the destination burg entry is missing from the burgs array', () => {
    const pack = {
      cells: { burg: [0, 5, 0] }, // cell 1 → burg 5, but burgs array is too short
      burgs: [undefined, undefined],
    };
    const result = shipVoyageFromDestination(1, pack, makeRoute(60));
    expect(result).toBeNull();
  });

  it('returns { destinationBurgId, seaMiles } when destination burg is a port', () => {
    const pack = {
      cells: { burg: [0, 4, 0] }, // cell 1 → burg 4
      burgs: [undefined, undefined, undefined, undefined, { cell: 1, port: 1 }],
    };
    const route = makeRoute(120);
    const result = shipVoyageFromDestination(1, pack, route);
    expect(result).toEqual({ destinationBurgId: 4, seaMiles: 120, danger: 0.2 });
  });

  it('seaMiles in result matches the segmented route seaMiles exactly', () => {
    const pack = {
      cells: { burg: [0, 0, 2] }, // cell 2 → burg 2
      burgs: [undefined, undefined, { cell: 2, port: 3 }],
    };
    const route = makeRoute(55.5);
    const result = shipVoyageFromDestination(2, pack, route);
    expect(result?.seaMiles).toBe(55.5);
  });
});
