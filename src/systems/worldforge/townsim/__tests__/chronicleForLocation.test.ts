import { getGameDay } from '../../../../utils/core';
import { createMockGameState } from '../../../../utils/core/factories';
import { getTownTilesForGrid, getBridgeAtlas } from '../../bridge/legacySubmapBridge';
import { buildTownSimStateForBurg } from '../townSimRegistration';
import { advanceTown } from '../townSimRegistry';
import { townChronicleForLocation, burgIdForLocation, burgIdForCell } from '../chronicleForLocation';

const SEED = 12345;
const COLS = 96;
const ROWS = 96;
const firstTile = getTownTilesForGrid(SEED, COLS, ROWS)[0];
/** The atlas cell the first town's burg sits on — its canonical seat cell. */
const firstBurgCell = (getBridgeAtlas(SEED).pack.burgs as Array<{ cell?: number }>)[firstTile.burgId].cell!;

describe('burgIdForCell (cell-native town reader — grid retirement Phase A1)', () => {
  it('golden: a burg\'s own seat cell resolves back to that burg (matches the grid path)', () => {
    // The cell-native reader must agree with the legacy grid path for the
    // canonical case (player standing in their town) BEFORE we flip readers onto it.
    expect(burgIdForCell(SEED, firstBurgCell)).toBe(firstTile.burgId);
  });

  it('returns undefined for a cell that holds no burg', () => {
    // Cell 0 is the FMG border/no-burg cell; cells.burg there is 0.
    expect(burgIdForCell(SEED, 0)).toBeUndefined();
  });
});

describe('burgIdForLocation prefers the canonical cell when given one', () => {
  it('resolves the burg from cellId alone', () => {
    expect(
      burgIdForLocation({ worldSeed: SEED, cellId: firstBurgCell }),
    ).toBe(firstTile.burgId);
  });

  it('a non-burg cellId yields undefined', () => {
    // The canonical cell is authoritative: cell 0 seats no burg here.
    expect(
      burgIdForLocation({ worldSeed: SEED, cellId: 0 }),
    ).toBeUndefined();
  });
});

describe('burgIdForLocation (cell-native; Stage 6: no coord_X_Y grid path)', () => {
  it('resolves the burg seated on the given cell', () => {
    expect(burgIdForLocation({ worldSeed: SEED, cellId: firstBurgCell })).toBe(firstTile.burgId);
  });

  it('returns undefined when no cell is recorded', () => {
    expect(burgIdForLocation({ worldSeed: SEED })).toBeUndefined();
    expect(burgIdForLocation({ worldSeed: SEED, cellId: null })).toBeUndefined();
  });

  it('returns undefined for a cell that holds no town', () => {
    expect(burgIdForLocation({ worldSeed: SEED, cellId: 0 })).toBeUndefined();
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
      currentLocationId: 'unused',
      worldSeed: SEED,
      cellId: firstBurgCell,
      townSim: { [firstTile.burgId]: town },
      gameTime: advancedTime,
    });
    expect(lines.length).toBeGreaterThan(0); // festivals alone guarantee yearly entries
    expect(lines.length).toBeLessThanOrEqual(4); // capped
  });

  it('returns [] when no cell is recorded', () => {
    const out = townChronicleForLocation({
      currentLocationId: 'clearing',
      worldSeed: SEED,
      townSim: {},
      gameTime: new Date(),
    });
    expect(out).toEqual([]);
  });

  it('returns [] for a cell that holds no tracked town', () => {
    const out = townChronicleForLocation({
      currentLocationId: 'unused',
      worldSeed: SEED,
      cellId: 0,
      townSim: {},
      gameTime: new Date(),
    });
    expect(out).toEqual([]);
  });
});
