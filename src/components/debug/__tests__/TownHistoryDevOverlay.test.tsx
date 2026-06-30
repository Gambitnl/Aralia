import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { getGameDay } from '../../../utils/core';
import { createMockGameState } from '../../../utils/core/factories';
import { GameProvider } from '../../../state/GameContext';
import { getTownTilesForGrid } from '../../../systems/worldforge/bridge/legacySubmapBridge';
import { buildTownSimStateForBurg } from '../../../systems/worldforge/townsim/townSimRegistration';
import { advanceTown } from '../../../systems/worldforge/townsim/townSimRegistry';
import type { GameState } from '../../../types';
import TownHistoryDevOverlay from '../TownHistoryDevOverlay';

const SEED = 12345;
const COLS = 96;
const ROWS = 96;
const firstTile = getTownTilesForGrid(SEED, COLS, ROWS)[0];

function renderOverlay(state: GameState) {
  return render(
    <GameProvider state={state} dispatch={() => undefined}>
      <TownHistoryDevOverlay />
    </GameProvider>,
  );
}

/** Open the collapsed launcher so the panel body is visible. */
function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: /Town history/i }));
}

describe('TownHistoryDevOverlay', () => {
  it('shows "Not in a tracked town" when the location resolves to no town', () => {
    const base = createMockGameState();
    const state: GameState = {
      ...base,
      worldSeed: SEED,
      currentLocationId: 'clearing', // non-coordinate → not a tracked town
      townSim: {},
    };
    renderOverlay(state);
    openPanel();
    expect(screen.getByTestId('town-history-empty').textContent).toMatch(/Not in a tracked town/i);
  });

  it('renders prosperity, holders and news when the player is in a tracked town', () => {
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
      townSim: { [firstTile.burgId]: town },
    };
    renderOverlay(state);
    openPanel();

    // Resolved to a town → empty panel must NOT show.
    expect(screen.queryByTestId('town-history-empty')).toBeNull();
    // Prosperity meter renders.
    expect(screen.getByTestId('town-history-prosperity')).toBeTruthy();
    // News list renders at least one chronicle-derived line (festivals guarantee entries).
    const newsList = screen.getByTestId('town-history-news');
    expect(newsList.textContent && newsList.textContent.length).toBeGreaterThan(0);
  });
});
