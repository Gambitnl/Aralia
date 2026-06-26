/**
 * @file AgentSimPreview.tsx — standalone preview for the WF-AGENTSIM motion slice.
 *
 * Reachable at `?phase=agentsim`. Generates a deterministic demo burg + roster
 * (same recipe as the in-game AgentSimDevOverlay) and renders its townsfolk via
 * `TownAgentSnapshotView` in MOTION mode: as the clock scrubs the day, commuters
 * walk the streets between home and work instead of teleporting at the hour
 * boundary. This is the visual sign-off for the street-movement layer
 * (`townMotionSnapshotAt`), reachable without a playing session.
 *
 * `window.__agentSimPreview` exposes `setClock(h)` and `current()` for headless
 * proof. Pure presentation over deterministic generators — no game state.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TownAgentSnapshotView from './TownAgentSnapshotView';
import { rootSeedPath } from '../../systems/worldforge/seedPath';
import { generateTownPlan } from '../../systems/worldforge/town/generateTownPlan';
import { generateTownPlan as generateVoronoiTown, polygonCentroid } from '../../systems/worldforge/town/townEngine';
import { voronoiTownToArtifactPlan } from '../../systems/worldforge/town/voronoiTownAdapter';
import { generateSubmap, type Pt } from '../../systems/worldforge/submap/submapEngine';
import { generateTownRoster } from '../../systems/worldforge/roster/generateTownRoster';
import { buildStreetGraph, routeAlongStreets, positionAlongPath, pathLength, type Point } from '../../systems/worldforge/roster/agentPath';
import { townMotionSnapshotAt } from '../../systems/worldforge/roster/townSnapshot';
import { initAgentMinds, stepAgentSim, type AgentMind, type AgentActivity } from '../../systems/worldforge/roster/agentSim';
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

const DEMO_BURG_ID = 9001;
const SYLLABLES = ['ar', 'be', 'cor', 'dun', 'el', 'fen', 'gor', 'hal', 'kel', 'mor', 'tan', 'wyn'];

function buildDemoSite(worldSeed: number) {
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

/**
 * A real Voronoi cell to host the ward town: tessellate a square region, then take
 * the cell nearest its centre as the burg footprint (mirrors a world-map burg cell).
 */
function buildVoronoiCellFootprint(worldSeed: number): Pt[] {
  const span = 3600;
  const square: Pt[] = [[0, 0], [span, 0], [span, span], [0, span]];
  const region = generateSubmap({ polygon: square, seedPath: rootSeedPath(worldSeed) }, { count: 14 });
  const centre: Pt = [span / 2, span / 2];
  let best = region.cells[0]?.polygon ?? square;
  let bestD = Infinity;
  for (const c of region.cells) {
    const ctr = polygonCentroid(c.polygon);
    const d = Math.hypot(ctr[0] - centre[0], ctr[1] - centre[1]);
    if (d < bestD) { bestD = d; best = c.polygon; }
  }
  return best;
}

/** Build the Voronoi-ward town plan (adapted to the roster/motion artifact plan). */
function buildVoronoiTownPlan(worldSeed: number) {
  const footprint = buildVoronoiCellFootprint(worldSeed);
  const town = generateVoronoiTown(footprint, rootSeedPath(worldSeed), { population: 700 });
  return voronoiTownToArtifactPlan(town, DEMO_BURG_ID);
}

