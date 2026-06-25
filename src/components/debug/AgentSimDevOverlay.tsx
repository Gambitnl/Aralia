import React, { useMemo, useState } from 'react';
import { useGameState } from '../../state/GameContext';
import { rootSeedPath } from '../../systems/worldforge/seedPath';
import { generateTownPlan } from '../../systems/worldforge/town/generateTownPlan';
import { generateTownRoster } from '../../systems/worldforge/roster/generateTownRoster';
import { scheduleHourFromGameTime } from '../../systems/worldforge/roster/gameClock';
import TownAgentSnapshotView from '../Worldforge/TownAgentSnapshotView';

/**
 * Dev-only live overlay for the agent-sim substrate (piece 2 mount point).
 * Generates a demo burg from the world seed and renders its townsfolk at the
 * CURRENT game hour — so the town visibly fills and empties as the game clock
 * advances. Self-contained: reads worldSeed + gameTime from state, owns its own
 * collapse toggle. No player-location coupling yet (demo burg), no persistent
 * state written. Mounted behind `isDevModeEnabled`.
 */

const DEMO_BURG_ID = 9001;

function buildDemoSite(worldSeed: number) {
  // A deterministic, sizeable burg envelope derived from the world seed.
  const size = 1800;
  const envelope = { x: 10_000, y: 20_000, width: size, height: size };
  const cx = envelope.x + size / 2;
  const cy = envelope.y + size / 2;
  const gates: Array<[number, number]> = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + (worldSeed % 7) * 0.1;
    gates.push([cx + Math.cos(a) * (size / 2), cy + Math.sin(a) * (size / 2)]);
  }
  return { burgId: DEMO_BURG_ID, envelope, gates };
}

const SYLLABLES = ['ar', 'be', 'cor', 'dun', 'el', 'fen', 'gor', 'hal', 'kel', 'mor', 'tan', 'wyn'];

const AgentSimDevOverlay: React.FC = () => {
  const { state } = useGameState();
  const [open, setOpen] = useState(false);

  const worldSeed = state.worldSeed ?? 1;

  // Demo town + roster regenerate only when the seed changes.
  const { plan, roster } = useMemo(() => {
    const seedPath = rootSeedPath(worldSeed);
    const p = generateTownPlan(buildDemoSite(worldSeed), seedPath);
    const nameFor = (rng: { next(): number }) => {
      const n = 2 + Math.floor(rng.next() * 2);
      let s = '';
      for (let i = 0; i < n; i++) s += SYLLABLES[Math.floor(rng.next() * SYLLABLES.length)];
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    const r = generateTownRoster(p, seedPath, { nameFor });
    return { plan: p, roster: r };
  }, [worldSeed]);

  const hour = state.gameTime instanceof Date ? scheduleHourFromGameTime(state.gameTime) : 0;

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 4000, fontFamily: 'sans-serif' }} data-testid="agent-sim-dev-overlay">
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
          <TownAgentSnapshotView plan={plan} roster={roster} hour={hour} width={300} height={300} />
          <div style={{ color: '#8b949e', fontSize: 10, marginTop: 4 }}>
            Live on the game clock — advance time to watch the town wake, work, and sleep.
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
