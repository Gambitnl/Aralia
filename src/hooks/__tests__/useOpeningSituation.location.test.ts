import { describe, it, expect } from 'vitest';
import { buildSituationLocation } from '../useOpeningSituation';
import { initialGameState } from '../../state/initialState';
import { LOCATIONS, STARTING_LOCATION_ID } from '../../data/world/locations';
import { getBridgeAtlas, getTownTilesForGrid } from '../../systems/worldforge/bridge/legacySubmapBridge';
import { biomeIdForCell } from '../../systems/worldforge/local/biomeForCell';
import type { GameState } from '../../types';

const base = (): GameState => ({ ...initialGameState });

const SEED = 12345;
const BURG_CELL = (getBridgeAtlas(SEED).pack.burgs as Array<{ cell?: number }>)[
  getTownTilesForGrid(SEED, 96, 96)[0].burgId
].cell!;

describe('buildSituationLocation — biome comes from the canonical cell (grid retirement)', () => {
  it('prefers the cell biome over scanning mapData.tiles', () => {
    const loc = buildSituationLocation({
      ...base(),
      worldSeed: SEED,
      playerCell: { cellId: BURG_CELL, localeCoords: null },
      // currentLocationId is a coord (non-static) so the static-loc biome doesn't pre-empt.
      currentLocationId: 'coord_5_5',
    });
    expect(loc.biome).toBe(biomeIdForCell(SEED, BURG_CELL));
  });
});

describe('buildSituationLocation — chosen start town names the opening scene', () => {
  it('uses the chosen town + region when present', () => {
    const loc = buildSituationLocation({ ...base(), startTownName: 'Pinsk', startTownRegion: 'See of Helsia' });
    expect(loc.name).toBe('Pinsk, See of Helsia');
  });

  it('uses the town name alone when no region is recorded', () => {
    const loc = buildSituationLocation({ ...base(), startTownName: 'Pinsk' });
    expect(loc.name).toBe('Pinsk');
  });

  it('falls back to the static starting location when no town was chosen (dev/skip/load)', () => {
    const loc = buildSituationLocation({ ...base(), startTownName: undefined, startTownRegion: undefined });
    const expected = LOCATIONS[STARTING_LOCATION_ID]?.name ?? STARTING_LOCATION_ID;
    expect(loc.name).toBe(expected);
  });
});
