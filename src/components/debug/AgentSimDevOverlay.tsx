import React, { useMemo, useState } from 'react';
import { useGameState } from '../../state/GameContext';
import { rootSeedPath } from '../../systems/worldforge/seedPath';
import { buildDemoTownPlan, DEMO_BURG_ID } from '../../systems/worldforge/town/demoTownPlan';
import { generateTownRoster } from '../../systems/worldforge/roster/generateTownRoster';
import { scheduleClockFromGameTime } from '../../systems/worldforge/roster/gameClock';
import TownAgentSnapshotView from '../Worldforge/TownAgentSnapshotView';

/**
 * Dev-only live overlay for the agent-sim substrate (piece 2 mount point).
 * Generates a demo burg from the world seed and renders its townsfolk at the
 * CURRENT game hour — so the town visibly fills and empties as the game clock
 * advances. Self-contained: reads worldSeed + gameTime from state, owns its own
 * collapse toggle. No player-location coupling yet (demo burg), no persistent
 * state written. Mounted behind `isDevModeEnabled`.
 */

const SYLLABLES = ['ar', 'be', 'cor', 'dun', 'el', 'fen', 'gor', 'hal', 'kel', 'mor', 'tan', 'wyn'];

// Keep developer inspectors beside, rather than on top of, the lower-right
// World3D HUD. That HUD owns the final ~200px for its transition controls;
// `right: 12` made the Atlas button visible but impossible to click.
const DEV_INSPECTOR_RIGHT_OFFSET_PX = 220;

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

  return (
    <div style={{ position: 'fixed', right: DEV_INSPECTOR_RIGHT_OFFSET_PX, bottom: 12, zIndex: 4000, fontFamily: 'sans-serif' }} data-testid="agent-sim-dev-overlay">
      {open ? (
        <div style={{ background: 'rgba(13,17,23,0.96)', border: '1px solid #30363d', borderRadius: 8, padding: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>Agent sim · demo burg #{DEMO_BURG_ID}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, fontSize: 12, cursor: 'pointer', padding: '1px 7px' }}
              aria-label="Close agent sim overlay"
            >
              ×
            </button>
          </div>
          <TownAgentSnapshotView plan={plan} roster={roster} hour={Math.floor(clock)} clock={clock} width={300} height={300} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ background: 'rgba(13,17,23,0.92)', color: '#7ee787', border: '1px solid #30363d', borderRadius: 6, fontSize: 12, cursor: 'pointer', padding: '5px 10px' }}
        >
          ◴ Agent sim
        </button>
      )}
    </div>
  );
};

export default AgentSimDevOverlay;
