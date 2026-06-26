import React, { useMemo } from 'react';
import type { TownPlan } from '../../systems/worldforge/artifacts';
import type { TownRoster } from '../../systems/worldforge/roster/types';
import { townSnapshotAt, townMotionSnapshotAt, type AgentSnapshot, type MovingAgentSnapshot } from '../../systems/worldforge/roster/townSnapshot';
import { buildStreetGraph, type Point } from '../../systems/worldforge/roster/agentPath';
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
  /**
   * Optional FRACTIONAL clock (hours, e.g. 7.5). When set, agents are placed with
   * continuous street motion (`townMotionSnapshotAt`) instead of snapping to plot
   * centroids — commuters are drawn walking the streets. Overrides `hour`.
   */
  clock?: number;
  /**
   * Externally-driven agents (e.g. the WF-AGENTSIM behaviour layer), already in
   * plan/feet coords with a per-agent colour. When provided, these are rendered
   * INSTEAD of the schedule snapshot — so a needs/decision sim can place people
   * wherever it decides, coloured by activity. Streets still draw for context.
   */
  externalAgents?: Array<{ occupantId: number; x: number; y: number; colorHex: string }>;
  /** Hover/click an agent dot to inspect it. Fires the occupant id (null on leave). */
  onHoverAgent?: (occupantId: number | null) => void;
  onClickAgent?: (occupantId: number) => void;
  /** Occupant id to highlight (hovered/selected) with a ring. */
  highlightId?: number | null;
  width?: number;
  height?: number;
}

/** Deterministic small offset so agents sharing a plot read as a little crowd. */
const jitter = (id: number, r = 6): [number, number] => [Math.cos(id * 2.4) * r, Math.sin(id * 2.4) * r];

const TownAgentSnapshotView: React.FC<TownAgentSnapshotViewProps> = ({
  plan,
  roster,
  hour,
  clock,
  externalAgents,
  onHoverAgent,
  onClickAgent,
  highlightId = null,
  width = 480,
  height = 480,
}) => {
  const external = externalAgents !== undefined;
  const motion = clock !== undefined || external;
  // Street graph only needed in motion mode; built once per plan.
  const graph = useMemo(() => (motion ? buildStreetGraph(plan) : null), [motion, plan]);
  const agents = useMemo<AgentSnapshot[] | MovingAgentSnapshot[]>(
    () => {
      if (external) return []; // sim drives placement; skip the schedule snapshot
      return clock !== undefined && graph ? townMotionSnapshotAt(plan, graph, roster, clock) : townSnapshotAt(plan, roster, hour);
    },
    [external, graph, plan, roster, clock, hour],
  );
  // The effective hour shown in the legend (the fractional clock if any, else hour).
  const shownHour = clock !== undefined ? Math.floor(((clock % 24) + 24) % 24) : ((hour % 24) + 24) % 24;

  // Undirected street edges (motion mode) so agents are seen walking ON streets,
  // not through empty space. Dedupe by drawing each edge once (i < to).
  const streetEdges = useMemo<Array<[Point, Point]>>(() => {
    if (!graph) return [];
    const edges: Array<[Point, Point]> = [];
    graph.adj.forEach((nbrs, i) => {
      for (const { to } of nbrs) if (i < to) edges.push([graph.nodes[i], graph.nodes[to]]);
    });
    return edges;
  }, [graph]);

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
      data-hour={shownHour}
      data-motion={motion ? '1' : '0'}
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
      {/* Street network (motion mode): faint lines so agents read as walking ON
          the streets between buildings, not through empty space. */}
      {streetEdges.map(([a, b], i) => (
        <line
          key={`street-${i}`}
          x1={X(a[0]).toFixed(1)} y1={Y(a[1]).toFixed(1)}
          x2={X(b[0]).toFixed(1)} y2={Y(b[1]).toFixed(1)}
          stroke="#3b4250" strokeWidth={1.4} strokeLinecap="round" strokeOpacity={0.8}
          data-testid="street-edge"
        />
      ))}
      {/* WF-AGENTSIM mode: render the externally-decided agents, coloured by the
          sim's per-agent colour (activity). */}
      {external && externalAgents!.map((a) => {
        const [jx, jy] = jitter(a.occupantId, 3);
        const cx = X(a.x) + jx;
        const cy = Y(a.y) + jy;
        const hot = highlightId === a.occupantId;
        const interactive = !!(onHoverAgent || onClickAgent);
        return (
          <g
            key={`sim-agent-${a.occupantId}`}
            onPointerEnter={onHoverAgent ? () => onHoverAgent(a.occupantId) : undefined}
            onPointerLeave={onHoverAgent ? () => onHoverAgent(null) : undefined}
            onClick={onClickAgent ? () => onClickAgent(a.occupantId) : undefined}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          >
            {hot && (
              <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={6} fill="none" stroke="#ffffff" strokeWidth={1.5} data-testid="sim-agent-highlight" />
            )}
            <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={2.6} fill={a.colorHex} fillOpacity={0.95} data-testid="sim-agent" />
            {/* Enlarged transparent hit target so tiny dots are easy to hover. */}
            {interactive && <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={7} fill="transparent" />}
          </g>
        );
      })}
      {/* Occupants, colored by activity. In motion mode, walkers get no jitter
          (their position is their true street point) and a pale ring so a
          commuting crowd reads as moving, not clustered. */}
      {!external && agents.map((a) => {
        const walking = motion && (a as MovingAgentSnapshot).moving;
        const [jx, jy] = walking ? [0, 0] : jitter(a.occupantId);
        const cx = X(a.x) + jx;
        const cy = Y(a.y) + jy;
        return (
          <g key={`agent-${a.occupantId}`}>
            {walking && (
              <circle cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={4.2} fill="none" stroke="#f5f5f5" strokeWidth={0.8} strokeOpacity={0.7} data-testid="agent-walking" />
            )}
            <circle
              cx={cx.toFixed(1)}
              cy={cy.toFixed(1)}
              r={2.4}
              fill={ACTIVITY_COLOR[a.activity]}
              fillOpacity={0.92}
              data-activity={a.activity}
            />
          </g>
        );
      })}
      {/* Legend + clock. */}
      <text x={10} y={18} fontFamily="sans-serif" fontSize={12} fill="#c9d1d9">
        {String(shownHour).padStart(2, '0')}:{clock !== undefined ? String(Math.floor((((clock % 1) + 1) % 1) * 60)).padStart(2, '0') : '00'}
        {external
          ? ` — ${externalAgents!.length} townsfolk (behaviour sim)`
          : ` — ${agents.length} townsfolk  (working ${tally.working}, out ${tally.out}, home ${tally.home}, asleep ${tally.sleeping})`}
      </text>
    </svg>
  );
};

export default TownAgentSnapshotView;
