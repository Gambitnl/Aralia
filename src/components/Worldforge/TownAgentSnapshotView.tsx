import React, { useMemo } from 'react';
import type { TownPlan } from '../../systems/worldforge/artifacts';
import type { TownRoster } from '../../systems/worldforge/roster/types';
import { townSnapshotAt, type AgentSnapshot } from '../../systems/worldforge/roster/townSnapshot';
import type { ActivityKind } from '../../systems/worldforge/roster/occupantSchedule';

/**
 * Presentational debug overlay (piece 2 of the live agent-sim): renders a town's
 * occupants at a given hour as activity-colored dots over the building plots.
 * Pure — `hour` is a prop, not a live clock — so it's reusable by the in-game
 * overlay (clock-bound) AND a future minimap, and testable in isolation.
 */

const ACTIVITY_COLOR: Record<ActivityKind, string> = {
  sleeping: '#5b6b8c',
  home: '#79c0ff',
  working: '#f5a742',
  out: '#7ee787',
};

export interface TownAgentSnapshotViewProps {
  plan: TownPlan;
  roster: TownRoster;
  /** Hour of day, 0–23 (the schedule wraps out-of-range values). */
  hour: number;
  width?: number;
  height?: number;
}

/** Deterministic small offset so agents sharing a plot read as a little crowd. */
const jitter = (id: number, r = 6): [number, number] => [Math.cos(id * 2.4) * r, Math.sin(id * 2.4) * r];

const TownAgentSnapshotView: React.FC<TownAgentSnapshotViewProps> = ({
  plan,
  roster,
  hour,
  width = 480,
  height = 480,
}) => {
  const agents = useMemo<AgentSnapshot[]>(() => townSnapshotAt(plan, roster, hour), [plan, roster, hour]);

  const fit = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of plan.plots) {
      for (const [x, y] of p.footprint) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }
    const pad = 16;
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const k = (Math.min(width, height) - 2 * pad) / span;
    return { k, ox: pad - minX * k, oy: pad - minY * k };
  }, [plan, width, height]);

  const X = (x: number): number => x * fit.k + fit.ox;
  const Y = (y: number): number => y * fit.k + fit.oy;

  const tally = useMemo(() => {
    const t: Record<ActivityKind, number> = { sleeping: 0, home: 0, working: 0, out: 0 };
    for (const a of agents) t[a.activity]++;
    return t;
  }, [agents]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#0d1117', borderRadius: 6 }}
      data-testid="town-agent-snapshot"
      data-hour={((hour % 24) + 24) % 24}
    >
      {/* Building plots (faint base). */}
      {plan.plots.map((p) => (
        <path
          key={`plot-${p.id}`}
          d={'M' + p.footprint.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('L') + 'Z'}
          fill={p.role === 'market' ? '#3a2f1a' : p.role === 'workshop' ? '#2f2a1a' : '#23262d'}
          stroke="#333a44"
          strokeWidth={0.5}
        />
      ))}
      {/* Occupants, colored by activity. */}
      {agents.map((a) => {
        const [jx, jy] = jitter(a.occupantId);
        return (
          <circle
            key={`agent-${a.occupantId}`}
            cx={(X(a.x) + jx).toFixed(1)}
            cy={(Y(a.y) + jy).toFixed(1)}
            r={2.4}
            fill={ACTIVITY_COLOR[a.activity]}
            fillOpacity={0.92}
            data-activity={a.activity}
          />
        );
      })}
      {/* Legend + clock. */}
      <text x={10} y={18} fontFamily="sans-serif" fontSize={12} fill="#c9d1d9">
        {String(((hour % 24) + 24) % 24).padStart(2, '0')}:00 — {agents.length} townsfolk
        {`  (working ${tally.working}, out ${tally.out}, home ${tally.home}, asleep ${tally.sleeping})`}
      </text>
    </svg>
  );
};

export default TownAgentSnapshotView;
