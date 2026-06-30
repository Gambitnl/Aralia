import React, { useMemo } from 'react';
import { useGameState } from '../../state/GameContext';
import { getGameDay } from '../../utils/core';
import { resolveTownForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';
import { selectTownNews, type NewsProminence } from '../../systems/worldforge/townsim/townNews';
import { Z_INDEX } from '../../styles/zIndex';

/**
 * Player-facing TOWN NOTICE BOARD. Opened from the "Read the Notice Board" action
 * when the player is standing in a tracked living-world town. Resolves that town
 * from live gameState and renders its recent notable news (notice tier and up) —
 * the same chronicle the dev overlay inspects, surfaced diegetically.
 *
 * Keeps no local snapshot: the news is computed live from gameState every render,
 * so it always reflects the current day. State is a single visibility flag
 * (isNoticeBoardVisible); closing dispatches SET_NOTICE_BOARD_VISIBLE false.
 */

/** News prominence → badge label + accent colour. */
const PROMINENCE_BADGE: Record<NewsProminence, { label: string; color: string }> = {
  headline: { label: 'Headline', color: '#f87171' },
  notice: { label: 'Notice', color: '#fbbf24' },
  gossip: { label: 'Gossip', color: '#8b949e' },
};

const NoticeBoard: React.FC = () => {
  const { state, dispatch } = useGameState();

  const day = state.gameTime instanceof Date ? getGameDay(state.gameTime) : 0;

  const town = useMemo(
    () =>
      resolveTownForLocation({
        // GRID-RETIRE: BA-2 — prefer the canonical cell over the coarse grid coord.
        cellId: state.playerCell?.cellId ?? null,
        currentLocationId: state.currentLocationId,
        worldSeed: state.worldSeed,
        gridSize: state.mapData?.gridSize,
        townSim: state.townSim,
        gameTime: state.gameTime,
      }),
    [state.playerCell?.cellId, state.currentLocationId, state.worldSeed, state.mapData?.gridSize, state.townSim, state.gameTime],
  );

  const news = useMemo(
    () => (town ? selectTownNews(town, day, { minProminence: 'notice', max: 12 }) : []),
    [town, day],
  );

  const close = () => dispatch({ type: 'SET_NOTICE_BOARD_VISIBLE', payload: false });

  return (
    <div
      data-testid="notice-board"
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 p-4"
      style={{ zIndex: Z_INDEX.MODAL_BACKGROUND }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-gray-900 border-2 border-amber-700 rounded-lg shadow-2xl p-6 text-amber-100 font-serif"
        style={{ zIndex: Z_INDEX.MODAL_CONTENT }}
      >
        <button
          onClick={close}
          className="absolute top-4 right-4 text-amber-500 hover:text-amber-300 text-xl font-bold"
          aria-label="Close notice board"
        >
          X
        </button>

        <h2 className="text-3xl font-bold mb-1 text-center text-amber-500 border-b border-amber-800 pb-2">
          Notice Board
        </h2>
        <p className="text-center text-sm text-gray-400 mb-6">
          {town ? `Recent word about town · day ${day}` : 'Recent word about town'}
        </p>

        {news.length === 0 ? (
          <p data-testid="notice-board-empty" className="text-gray-400 italic text-center py-8">
            There&apos;s nothing posted on the board.
          </p>
        ) : (
          <ul data-testid="notice-board-news" className="space-y-3">
            {news.map((item) => {
              const badge = PROMINENCE_BADGE[item.prominence];
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 bg-gray-800/60 border border-gray-700 rounded-md p-3"
                >
                  <span
                    className="flex-shrink-0 text-xs font-semibold uppercase tracking-wide rounded px-2 py-0.5"
                    style={{ color: badge.color, border: `1px solid ${badge.color}` }}
                  >
                    {badge.label}
                  </span>
                  <span className="text-amber-100 leading-snug">{item.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NoticeBoard;
