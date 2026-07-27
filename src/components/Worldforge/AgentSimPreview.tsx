// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:36:53
 * Dependents: App.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file AgentSimPreview.tsx — standalone preview for the WF-AGENTSIM motion slice.
 *
 * Reachable at `?phase=agentsim`. Generates a deterministic demo burg + roster
 * (same recipe as the in-game AgentSimDevOverlay) and renders its townsfolk via
 * `TownAgentSnapshotView`. There is ONE mode: the behaviour sim. Townsfolk decide
 * by their needs (sleep, eat, work, socialise, shop) and walk the streets to wherever
 * that sends them. Scrubbing the clock deterministically RE-SIMULATES the day from its
 * anchor to the chosen hour (`simulateMindsTo`), so scrub-anywhere lands on one truthful
 * state; pressing play advances that same state smoothly. The old fixed-schedule motion
 * (`townMotionSnapshotAt`) is retired from this preview — it survives as an internal
 * fallback for other consumers (dev overlay, 3D), not as a competing mode here.
 *
 * `window.__agentSimPreview` exposes `setClock(h)` and `current()` for headless
 * proof. Pure presentation over deterministic generators — no game state.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TownAgentSnapshotView from './TownAgentSnapshotView';
import { rootSeedPath } from '../../systems/worldforge/seedPath';
import { buildDemoTownPlan, DEMO_BURG_ID } from '../../systems/worldforge/town/demoTownPlan';
import { generateTownRoster } from '../../systems/worldforge/roster/generateTownRoster';
import {
  buildStreetGraph,
  frontDoorForPlot,
  routeAlongStreets,
  positionAlongPath,
  pathLength,
  type Point,
} from '../../systems/worldforge/roster/agentPath';
import { stepAgentSim, simulateMindsTo, type AgentMind, type AgentActivity } from '../../systems/worldforge/roster/agentSim';
import { assignFamilies, familySummary } from '../../systems/worldforge/roster/family';
import VillagerRegistry from './VillagerRegistry';

/** Per-activity dot colour for the behaviour-sim view. */
const ACTIVITY_HEX: Record<AgentActivity, string> = {
  sleep: '#5b6b8c', eat: '#7ee787', work: '#f5a742', socialize: '#d68cff', shop: '#79c0ff', home: '#8b949e',
};
/** Human phrasing for what an agent is doing (used in the villager card). */
const ACTIVITY_VERB: Record<AgentActivity, string> = {
  sleep: 'Sleeping', eat: 'Eating', work: 'Working', socialize: 'Socialising', shop: 'Running errands', home: 'Resting',
};

const SYLLABLES = ['ar', 'be', 'cor', 'dun', 'el', 'fen', 'gor', 'hal', 'kel', 'mor', 'tan', 'wyn'];

