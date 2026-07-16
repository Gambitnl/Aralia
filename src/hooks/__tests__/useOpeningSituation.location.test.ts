/**
 * These tests prove the opening location comes from canonical game state rather
 * than model invention or the retired grid. The same builder now freezes a
 * WorldForge seed/cell/site receipt so a later hostile resolution can project
 * the exact mounted GroundWorld or fail closed.
 */
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

describe('buildSituationLocation - tactical source receipt', () => {
  it('freezes the matching world seed, atlas cell, site center, and place label', () => {
    const loc = buildSituationLocation({
      ...base(),
      worldSeed: SEED,
      playerCell: { cellId: BURG_CELL, localeCoords: null },
      entry3DAnchor: { cellId: BURG_CELL, centerPx: [125, 250] },
      startTownName: 'Pinsk',
      startTownRegion: 'See of Helsia',
    });

    expect(loc.battlefieldSource).toEqual({
      kind: 'worldforge-opening-location',
      receiptId: `opening:${SEED}:cell:${BURG_CELL}`,
      worldSeed: SEED,
      cellId: BURG_CELL,
      centerPx: [125, 250],
      locationLabel: 'Pinsk, See of Helsia',
    });
  });

  it('does not attach a stale entry center from another atlas cell', () => {
    const loc = buildSituationLocation({
      ...base(),
      worldSeed: SEED,
      playerCell: { cellId: BURG_CELL, localeCoords: null },
      entry3DAnchor: { cellId: BURG_CELL + 1, centerPx: [125, 250] },
    });

    expect(loc.battlefieldSource?.cellId).toBe(BURG_CELL);
    expect(loc.battlefieldSource?.centerPx).toBeUndefined();
  });
});