const AgentSimPreview: React.FC = () => {
  const [seed, setSeed] = useState(42);
  const [clock, setClock] = useState(7.25); // morning commute by default
  const [playing, setPlaying] = useState(false);
  // Playback rate in GAME-minutes per real second. The clock advances smoothly
  // (per animation frame) so time passes in fine, seconds-level steps — not
  // minute jumps — and you watch townsfolk stream along the streets.
  const [speed, setSpeed] = useState(0.5);
  // Behaviour sim (needs/decisions/interactions) vs the fixed schedule motion.
  const [simMode, setSimMode] = useState(false);
  // Town layout source: a real Voronoi-ward town (default), or the radial demo burg.
  const [townSource, setTownSource] = useState<'demo' | 'voronoi'>('voronoi');
  // The villager registry panel (census + family ties) beside the map.
  const [showRegistry, setShowRegistry] = useState(true);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const clockRef = useRef(clock);
  clockRef.current = clock;
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
    // The town layout: radial demo burg, or a real Voronoi-ward town (adapted).
    const p = townSource === 'voronoi'
      ? buildVoronoiTownPlan(seed)
      : generateTownPlan(buildDemoSite(seed), seedPath);
    const nameFor = (rng: { next(): number }) => {
      const n = 2 + Math.floor(rng.next() * 2);
      let s = '';
      for (let i = 0; i < n; i++) s += SYLLABLES[Math.floor(rng.next() * SYLLABLES.length)];
      return s.charAt(0).toUpperCase() + s.slice(1);
    };
    const r = generateTownRoster(p, seedPath, { nameFor });
    return { plan: p, roster: r, graph: buildStreetGraph(p) };
  }, [seed, townSource]);

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

  // Build the renderable sim frame (positions + per-activity colour) and the HUD
  // stats from the current minds + smoothed positions.
  const buildSimFrame = useCallback(() => {
    const minds = mindsRef.current;
    const agents = minds.map((m) => {
      const p = posRef.current.get(m.occupantId) ?? centroids.get(m.targetPlotId) ?? { x: 0, y: 0 };
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
  }, [centroids]);

  // (Re)initialise minds + positions when entering sim mode or changing seed.
  useEffect(() => {
    if (!simMode) return;
    mindsRef.current = initAgentMinds(roster.occupants);
    const pos = new Map<number, { x: number; y: number }>();
    for (const o of roster.occupants) pos.set(o.id, centroids.get(o.homePlotId) ?? { x: 0, y: 0 });
    posRef.current = pos;
    routeRef.current = new Map(); // drop stale walk routes
    buildSimFrame();
  }, [simMode, roster, centroids, buildSimFrame]);

  const snapshot = useMemo(() => townMotionSnapshotAt(plan, graph, roster, clock), [plan, graph, roster, clock]);
  const walking = snapshot.filter((a) => a.moving).length;

  // Auto-play: advance the clock per animation frame by the elapsed real time
  // scaled by `speed` (game-minutes/sec). requestAnimationFrame's timestamp drives
  // it, so steps are sub-second-smooth and wrap cleanly at midnight.
  useEffect(() => {
    if (!playing) { lastTickRef.current = null; return; }
    let active = true;
    const tick = (t: number) => {
      if (!active) return;
      if (lastTickRef.current != null) {
        const dtSec = (t - lastTickRef.current) / 1000;
        const dHours = (dtSec * speed) / 60; // game-min/sec → hours
        const nextClock = (((clockRef.current + dHours) % 24) + 24) % 24;
        clockRef.current = nextClock;
        setClock(nextClock);
        if (simMode) {
          // Advance the behaviour sim, then ease each agent toward the plot its
          // decision sent it to (smooth movement, not teleport).
          mindsRef.current = stepAgentSim(mindsRef.current, roster.occupants, { hour: nextClock, dtHours: dHours, context });
          const WALK_FT_PER_HOUR = 16000; // ~3 mph walking pace in the game-time frame
          for (const m of mindsRef.current) {
            const destC = centroids.get(m.targetPlotId);
            if (!destC) continue;
            let cur = posRef.current.get(m.occupantId) ?? destC;
            let rs = routeRef.current.get(m.occupantId);
            const arrived = !rs || rs.progressFt >= rs.lenFt;
            // Commit to a new destination ONLY when the current walk is finished —
            // so a flickering decision can't yank an agent mid-street (no hang), and
            // the path runs along the ROADS (routeAlongStreets), not across buildings.
            if (arrived && (!rs || rs.destPlotId !== m.targetPlotId)) {
              const route = routeAlongStreets(graph, [cur.x, cur.y] as Point, [destC.x, destC.y] as Point);
              rs = { destPlotId: m.targetPlotId, route, lenFt: Math.max(1, pathLength(route)), progressFt: 0 };
              routeRef.current.set(m.occupantId, rs);
            }
            if (rs && rs.progressFt < rs.lenFt) {
              rs.progressFt = Math.min(rs.lenFt, rs.progressFt + WALK_FT_PER_HOUR * dHours);
              const [px, py] = positionAlongPath(rs.route, rs.progressFt / rs.lenFt);
              cur = { x: px, y: py };
            } else {
              cur = destC; // arrived and at the right plot → rest at its centre
            }
            posRef.current.set(m.occupantId, cur);
          }
          buildSimFrame();
        }
      }
      lastTickRef.current = t;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, simMode, roster, context, centroids, graph, buildSimFrame]);

  const setClockExt = useCallback((h: number) => setClock(((h % 24) + 24) % 24), []);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__agentSimPreview = {
      setClock: setClockExt,
      setSeed,
      setPlaying,
      setSpeed,
      setSimMode,
      current: () => ({ clock, walking, total: snapshot.length, playing, speed, simMode, simStats, avgNeeds }),
    };
    return () => { delete (window as unknown as Record<string, unknown>).__agentSimPreview; };
  }, [setClockExt, clock, walking, snapshot.length, playing, speed, simMode, simStats, avgNeeds]);

  const totalSec = Math.floor((((clock % 24) + 24) % 24) * 3600);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  // The villager under inspection: hovering previews, clicking pins. Resolved live
  // from the sim's minds + walk routes so the card tracks them as they move.
  const inspectId = hoveredId ?? selectedId;
  const inspect = (() => {
    if (!simMode || inspectId == null) return null;
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
          Demo burg #{DEMO_BURG_ID} · {simMode
            ? 'townsfolk decide by their needs — sleep, eat, work, socialise — and wander accordingly.'
            : 'townsfolk walk streets between home and work as the clock advances.'}
        </p>
      </div>

      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', gap: 10 }}>
      <div ref={mapRef} style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <TownAgentSnapshotView
          plan={plan}
          roster={roster}
          hour={Math.floor(clock)}
          clock={simMode ? undefined : clock}
          externalAgents={simMode ? simAgents : undefined}
          onHoverAgent={simMode ? setHoveredId : undefined}
          onClickAgent={simMode ? ((id) => setSelectedId((p) => (p === id ? null : id))) : undefined}
          highlightId={simMode ? inspectId : null}
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
          <button
            onClick={() => setSimMode((s) => !s)}
            data-testid="agentsim-mode"
            style={{ padding: '4px 12px', borderRadius: 6, background: simMode ? '#6d28d9' : '#334155', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
          >
            {simMode ? '🧠 Behaviour sim' : '🕒 Schedule'}
          </button>
          {!simMode && <span style={{ color: walking > 0 ? '#6ee7b7' : '#94a3b8', fontSize: 13 }}>{walking} walking</span>}
        </div>
        <input
          type="range" min={0} max={24} step={1 / 3600} value={clock}
          onChange={(e) => { setPlaying(false); setClock(Number(e.target.value)); }}
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
              onClick={() => setClock(h + 0.25)}
              style={{ padding: '4px 10px', borderRadius: 6, background: '#334155', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12 }}
            >
              {h}:15
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#94a3b8' }}>
          <span>Town</span>
          {([['demo', 'Demo burg'], ['voronoi', 'Voronoi town']] as const).map(([src, label]) => (
            <button
              key={src}
              onClick={() => setTownSource(src)}
              data-testid={`town-source-${src}`}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', cursor: 'pointer', fontSize: 12, background: townSource === src ? '#6d28d9' : '#0f172a', color: 'white' }}
            >
              {label}
            </button>
          ))}
          <span style={{ marginLeft: 4 }}>{plan.plots.length} buildings</span>
          <button
            onClick={() => setShowRegistry((s) => !s)}
            data-testid="registry-toggle"
            style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', cursor: 'pointer', fontSize: 12, background: showRegistry ? '#6d28d9' : '#0f172a', color: 'white' }}
          >
            📋 Villagers
          </button>
        </div>

        {simMode && (
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
