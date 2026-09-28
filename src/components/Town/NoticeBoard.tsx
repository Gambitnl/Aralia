import React, { useMemo } from 'react';
import { useGameState } from '../../state/GameContext';
import { getGameDay } from '../../utils/core';
import { resolveTownForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';
import { selectTownNews, type NewsProminence } from '../../systems/worldforge/townsim/townNews';
import {
  deriveTownSituation,
  TOWN_SITUATION_RESOLUTIONS,
  type TownSituationResolution,
} from '../../systems/worldforge/townsim/townSituation';
import { WindowFrame } from '../ui/WindowFrame';
import { Button } from '../ui/Button';
import { WINDOW_KEYS } from '../../styles/uiIds';

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

/** Compact signed effects keep every choice's mechanical consequence visible. */
function resolutionEffects(resolution: TownSituationResolution): string {
  const gold = resolution.goldDelta === 0
    ? 'No gold cost'
    : `${resolution.goldDelta > 0 ? '+' : ''}${resolution.goldDelta} gp`;
  const prosperity = `${resolution.prosperityDelta > 0 ? '+' : ''}${resolution.prosperityDelta} town prosperity`;
  return `${gold} · ${prosperity}`;
}

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
        townSim: state.townSim,
        gameTime: state.gameTime,
      }),
    [state.playerCell?.cellId, state.currentLocationId, state.worldSeed, state.townSim, state.gameTime],
  );

  const news = useMemo(
    () => (town ? selectTownNews(town, day, { minProminence: 'notice', max: 12 }) : []),
    [town, day],
  );

  // The situation is a view over the chronicle, never a local modal snapshot.
  // After dispatch, the live store rerenders this panel with its durable outcome.
  const situation = useMemo(
    () => (town ? deriveTownSituation(town, day) : null),
    [town, day],
  );

  const resolveSituation = (resolution: TownSituationResolution) => {
    if (!situation || situation.resolved || state.gold + resolution.goldDelta < 0) return;
    dispatch({
      type: 'RESOLVE_TOWN_SITUATION',
      payload: {
        burgId: situation.burgId,
        sourceEventId: situation.sourceEventId,
        resolutionId: resolution.id,
      },
    });
  };

  const close = () => dispatch({ type: 'SET_NOTICE_BOARD_VISIBLE', payload: false });

  return (
    <WindowFrame
      title="Notice Board"
      onClose={close}
      storageKey={WINDOW_KEYS.NOTICE_BOARD}
      initialMaximized={false}
    >
      <div data-testid="notice-board" className="flex flex-col h-full bg-gray-900 text-amber-100 font-serif">
        {/* Subtitle banner (was a header subtitle). */}
        <p className="shrink-0 text-center text-sm text-gray-400 px-6 py-2 border-b border-amber-800/40">
          {town ? `Recent word about town · day ${day}` : 'Recent word about town'}
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {situation && (
            <section
              data-testid="town-situation"
              className="mb-6 rounded-lg border border-sky-700/70 bg-sky-950/35 p-4 shadow-inner"
              aria-labelledby="town-situation-title"
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                A living town moment
              </p>
              <h2 id="town-situation-title" className="text-lg font-semibold text-amber-100">
                The town is watching what you do next
              </h2>
              <p data-testid="town-situation-source" className="mt-2 leading-relaxed text-gray-200">
                {situation.sourceText}
              </p>

              {situation.resolved ? (
                <div
                  data-testid="town-situation-outcome"
                  className="mt-4 rounded border border-emerald-700/60 bg-emerald-950/30 p-3"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    The town remembers
                  </p>
                  <p className="mt-1 text-emerald-50">{situation.outcome?.summary}</p>
                </div>
              ) : (
                <div data-testid="town-situation-choices" className="mt-4 grid gap-3 lg:grid-cols-3">
                  {TOWN_SITUATION_RESOLUTIONS.map((resolution) => {
                    const unaffordable = state.gold + resolution.goldDelta < 0;
                    return (
                      <Button
                        key={resolution.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        data-testid={`town-situation-choice-${resolution.id}`}
                        aria-disabled={unaffordable}
                        onClick={() => resolveSituation(resolution)}
                        className={`rounded-md border bg-gray-900/80 p-3 text-left ${
                          unaffordable
                            ? 'cursor-not-allowed border-gray-700 opacity-45'
                            : 'border-sky-700 transition hover:border-sky-400 hover:bg-sky-950/50'
                        }`}
                        aria-label={`${resolution.label}. ${resolutionEffects(resolution)}${
                          unaffordable ? '. Unavailable: you need 25 gp.' : ''
                        }`}
                      >
                        <span className="block font-semibold text-sky-100">{resolution.label}</span>
                        <span className="mt-1 block text-sm leading-snug text-gray-300">
                          {resolution.description}
                        </span>
                        <span className="mt-2 block text-xs font-semibold text-amber-300">
                          {resolutionEffects(resolution)}
                        </span>
                        {unaffordable && (
                          <span className="mt-1 block text-xs text-rose-300">You need 25 gp.</span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

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
    </WindowFrame>
  );
};

export default NoticeBoard;