const AgentSimPreview: React.FC = () => {
  const [seed, setSeed] = useState(42);
  const [clock, setClock] = useState(7.25); // morning commute by default
  const [playing, setPlaying] = useState(false);
  // Playback rate in GAME-minutes per real second. The clock advances smoothly
  // (per animation frame) so time passes in fine, seconds-level steps — not
  // minute jumps — and you watch townsfolk stream along the streets.
  const [speed, setSpeed] = useState(0.5);
  // The villager registry panel (census + family ties) beside the map.
  const [showRegistry, setShowRegistry] = useState(true);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  // Every playback run owns one generation. A scrub invalidates that generation
  // immediately, so even a browser callback already queued for delivery cannot
  // advance the old clock after the deterministic replay has landed.
  const playbackGenerationRef = useRef(0);
  // Playback and scrub handlers update this authoritative clock synchronously;
  // it deliberately does not mirror React state during render, where a queued
  // frame could otherwise observe a value before the scrub has neutralised it.
  const clockRef = useRef(clock);
  // Behaviour-sim runtime: evolving minds + smoothed render positions (feet).
  const mindsRef = useRef<AgentMind[]>([]);
  const posRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Per-agent committed walk: the destination they're routing to + street path +
  // progress. They follow the ROADS and finish a walk before re-deciding, so they
  // never cut across buildings or hang midway when a decision flickers.
  const routeRef = useRef<Map<number, { destPlotId: number; route: Point[]; lenFt: number; progressFt: number }>>(new Map());
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [simAgents, setSimAgents] = useState<Array<{ occupantId: number; x: number; y: number; colorHex: string }>>([]);
  const [simStats, setSimStats] = useState<Record<AgentActivity, number>>({ sleep: 0, eat: 0, work: 0, socialize: 0, shop: 0, home: 0 });
  const [avgNeeds, setAvgNeeds] = useState({ energy: 0, satiety: 0, social: 0, wealth: 0 });

  // The town view fills whatever space the window gives it: measure the map column
  // and hand its live pixel size to the SVG (which fits the town to that box).
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapSize, setMapSize] = useState({ width: 620, height: 620 });
  useEffect(() => {
    const el = mapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setMapSize({ width: Math.max(120, el.clientWidth), height: Math.max(120, el.clientHeight) });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const { plan, roster, graph } = useMemo(() => {
    const seedPath = rootSeedPath(seed);
    // The town layout: a real Voronoi-ward town, synthesized from the seed.
    const p = buildDemoTownPlan(seed).plan;
    const nameFor = (rng: { next(): number }) => {
      const n = 2 + Math.floor(rng.next() * 2);
      let s = '';
      for (let i = 0; i < n; i++) s += SYLLABLES[Math.floor(rng.next() * SYLLABLES.length)];
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    const r = generateTownRoster(p, seedPath, { nameFor });
    return { plan: p, roster: r, graph: buildStreetGraph(p) };
  }, [seed]);

  // Ages + family ties + races for the roster (deterministic): card + coordination.
  const families = useMemo(() => assignFamilies(roster.occupants, rootSeedPath(seed)), [roster, seed]);
  const nameOf = useCallback((id: number) => roster.occupants.find((o) => o.id === id)?.name ?? 'someone', [roster]);

  // Plot centroids (feet) + gathering places + kinship — the behaviour sim's map.
  const { centroids, context } = useMemo(() => {
    const c = new Map<number, { x: number; y: number }>();
    for (const p of plan.plots) {
      const cx = p.footprint.reduce((a, q) => a + q[0], 0) / p.footprint.length;
      const cy = p.footprint.reduce((a, q) => a + q[1], 0) / p.footprint.length;
      c.set(p.id, { x: cx, y: cy });
    }
    const gatheringPlotIds = plan.plots.filter((p) => p.role === 'market' || p.role === 'workshop').map((p) => p.id);
    // Kinship for family coordination: a child's first parent + a spouse.
    const kin = new Map<number, { parentId?: number; spouseId?: number }>();
    for (const [id, t] of families) kin.set(id, { parentId: t.parentIds[0], spouseId: t.spouseId });
    return { centroids: c, context: { gatheringPlotIds, kin } };
  }, [plan, families]);

  // The street router is the single owner of known building endpoints. Waiting,
  // starting a route, and arriving all use the same door; malformed/no-street
  // plans keep the previous centroid fallback instead of losing an agent.
  const settledPositionForPlot = useCallback((plotId: number): { x: number; y: number } | undefined => {
    const door = frontDoorForPlot(graph, plotId);
    if (door) return { x: door[0], y: door[1] };
    return centroids.get(plotId);
  }, [graph, centroids]);

  // Build the renderable sim frame (positions + per-activity colour) and the HUD
  // stats from the current minds + smoothed positions.
  const buildSimFrame = useCallback(() => {
    const minds = mindsRef.current;
    const agents = minds.map((m) => {
      const p = posRef.current.get(m.occupantId) ?? settledPositionForPlot(m.targetPlotId) ?? { x: 0, y: 0 };
      return { occupantId: m.occupantId, x: p.x, y: p.y, colorHex: ACTIVITY_HEX[m.activity] };
    });
    const counts: Record<AgentActivity, number> = { sleep: 0, eat: 0, work: 0, socialize: 0, shop: 0, home: 0 };
    const sums = { energy: 0, satiety: 0, social: 0, wealth: 0 };
    for (const m of minds) {
      counts[m.activity]++;
      sums.energy += m.needs.energy; sums.satiety += m.needs.satiety; sums.social += m.needs.social; sums.wealth += m.needs.wealth;
    }
    const n = Math.max(1, minds.length);
    setSimAgents(agents);
    setSimStats(counts);
    setAvgNeeds({ energy: sums.energy / n, satiety: sums.satiety / n, social: sums.social / n, wealth: sums.wealth / n });
  }, [settledPositionForPlot]);

  // Deterministic scrub: replay the whole day from its anchor to `targetClock` and
  // SNAP every agent to the plot its decision sent them to. Same hour → same town,
  // every time (no carried-over frame state). Playback then continues smoothly from
  // this state; a fresh scrub re-derives it from scratch. Also the init/seed reset.
  const resimulate = useCallback((targetClock: number) => {
    const minds = simulateMindsTo(roster.occupants, context, targetClock);
    mindsRef.current = minds;
    const pos = new Map<number, { x: number; y: number }>();
    for (const m of minds) {
      pos.set(m.occupantId, settledPositionForPlot(m.targetPlotId) ?? { x: 0, y: 0 });
    }
    posRef.current = pos;
    routeRef.current = new Map(); // drop stale walk routes; playback re-commits them
    buildSimFrame();
  }, [roster, context, settledPositionForPlot, buildSimFrame]);

  // Seed/roster change (or first mount) → re-derive the town at the current hour.
  useEffect(() => {
    resimulate(clockRef.current);
  }, [resimulate]);

  // Cancel the browser request and invalidate its generation together. The
  // generation guard covers the narrow race where cancellation arrives after
  // the browser has already selected that callback for delivery.
  const cancelQueuedPlayback = useCallback(() => {
    playbackGenerationRef.current += 1;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTickRef.current = null;
  }, []);

  // Auto-play: advance the clock per animation frame by the elapsed real time
  // scaled by `speed` (game-minutes/sec). requestAnimationFrame's timestamp drives
  // it, so steps are sub-second-smooth and wrap cleanly at midnight.
  useEffect(() => {
    if (!playing) { lastTickRef.current = null; return; }
    const generation = playbackGenerationRef.current + 1;
    playbackGenerationRef.current = generation;
    let active = true;
    const tick = (t: number) => {
      if (!active || generation !== playbackGenerationRef.current) return;
      if (lastTickRef.current != null) {
        const dtSec = (t - lastTickRef.current) / 1000;
        const dHours = (dtSec * speed) / 60; // game-min/sec → hours
        const nextClock = (((clockRef.current + dHours) % 24) + 24) % 24;
        clockRef.current = nextClock;
        setClock(nextClock);
        // Advance the behaviour sim, then ease each agent toward the plot its
        // decision sent it to (smooth movement, not teleport). Playback picks up
        // from whatever state the last scrub/replay left, so the two agree.
        mindsRef.current = stepAgentSim(mindsRef.current, roster.occupants, { hour: nextClock, dtHours: dHours, context });
        const WALK_FT_PER_HOUR = 16000; // ~3 mph walking pace in the game-time frame
        for (const m of mindsRef.current) {
          const destination = settledPositionForPlot(m.targetPlotId);
          if (!destination) continue;
          let cur = posRef.current.get(m.occupantId) ?? destination;
          let rs = routeRef.current.get(m.occupantId);
          const arrived = !rs || rs.progressFt >= rs.lenFt;
          // Commit to a new destination ONLY when the current walk is finished —
          // so a flickering decision can't yank an agent mid-street (no hang), and
          // the path runs along the ROADS (routeAlongStreets), not across buildings.
          if (arrived && (!rs || rs.destPlotId !== m.targetPlotId)) {
            const route = routeAlongStreets(graph, [cur.x, cur.y] as Point, [destination.x, destination.y] as Point);
            rs = { destPlotId: m.targetPlotId, route, lenFt: Math.max(1, pathLength(route)), progressFt: 0 };
            routeRef.current.set(m.occupantId, rs);
          }
          if (rs && rs.progressFt < rs.lenFt) {
            rs.progressFt = Math.min(rs.lenFt, rs.progressFt + WALK_FT_PER_HOUR * dHours);
            const [px, py] = positionAlongPath(rs.route, rs.progressFt / rs.lenFt);
            cur = { x: px, y: py };
          } else {
            // Arrival stays on the canonical door, matching the final route point.
            cur = destination;
          }
          posRef.current.set(m.occupantId, cur);
        }
        buildSimFrame();
      }
      lastTickRef.current = t;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelQueuedPlayback();
    };
  }, [playing, speed, roster, context, graph, settledPositionForPlot, buildSimFrame, cancelQueuedPlayback]);

  // Scrubbing first neutralises the old playback generation, then updates the
  // authoritative clock before replay. React state may commit later, but neither
  // a stale frame nor the replay can observe the pre-scrub time.
  const setClockExt = useCallback((h: number) => {
    const w = ((h % 24) + 24) % 24;
    cancelQueuedPlayback();
    clockRef.current = w;
    setPlaying(false);
    setClock(w);
    resimulate(w);
  }, [cancelQueuedPlayback, resimulate]);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__agentSimPreview = {
      setClock: setClockExt,
      setSeed,
      setPlaying,
      setSpeed,
      current: () => ({ clock, total: mindsRef.current.length, playing, speed, simStats, avgNeeds }),
    };
    return () => { delete (window as unknown as Record<string, unknown>).__agentSimPreview; };
  }, [setClockExt, clock, playing, speed, simStats, avgNeeds]);

  const totalSec = Math.floor((((clock % 24) + 24) % 24) * 3600);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  // The villager under inspection: hovering previews, clicking pins. Resolved live
  // from the sim's minds + walk routes so the card tracks them as they move.
  const inspectId = hoveredId ?? selectedId;
  const inspect = (() => {
    if (inspectId == null) return null;
    const occ = roster.occupants.find((o) => o.id === inspectId);
    const mind = mindsRef.current.find((m) => m.occupantId === inspectId);
    if (!occ || !mind) return null;
    const rs = routeRef.current.get(inspectId);
    const walking = !!rs && rs.progressFt < rs.lenFt;
    const place = mind.targetPlotId === occ.homePlotId ? 'home'
      : (occ.workPlotId !== undefined && mind.targetPlotId === occ.workPlotId) ? 'their work'
      : 'the market';
    const status = walking ? `Heading to ${place}` : `${ACTIVITY_VERB[mind.activity]} at ${place}`;
    const fam = families.get(inspectId);
    return {
      occ, mind, status, pinned: selectedId === inspectId,
      age: fam?.age,
      race: fam?.race,
      family: fam ? familySummary(fam, nameOf) : null,
    };
  })();

  return (
    <div style={{ height: '100vh', width: '100vw', boxSizing: 'border-box', background: '#0b1220', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 10, padding: 16, overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Agent-Sim Motion Preview</h1>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
          Demo burg #{DEMO_BURG_ID} · townsfolk decide by their needs — sleep, eat, work, socialise —
          and walk the streets accordingly. Scrub the clock to re-simulate the day to any hour.
        </p>
      </div>

      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', gap: 10 }}>
      <div ref={mapRef} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <TownAgentSnapshotView
          plan={plan}
          roster={roster}
          hour={Math.floor(clock)}
          externalAgents={simAgents}
          onHoverAgent={setHoveredId}
          onClickAgent={(id) => setSelectedId((p) => (p === id ? null : id))}
          highlightId={inspectId}
          width={mapSize.width}
          height={mapSize.height}
        />
        {inspect && (
          <div
            data-testid="villager-card"
            style={{ position: 'absolute', top: 8, right: 8, width: 220, padding: 12, borderRadius: 8, background: 'rgba(13,17,23,0.95)', border: `1px solid ${inspect.pinned ? '#6d28d9' : '#30363d'}`, boxShadow: '0 6px 24px rgba(0,0,0,0.5)', fontSize: 12 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: 14, color: '#e2e8f0' }}>{inspect.occ.name}</strong>
              <span style={{ width: 9, height: 9, borderRadius: 5, background: ACTIVITY_HEX[inspect.mind.activity], display: 'inline-block' }} />
            </div>
            <div style={{ color: '#94a3b8', marginTop: 2 }}>
              {inspect.age != null ? `${inspect.age}` : inspect.occ.ageBand}{inspect.race ? ` · ${inspect.race}` : ''} · {inspect.occ.occupation}
            </div>
            {inspect.family && (
              <div style={{ color: '#a5b4fc', marginTop: 4, fontSize: 11 }}>👪 {inspect.family}</div>
            )}
            <div style={{ color: '#c9d1d9', marginTop: 8, fontWeight: 600 }}>{inspect.status}</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {([['energy', '#6ee7b7'], ['satiety', '#f5a742'], ['social', '#d68cff'], ['wealth', '#79c0ff']] as const).map(([k, col]) => (
                <div key={k}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 10 }}><span>{k}</span><span>{Math.round(inspect.mind.needs[k])}</span></div>
                  <div style={{ height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${inspect.mind.needs[k]}%`, height: '100%', background: col }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ color: '#64748b', marginTop: 8, fontSize: 10 }}>{inspect.pinned ? 'Pinned — click again to release' : 'Click to pin'}</div>
          </div>
        )}
      </div>
        {showRegistry && (
          <VillagerRegistry
            occupants={roster.occupants}
            families={families}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={(id) => setSelectedId(id)}
            onHover={setHoveredId}
            nameOf={nameOf}
          />
        )}
      </div>

      <div style={{ flex: '0 0 auto', width: '100%', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }} data-testid="agentsim-readout">
          <button
            onClick={() => setPlaying((p) => !p)}
            data-testid="agentsim-play"
            aria-label={playing ? 'Pause' : 'Play'}
            style={{ padding: '4px 12px', borderRadius: 6, background: playing ? '#7f1d1d' : '#15803d', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, minWidth: 84 }}
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>{hh}:{mm}:{ss}</strong>
          <span data-testid="agentsim-mode-label" style={{ color: '#a5b4fc', fontSize: 12, fontWeight: 600 }}>🧠 Behaviour sim</span>
        </div>
        <input
          type="range" min={0} max={24} step={1 / 3600} value={clock}
          onChange={(e) => setClockExt(Number(e.target.value))}
          aria-label="Town clock" data-testid="agentsim-clock"
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#94a3b8' }}>
          <span>Speed</span>
          {[0.1, 0.25, 0.5, 1, 3, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #334155', cursor: 'pointer', fontSize: 12, background: speed === s ? '#2563eb' : '#0f172a', color: 'white' }}
            >
              {s}m/s
            </button>
          ))}
          <span style={{ marginLeft: 4 }}>({Math.round((24 * 60) / speed)}s per day)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Seed</span>
          <input
            type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 1)}
            style={{ width: 110, padding: '4px 8px', borderRadius: 6, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}
          />
          {[6, 7, 8, 12, 18].map((h) => (
            <button
              key={h}
              onClick={() => setClockExt(h + 0.25)}
              style={{ padding: '4px 10px', borderRadius: 6, background: '#334155', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12 }}
            >
              {h}:15
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#94a3b8' }}>
          <span>{plan.plots.length} buildings</span>
          <button
            onClick={() => setShowRegistry((s) => !s)}
            data-testid="registry-toggle"
            style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', cursor: 'pointer', fontSize: 12, background: showRegistry ? '#6d28d9' : '#0f172a', color: 'white' }}
          >
            📋 Villagers
          </button>
        </div>

        {(
          <div data-testid="agentsim-hud" style={{ marginTop: 4, padding: 10, borderRadius: 8, background: '#0f172a', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* What everyone is doing right now. */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
              {(Object.keys(ACTIVITY_HEX) as AgentActivity[]).map((a) => (
                <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#c9d1d9' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: ACTIVITY_HEX[a], display: 'inline-block' }} />
                  {a} <strong>{simStats[a]}</strong>
                </span>
              ))}
            </div>
            {/* Town-wide average needs — watch them rise and fall over the day. */}
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8' }}>
              {([['energy', '#6ee7b7'], ['satiety', '#f5a742'], ['social', '#d68cff'], ['wealth', '#79c0ff']] as const).map(([k, col]) => (
                <div key={k} style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{k}</span><span>{Math.round(avgNeeds[k])}</span></div>
                  <div style={{ height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${avgNeeds[k]}%`, height: '100%', background: col }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentSimPreview;
