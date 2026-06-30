import React from 'react';
import { render, screen } from '@testing-library/react';
import { getGameDay } from '../../../utils/core';
import { createMockGameState } from '../../../utils/core/factories';
import { GameProvider } from '../../../state/GameContext';
import { getTownTilesForGrid } from '../../../systems/worldforge/bridge/legacySubmapBridge';
import { buildTownSimStateForBurg } from '../../../systems/worldforge/townsim/townSimRegistration';
import { advanceTown } from '../../../systems/worldforge/townsim/townSimRegistry';
import type { GameState } from '../../../types';
import NoticeBoard from '../NoticeBoard';

const SEED = 12345;
const COLS = 96;
const ROWS = 96;
const firstTile = getTownTilesForGrid(SEED, COLS, ROWS)[0];

function renderBoard(state: GameState) {
  return render(
    <GameProvider state={state} dispatch={() => undefined}>
      <NoticeBoard />
    </GameProvider>,
  );
}

describe('NoticeBoard', () => {
  it('shows the empty state when the player is not in a tracked town', () => {
    const base = createMockGameState();
    const state: GameState = {
      ...base,
      worldSeed: SEED,
      currentLocationId: 'clearing', // non-coordinate → not a tracked town
      townSim: {},
      isNoticeBoardVisible: true,
    };
    renderBoard(state);
    expect(screen.getByTestId('notice-board-empty').textContent).toMatch(/nothing posted on the board/i);
    expect(screen.queryByTestId('notice-board-news')).toBeNull();
  });

  it('renders notice-tier news when the player is in a tracked town', () => {
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
      isNoticeBoardVisible: true,
    };
    renderBoard(state);

    // Resolved to a town → empty state must NOT show.
    expect(screen.queryByTestId('notice-board-empty')).toBeNull();
    // News list renders at least one chronicle-derived line.
    const newsList = screen.getByTestId('notice-board-news');
    expect(newsList.textContent && newsList.textContent.length).toBeGreaterThan(0);
  });
});
