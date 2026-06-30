import { getGameDay } from '../../../../utils/core';
import { createMockGameState } from '../../../../utils/core/factories';
import { getTownTilesForGrid } from '../../bridge/legacySubmapBridge';
import { buildTownSimStateForBurg } from '../townSimRegistration';
import { advanceTown } from '../townSimRegistry';
import { townChronicleForLocation, burgIdForLocation } from '../chronicleForLocation';

const SEED = 12345;
const COLS = 96;
const ROWS = 96;
const firstTile = getTownTilesForGrid(SEED, COLS, ROWS)[0];

describe('burgIdForLocation', () => {
  it('resolves a town tile to its burgId regardless of tracking', () => {
    expect(
      burgIdForLocation({
        currentLocationId: `coord_${firstTile.x}_${firstTile.y}`,
        worldSeed: SEED,
        gridSize: { cols: COLS, rows: ROWS },
      }),
    ).toBe(firstTile.burgId);
  });

  it('returns undefined for a static (non-coord) location', () => {
    expect(
      burgIdForLocation({ currentLocationId: 'clearing', worldSeed: SEED, gridSize: { cols: COLS, rows: ROWS } }),
    ).toBeUndefined();
  });

  it('returns undefined for a tile that holds no town', () => {
    expect(
      burgIdForLocation({ currentLocationId: 'coord_0_0', worldSeed: SEED, gridSize: { cols: COLS, rows: ROWS } }),
    ).toBeUndefined();
  });

  it('returns undefined when gridSize is missing', () => {
    expect(burgIdForLocation({ currentLocationId: 'coord_5_5', worldSeed: SEED })).toBeUndefined();
  });
});

describe('townChronicleForLocation', () => {
  it('returns recent chronicle lines when the player is in a tracked town', () => {
    const base = createMockGameState();
    const startDay = getGameDay(base.gameTime);
    // Advance the game clock 8 years and the town's sim to match.
    const advancedTime = new Date(base.gameTime.getTime() + 8 * 365 * 86400 * 1000);
    const currentDay = getGameDay(advancedTime);
    let town = buildTownSimStateForBurg(SEED, firstTile.burgId, startDay);
    town = advanceTown(town, SEED, currentDay);

    const lines = townChronicleForLocation({
      currentLocationId: `coord_${firstTile.x}_${firstTile.y}`,
      worldSeed: SEED,
      gridSize: { cols: COLS, rows: ROWS },
      townSim: { [firstTile.burgId]: town },
      gameTime: advancedTime,
    });
    expect(lines.length).toBeGreaterThan(0); // festivals alone guarantee yearly entries
    expect(lines.length).toBeLessThanOrEqual(4); // capped
  });

  it('returns [] for a non-coordinate (static) location', () => {
    const out = townChronicleForLocation({
      currentLocationId: 'clearing',
      worldSeed: SEED,
      gridSize: { cols: COLS, rows: ROWS },
      townSim: {},
      gameTime: new Date(),
    });
    expect(out).toEqual([]);
  });

  it('returns [] for a tile that holds no tracked town', () => {
    const out = townChronicleForLocation({
      currentLocationId: 'coord_0_0',
      worldSeed: SEED,
      gridSize: { cols: COLS, rows: ROWS },
      townSim: {},
      gameTime: new Date(),
    });
    expect(out).toEqual([]);
  });
});
