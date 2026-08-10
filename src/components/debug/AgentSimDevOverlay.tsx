// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/08/2026, 17:30:57
 * Dependents: components/layout/GameModals.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useMemo, useState } from 'react';
import { useGameState } from '../../state/GameContext';
import { rootSeedPath } from '../../systems/worldforge/seedPath';
import { buildDemoTownPlan, DEMO_BURG_ID } from '../../systems/worldforge/town/demoTownPlan';
import { generateTownRoster } from '../../systems/worldforge/roster/generateTownRoster';
import { scheduleClockFromGameTime } from '../../systems/worldforge/roster/gameClock';
import { WINDOW_KEYS } from '../../styles/uiIds';
import TownAgentSnapshotView from '../Worldforge/TownAgentSnapshotView';
import { WindowFrame } from '../ui/WindowFrame';
import { OPEN_AGENT_SIM_EVENT } from './devOverlayEvents';

/**
 * Dev-only live overlay for the agent-sim substrate (piece 2 mount point).
 * Generates a demo burg from the world seed and renders its townsfolk at the
 * CURRENT game hour — so the town visibly fills and empties as the game clock
 * advances. Self-contained: reads worldSeed + gameTime from state, owns its own
 * collapse toggle. No player-location coupling yet (demo burg), no persistent
 * state written. Mounted behind `isDevModeEnabled`.
 */

const SYLLABLES = ['ar', 'be', 'cor', 'dun', 'el', 'fen', 'gor', 'hal', 'kel', 'mor', 'tan', 'wyn'];

const AgentSimDevOverlay: React.FC = () => {
  const { state } = useGameState();
  const [open, setOpen] = useState(false);

  const worldSeed = state.worldSeed ?? 1;

  // Demo town + roster regenerate only when the seed changes.
  const { plan, roster } = useMemo(() => {
    const seedPath = rootSeedPath(worldSeed);
    const p = buildDemoTownPlan(worldSeed).plan;
    const nameFor = (rng: { next(): number }) => {
      const n = 2 + Math.floor(rng.next() * 2);
      let s = '';
      for (let i = 0; i < n; i++) s += SYLLABLES[Math.floor(rng.next() * SYLLABLES.length)];
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    const r = generateTownRoster(p, seedPath, { nameFor });
    return { plan: p, roster: r };
  }, [worldSeed]);

  // Fractional clock from the game time; a manual scrub overrides it so you can
  // drag through the day and watch agents walk the streets between home and work.
  const liveClock = state.gameTime instanceof Date ? scheduleClockFromGameTime(state.gameTime) : 0;
  const [scrub, setScrub] = useState<number | null>(null);
  const clock = scrub ?? liveClock;

  // GameModals and the World 3D HUD are separate React branches. This data-free
  // request reveals the existing inspector without duplicating it in the HUD or
  // adding developer-only visibility to persisted game state.
  useEffect(() => {
    const handleOpenRequest = () => setOpen(true);
    window.addEventListener(OPEN_AGENT_SIM_EVENT, handleOpenRequest);
    return () => window.removeEventListener(OPEN_AGENT_SIM_EVENT, handleOpenRequest);
  }, []);

  if (!open) return null;

  return (
    <WindowFrame
      title={`Agent sim · demo burg #${DEMO_BURG_ID}`}
      onClose={() => setOpen(false)}
      storageKey={WINDOW_KEYS.AGENT_SIM}
      minimumSize={{ width: 420, height: 480 }}
    >
      {/* The shared shell supplies close, reset, maximize, drag, and resize.
          Keep the simulation itself centered so its fixed-size diagnostic map
          remains legible when the WindowFrame grows. */}
      <div
        className="flex h-full flex-col items-center overflow-y-auto bg-gray-950 p-4 font-sans"
        data-testid="agent-sim-dev-overlay"
      >
          <TownAgentSnapshotView plan={plan} roster={roster} hour={Math.floor(clock)} clock={clock} width={300} height={300} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, width: '100%', maxWidth: 640 }}>
            <input
              type="range"
              min={0}
              max={24}
              step={0.05}
              value={clock}
              onChange={(e) => setScrub(Number(e.target.value))}
              style={{ flex: 1 }}
              aria-label="Scrub town clock"
              data-testid="agent-sim-clock-scrub"
            />
            <button
              type="button"
              onClick={() => setScrub(null)}
              style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, fontSize: 10, cursor: 'pointer', padding: '1px 6px' }}
              title="Follow the live game clock"
            >
              live
            </button>
          </div>
          <div style={{ color: '#8b949e', fontSize: 10, marginTop: 4 }}>
            {scrub === null ? 'Live on the game clock' : 'Scrubbing'} — drag to watch townsfolk walk between home and work.
          </div>
      </div>
    </WindowFrame>
  );
};

export default AgentSimDevOverlay;
