// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 14:01:57
 * Dependents: components/layout/GameModals.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import { useGameState } from '../../state/GameContext';
import { getGameDay } from '../../utils/core';
import { resolveTownForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';
import { selectTownNews, type NewsProminence } from '../../systems/worldforge/townsim/townNews';
import { ageOf } from '../../systems/worldforge/townsim/townSim';
import type { TownSimState, LivingVillager } from '../../systems/worldforge/townsim/types';

/**
 * Dev-only live overlay for the living-world town chronicle (sibling of
 * AgentSimDevOverlay). Resolves the tracked town the player is CURRENTLY
 * standing in and renders its prosperity, living-villager count, current
 * institution-holders, and recent news — so the chronicle is visibly inspectable
 * while playing. Reads currentLocationId + worldSeed + gameTime + townSim from
 * live state; owns its own collapse toggle; writes nothing back.
 *
 * Renders a small "Not in a tracked town" panel when the player isn't standing
 * in one (a legitimate "no town applies" case, not an error) — no fallback layer
 * (no-fallback directive): if the underlying town bridge throws, it surfaces.
 * Mounted behind `isDevModeEnabled` + PLAYING in GameModals.
 */

/** News prominence → accent colour for the little tag/dot. */
const PROMINENCE_COLOR: Record<NewsProminence, string> = {
  headline: '#f87171',
  notice: '#fbbf24',
  gossip: '#8b949e',
};

const panelStyle: React.CSSProperties = {
  background: 'rgba(13,17,23,0.96)',
  border: '1px solid #30363d',
  borderRadius: 8,
  padding: 8,
  boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
  width: 320,
};

/** The institution-holders alive in this town, with role + name + current age. */
function currentHolders(town: TownSimState, day: number): Array<{ role: string; name: string; age: number }> {
  return Object.values(town.villagers)
    .filter((v: LivingVillager) => v.role && v.diedDay === undefined)
    .map((v: LivingVillager) => ({ role: v.role as string, name: v.name, age: ageOf(v, day) }))
    .sort((a, b) => a.role.localeCompare(b.role));
}

const TownHistoryDevOverlay: React.FC = () => {
  const { state } = useGameState();
  const [open, setOpen] = useState(false);

  const day = state.gameTime instanceof Date ? getGameDay(state.gameTime) : 0;

  // Resolve only when the inputs that feed the lookup change.
  const town = useMemo(
    () =>
      resolveTownForLocation({
        currentLocationId: state.currentLocationId,
        worldSeed: state.worldSeed,
        // Town simulation is cell-native after grid retirement. Pass the same
        // canonical player cell used by rumors, merchants, and town registration
        // so the developer overlay observes the town the player actually occupies.
        cellId: state.playerCell?.cellId ?? null,
        townSim: state.townSim,
        gameTime: state.gameTime,
      }),
    [state.currentLocationId, state.worldSeed, state.playerCell?.cellId, state.townSim, state.gameTime],
  );

  const holders = useMemo(() => (town ? currentHolders(town, day) : []), [town, day]);
  const news = useMemo(
    () => (town ? selectTownNews(town, day, { max: 12 }) : []), // default window — match player surfaces
    [town, day],
  );

  if (!open) {
    return (
      <div style={{ position: 'fixed', right: 12, bottom: 56, zIndex: 4000, fontFamily: 'sans-serif' }} data-testid="town-history-dev-overlay">
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ background: 'rgba(13,17,23,0.92)', color: '#79c0ff', border: '1px solid #30363d', borderRadius: 6, fontSize: 12, cursor: 'pointer', padding: '5px 10px' }}
        >
          ▤ Town history
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 56, zIndex: 4000, fontFamily: 'sans-serif' }} data-testid="town-history-dev-overlay">
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>
            {town ? `Town history · burg #${town.burgId}` : 'Town history'}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, fontSize: 12, cursor: 'pointer', padding: '1px 7px' }}
            aria-label="Close town history overlay"
          >
            ×
          </button>
        </div>

        {!town ? (
          <div style={{ color: '#8b949e', fontSize: 11 }} data-testid="town-history-empty">
            Not in a tracked town.
          </div>
        ) : (
          <>
            {/* Prosperity meter + living-villager count. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: '#8b949e', fontSize: 10, width: 64 }}>Prosperity</span>
              <div style={{ flex: 1, height: 8, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  data-testid="town-history-prosperity"
                  style={{
                    width: `${Math.max(0, Math.min(100, town.prosperity ?? 50))}%`,
                    height: '100%',
                    background: '#3fb950',
                  }}
                />
              </div>
              <span style={{ color: '#c9d1d9', fontSize: 10, width: 28, textAlign: 'right' }}>
                {Math.round(town.prosperity ?? 50)}
              </span>
            </div>
            <div style={{ color: '#8b949e', fontSize: 10, marginBottom: 6 }}>
              {Object.values(town.villagers).filter((v) => v.diedDay === undefined).length} living villagers · day {day}
            </div>

            {/* Current institution-holders. */}
            <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Institutions</div>
            {holders.length === 0 ? (
              <div style={{ color: '#6e7681', fontSize: 10, marginBottom: 6 }}>No tracked holders.</div>
            ) : (
              <div style={{ marginBottom: 6 }} data-testid="town-history-holders">
                {holders.map((h) => (
                  <div key={`${h.role}:${h.name}`} style={{ color: '#c9d1d9', fontSize: 10 }}>
                    <span style={{ color: '#79c0ff' }}>{h.role}</span> — {h.name} ({h.age})
                  </div>
                ))}
              </div>
            )}

            {/* Recent news (scrollable, capped). */}
            <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Recent news</div>
            {news.length === 0 ? (
              <div style={{ color: '#6e7681', fontSize: 10 }}>No recent news.</div>
            ) : (
              <div style={{ maxHeight: 160, overflowY: 'auto' }} data-testid="town-history-news">
                {news.map((item) => (
                  <div key={item.id} style={{ display: 'flex', gap: 6, fontSize: 10, marginBottom: 3 }}>
                    <span
                      title={item.prominence}
                      style={{ color: PROMINENCE_COLOR[item.prominence], flexShrink: 0 }}
                    >
                      •
                    </span>
                    <span style={{ color: '#c9d1d9' }}>{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TownHistoryDevOverlay;
