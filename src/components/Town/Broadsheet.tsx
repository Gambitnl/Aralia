import React, { useMemo } from 'react';
import { useGameState } from '../../state/GameContext';
import { getGameDay } from '../../utils/core';
import { resolveTownForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';
import { selectTownNews, type TownNewsItem } from '../../systems/worldforge/townsim/townNews';
import { Z_INDEX } from '../../styles/zIndex';

/**
 * Player-facing TOWN BROADSHEET. Opened in two modes:
 *
 *  - LIVE: the "Read the latest broadsheet" action (player standing in a tracked
 *    living-world town). Resolves the town from gameState and computes its recent
 *    news every render, so it always reflects the current day.
 *  - SNAPSHOT (keepsake): reading a pocketed broadsheet item (READ_ITEM). The
 *    item carries a FROZEN { townName, day, news } snapshot in gameState.
 *    broadsheetSnapshot; the modal renders that instead, so it works even after
 *    the player has left the town.
 *
 * Either way the news is split into lead/notices/gossip by prominence and dressed
 * up as a printed paper. State is a visibility flag (isBroadsheetVisible) plus the
 * optional broadsheetSnapshot; closing dispatches SET_BROADSHEET_VISIBLE false.
 */
interface BroadsheetSnapshot {
  townName: string;
  day: number;
  news: TownNewsItem[];
}

const Broadsheet: React.FC = () => {
  const { state, dispatch } = useGameState();

  // Parse a frozen keepsake snapshot if one is being read. Guarded so malformed
  // content can never throw — it simply falls back to the live computation.
  const snapshot = useMemo<BroadsheetSnapshot | null>(() => {
    if (!state.broadsheetSnapshot) return null;
    try {
      const parsed = JSON.parse(state.broadsheetSnapshot) as Partial<BroadsheetSnapshot>;
      if (!parsed || !Array.isArray(parsed.news)) return null;
      return {
        townName: typeof parsed.townName === 'string' ? parsed.townName : 'a nearby town',
        day: typeof parsed.day === 'number' ? parsed.day : 0,
        news: parsed.news,
      };
    } catch {
      return null;
    }
  }, [state.broadsheetSnapshot]);

  const liveDay = state.gameTime instanceof Date ? getGameDay(state.gameTime) : 0;
  const day = snapshot ? snapshot.day : liveDay;

  const town = useMemo(
    () =>
      snapshot
        ? undefined
        : resolveTownForLocation({
            // GRID-RETIRE: BA-2 — prefer the canonical cell over the coarse grid coord.
            cellId: state.playerCell?.cellId ?? null,
            currentLocationId: state.currentLocationId,
            worldSeed: state.worldSeed,
            townSim: state.townSim,
            gameTime: state.gameTime,
          }),
    [snapshot, state.playerCell?.cellId, state.currentLocationId, state.worldSeed, state.townSim, state.gameTime],
  );

  // The town's display name: the snapshot's frozen name when reading a keepsake,
  // else the live dynamic-location name (if registered), else a generic paper.
  const townName = snapshot ? snapshot.townName : state.dynamicLocations?.[state.currentLocationId]?.name;
  const paperName = townName ? `THE ${townName.toUpperCase()} CHRONICLE` : 'TOWN CHRONICLE';

  // The single most-recent headline runs as the lead story.
  const lead = useMemo(
    () =>
      snapshot
        ? snapshot.news.filter((i) => i.prominence === 'headline')[0]
        : town
          ? selectTownNews(town, day, { minProminence: 'headline', max: 1 })[0]
          : undefined,
    [snapshot, town, day],
  );

  // Notice-tier-and-up items fill the notices column (minus the lead headline).
  const notices = useMemo(
    () =>
      snapshot
        ? snapshot.news.filter((i) => i.prominence !== 'gossip').filter((i) => i.id !== lead?.id).slice(0, 10)
        : town
          ? selectTownNews(town, day, { minProminence: 'notice', max: 10 }).filter((i) => i.id !== lead?.id)
          : [],
    [snapshot, town, day, lead],
  );

  // Gossip-tier items become the "word on the street" sidebar (capped ~6).
  const gossip = useMemo(
    () =>
      snapshot
        ? snapshot.news.filter((i) => i.prominence === 'gossip').slice(0, 6)
        : town
          ? selectTownNews(town, day, { max: 12 }).filter((i) => i.prominence === 'gossip').slice(0, 6)
          : [],
    [snapshot, town, day],
  );

  const hasNews = Boolean(lead) || notices.length > 0 || gossip.length > 0;

  const close = () => dispatch({ type: 'SET_BROADSHEET_VISIBLE', payload: false });

  return (
    <div
      data-testid="broadsheet"
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 p-4"
      style={{ zIndex: Z_INDEX.MODAL_BACKGROUND }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-stone-100 border-4 border-stone-800 rounded-sm shadow-2xl p-8 text-stone-900 font-serif"
        style={{ zIndex: Z_INDEX.MODAL_CONTENT }}
      >
        <button
          onClick={close}
          className="absolute top-3 right-3 text-stone-600 hover:text-stone-900 text-xl font-bold"
          aria-label="Close broadsheet"
        >
          X
        </button>

        {/* Masthead */}
        <header className="text-center border-y-4 border-double border-stone-800 py-3 mb-5">
          <h2 className="text-4xl font-black tracking-tight uppercase">{paperName}</h2>
          <p className="text-xs uppercase tracking-[0.3em] text-stone-600 mt-1">
            Day {day} &middot; Price: one copper
          </p>
        </header>

        {!hasNews ? (
          <p data-testid="broadsheet-empty" className="text-stone-600 italic text-center py-10">
            The broadsheet is blank &mdash; no news to report.
          </p>
        ) : (
          <div data-testid="broadsheet-content">
            {/* Lead story */}
            {lead && (
              <section data-testid="broadsheet-lead" className="mb-6 pb-5 border-b-2 border-stone-800">
                <h3 className="text-3xl font-bold leading-tight mb-2">{lead.text}</h3>
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  Day {lead.day} &middot; Special report
                </p>
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Notices column */}
              <section
                data-testid="broadsheet-notices"
                className="md:col-span-2 md:border-r border-stone-400 md:pr-6 space-y-3"
              >
                <h4 className="text-sm font-bold uppercase tracking-widest border-b border-stone-700 pb-1 mb-2">
                  Notices
                </h4>
                {notices.length === 0 ? (
                  <p className="text-stone-500 italic text-sm">No further notices today.</p>
                ) : (
                  notices.map((item) => (
                    <article key={item.id} className="text-sm leading-snug">
                      <span className="text-stone-500 mr-1">[Day {item.day}]</span>
                      {item.text}
                    </article>
                  ))
                )}
              </section>

              {/* Word on the street */}
              <aside data-testid="broadsheet-gossip" className="space-y-2">
                <h4 className="text-sm font-bold uppercase tracking-widest border-b border-stone-700 pb-1 mb-2">
                  Word on the Street
                </h4>
                {gossip.length === 0 ? (
                  <p className="text-stone-500 italic text-sm">The streets are quiet.</p>
                ) : (
                  gossip.map((item) => (
                    <p key={item.id} className="text-xs italic leading-snug text-stone-700">
                      &ldquo;{item.text}&rdquo;
                    </p>
                  ))
                )}
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Broadsheet;
