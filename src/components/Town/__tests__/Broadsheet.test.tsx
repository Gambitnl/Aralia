import React from 'react';
import { render, screen } from '@testing-library/react';
import { getGameDay } from '../../../utils/core';
import { createMockGameState } from '../../../utils/core/factories';
import { GameProvider } from '../../../state/GameContext';
import { getTownTilesForGrid, getBridgeAtlas } from '../../../systems/worldforge/bridge/legacySubmapBridge';
import { buildTownSimStateForBurg } from '../../../systems/worldforge/townsim/townSimRegistration';
import { advanceTown } from '../../../systems/worldforge/townsim/townSimRegistry';
import type { GameState } from '../../../types';
import Broadsheet from '../Broadsheet';

const SEED = 12345;
const COLS = 96;
const ROWS = 96;
const firstTile = getTownTilesForGrid(SEED, COLS, ROWS)[0];
// Town readers resolve the town from `playerCell.cellId` (grid-retirement made
// them cell-only), so a "tracked town" test seats the player on the burg's cell.
const firstTileBurgCell =
  (getBridgeAtlas(SEED).pack.burgs?.[firstTile.burgId] as { cell?: number } | undefined)?.cell ?? 0;

function renderBroadsheet(state: GameState) {
  return render(
    <GameProvider state={state} dispatch={() => undefined}>
      <Broadsheet />
    </GameProvider>,
  );
}

describe('Broadsheet', () => {
  it('shows the blank state when the player is not in a tracked town', () => {
    const base = createMockGameState();
    const state: GameState = {
      ...base,
      worldSeed: SEED,
      currentLocationId: 'clearing', // non-coordinate → not a tracked town
      townSim: {},
      isBroadsheetVisible: true,
    };
    renderBroadsheet(state);
    expect(screen.getByTestId('broadsheet-empty').textContent).toMatch(/no news to report/i);
    expect(screen.queryByTestId('broadsheet-content')).toBeNull();
  });

  it('renders the masthead and news when the player is in a tracked town', () => {
    const base = createMockGameState();
    const startDay = getGameDay(base.gameTime);
    // Advance the clock 8 years and the town sim to match — guarantees chronicle entries.
    const advancedTime = new Date(base.gameTime.getTime() + 8 * 365 * 86400 * 1000);
    const currentDay = getGameDay(advancedTime);
    let town = buildTownSimStateForBurg(SEED, firstTile.burgId, startDay);
    town = advanceTown(town, SEED, currentDay);

    const state: GameState = {
      ...base,
      worldSeed: SEED,
      gameTime: advancedTime,
      currentLocationId: `coord_${firstTile.x}_${firstTile.y}`,
      playerCell: { cellId: firstTileBurgCell, localeCoords: null },
      townSim: { [firstTile.burgId]: town },
      isBroadsheetVisible: true,
    };
    renderBroadsheet(state);

    // Masthead always renders the paper name + day.
    expect(screen.getByTestId('broadsheet').textContent).toMatch(/chronicle/i);
    // Resolved to a town with chronicle history → blank state must NOT show.
    expect(screen.queryByTestId('broadsheet-empty')).toBeNull();
    // The newspaper body renders at least one chronicle-derived news line.
    const content = screen.getByTestId('broadsheet-content');
    expect(content.textContent && content.textContent.length).toBeGreaterThan(0);
  });

  it('renders a frozen keepsake snapshot without requiring a tracked town', () => {
    const base = createMockGameState();
    const snapshot = JSON.stringify({
      townName: 'Testton',
      day: 100,
      news: [
        { id: 1, day: 99, kind: 'disaster', prominence: 'headline', text: 'A fire ravaged the docks.' },
        { id: 2, day: 98, kind: 'economy', prominence: 'notice', text: 'Grain prices climb.' },
        { id: 3, day: 97, kind: 'birth', prominence: 'gossip', text: 'A baker welcomed twins.' },
      ],
    });

    const state: GameState = {
      ...base,
      // Deliberately NOT in a tracked town: no worldSeed/townSim wiring.
      currentLocationId: 'clearing',
      isBroadsheetVisible: true,
      broadsheetSnapshot: snapshot,
    };
    renderBroadsheet(state);

    // The masthead reflects the snapshot's frozen town name + day.
    expect(screen.getByTestId('broadsheet').textContent).toMatch(/TESTTON CHRONICLE/i);
    // Snapshot has news → blank state must NOT show even outside any town.
    expect(screen.queryByTestId('broadsheet-empty')).toBeNull();
    // The frozen news lines render.
    expect(screen.getByTestId('broadsheet-content').textContent).toMatch(/fire ravaged the docks/i);
    expect(screen.getByTestId('broadsheet-content').textContent).toMatch(/grain prices climb/i);
  });

  it('falls back to live/empty when the snapshot JSON is malformed (no throw)', () => {
    const base = createMockGameState();
    const state: GameState = {
      ...base,
      worldSeed: SEED,
      currentLocationId: 'clearing',
      townSim: {},
      isBroadsheetVisible: true,
      broadsheetSnapshot: '{ not valid json',
    };
    renderBroadsheet(state);
    // Malformed snapshot → no crash, falls back to the live (here empty) path.
    expect(screen.getByTestId('broadsheet-empty').textContent).toMatch(/no news to report/i);
  });
});
