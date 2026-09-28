import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { getGameDay } from '../../../utils/core';
import { createMockGameState } from '../../../utils/core/factories';
import { GameProvider } from '../../../state/GameContext';
import { getTownTilesForGrid, getBridgeAtlas } from '../../../systems/worldforge/bridge/legacySubmapBridge';
import { buildTownSimStateForBurg } from '../../../systems/worldforge/townsim/townSimRegistration';
import { advanceTown } from '../../../systems/worldforge/townsim/townSimRegistry';
import { townSituationKey } from '../../../systems/worldforge/townsim/townSituation';
import type { GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import NoticeBoard from '../NoticeBoard';

const SEED = 12345;
const COLS = 96;
const ROWS = 96;
const firstTile = getTownTilesForGrid(SEED, COLS, ROWS)[0];
// The town readers went cell-only (grid-retirement): they resolve the town from
// `playerCell.cellId`, so a "tracked town" test must seat the player on the burg's
// atlas cell, not just the legacy coord location id.
const firstTileBurgCell =
  (getBridgeAtlas(SEED).pack.burgs?.[firstTile.burgId] as { cell?: number } | undefined)?.cell ?? 0;

function renderBoard(state: GameState, dispatch: React.Dispatch<AppAction> = () => undefined) {
  return render(
    <GameProvider state={state} dispatch={dispatch}>
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
      playerCell: { cellId: firstTileBurgCell, localeCoords: null },
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

  it('offers materially different responses to a real town development', () => {
    const base = createMockGameState();
    const day = getGameDay(base.gameTime);
    const built = buildTownSimStateForBurg(SEED, firstTile.burgId, day);
    // Keep this proof independent of annual simulation luck: the panel must be
    // driven by a real canonical event, so the fixture installs one disaster in
    // the same append-only chronicle production uses.
    const sourceEventId = built.chronicle.nextEventId;
    const town = {
      ...built,
      prosperity: 50,
      chronicle: {
        ...built.chronicle,
        events: [
          ...built.chronicle.events,
          {
            id: sourceEventId,
            day,
            kind: 'disaster' as const,
            subjectId: 0,
            relatedIds: [],
            summary: 'Floodwater damaged the riverside storehouses.',
          },
        ],
        nextEventId: sourceEventId + 1,
      },
    };
    const state: GameState = {
      ...base,
      gold: 10,
      worldSeed: SEED,
      currentLocationId: `coord_${firstTile.x}_${firstTile.y}`,
      playerCell: { cellId: firstTileBurgCell, localeCoords: null },
      townSim: { [firstTile.burgId]: town },
      isNoticeBoardVisible: true,
    };
    const dispatch = vi.fn<React.Dispatch<AppAction>>();

    renderBoard(state, dispatch);

    expect(screen.getByTestId('town-situation-source').textContent).toMatch(/storehouses/i);
    expect(screen.getByTestId('town-situation-choice-organize_response')).toBeTruthy();
    expect(
      screen.getByTestId('town-situation-choice-fund_response').getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: /back the town.*unavailable.*you need 25 gp/i }),
    ).toBeTruthy();
    expect(screen.getByText(/you need 25 gp/i)).toBeTruthy();

    // aria-disabled keeps the reason keyboard-discoverable; the guarded handler
    // still prevents a forged click from dispatching an unaffordable choice.
    fireEvent.click(screen.getByTestId('town-situation-choice-fund_response'));
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('town-situation-choice-organize_response'));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'RESOLVE_TOWN_SITUATION',
      payload: {
        burgId: firstTile.burgId,
        sourceEventId,
        resolutionId: 'organize_response',
      },
    });
  });

  it('shows the durable town memory instead of choices after resolution', () => {
    const base = createMockGameState();
    const day = getGameDay(base.gameTime);
    const built = buildTownSimStateForBurg(SEED, firstTile.burgId, day);
    const sourceEventId = built.chronicle.nextEventId;
    const outcomeSummary = 'Dev Player invested 25 gp after the storehouses flooded.';
    const town = {
      ...built,
      chronicle: {
        ...built.chronicle,
        events: [
          ...built.chronicle.events,
          {
            id: sourceEventId,
            day,
            kind: 'disaster' as const,
            subjectId: 0,
            relatedIds: [],
            summary: 'Floodwater damaged the riverside storehouses.',
          },
          {
            id: sourceEventId + 1,
            day,
            kind: 'player_intervention' as const,
            subjectId: 0,
            relatedIds: [],
            summary: outcomeSummary,
            provenance: {
              sourceKey: townSituationKey(firstTile.burgId, sourceEventId),
              sourceEventId,
              resolutionId: 'fund_response' as const,
              actorName: 'Dev Player',
            },
          },
        ],
        nextEventId: sourceEventId + 2,
      },
    };
    const state: GameState = {
      ...base,
      worldSeed: SEED,
      currentLocationId: `coord_${firstTile.x}_${firstTile.y}`,
      playerCell: { cellId: firstTileBurgCell, localeCoords: null },
      townSim: { [firstTile.burgId]: town },
      isNoticeBoardVisible: true,
    };

    renderBoard(state);

    expect(screen.getByRole('status').textContent).toMatch(/town remembers/i);
    expect(screen.getByRole('status').textContent).toContain(outcomeSummary);
    expect(screen.queryByTestId('town-situation-choices')).toBeNull();
  });
});
