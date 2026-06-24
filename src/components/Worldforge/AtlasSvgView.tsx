// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/06/2026, 16:10:24
 * Dependents: components/MapPane.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';
import { buildAtlasSvgModel, declutterLabels, findCellAtPoint, cellTraits, cellPolygonPoints, type CellTraits } from './atlasSvg';
import AtlasLayers from './AtlasLayers';
import type { RoutePlan } from '../../systems/travel/routePlanning';
import { formatRouteSummary, dangerRating } from '../../systems/travel/travelReadout';

/** How much detail the hover info panel shows. */
type InfoVerbosity = 'off' | 'minimal' | 'standard' | 'full';
const INFO_VERBOSITY_OPTIONS: Array<{ id: InfoVerbosity; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'standard', label: 'Standard' },
  { id: 'full', label: 'Full' },
];

export interface AtlasSvgViewProps {
  atlas: FmgAtlasResult;
  width?: number;
  height?: number;
  /** Always-on "you are here" marker, in graph coords (SP0 T7). */
  marker?: { x: number; y: number } | null;
  /** Discovered-place pins, in graph coords (SP4 atlas pins). */
  markers?: Array<{ x: number; y: number; label?: string }>;
  /** Fired with the picked cell's traits on click (SP0 T7). */
  onPickCell?: (info: CellTraits) => void;
  /** Travel mode: when true, hovering a cell previews the fastest route to it. */
  travelActive?: boolean;
  /** Plan the fastest route from the player to a hovered cell id (MapPane supplies). */
  planRoute?: (toCell: number) => RoutePlan | null;
  /** Transport label for the travel readout (e.g. "on foot", "by horse"). */
  transportLabel?: string;
}

/**
 * Native SVG atlas (SP0): ocean depth bands + merged per-biome land regions
 * (soften-filtered, no facets) + rivers + routes + state borders + burgs +
 * decluttered labels, with manual wheel-zoom / drag-pan. Click picks the cell
 * under the cursor (owned nearest-site lookup) and an always-on marker shows the
 * current location. No iframe.
 */
// ── Map coloring (mutually exclusive base) ────────────────────────────────────
// These all tint the WHOLE land area, so only one can read at a time. Modelling
// them as independent checkboxes (the old design) let a player stack several
// semi-transparent fills into an unreadable, meaningless soup — and turning the
// one base (Biomes) off blanked the land entirely. They are now a single radio:
// pick what the land is colored BY. A neutral land base is always drawn beneath.
type AreaModeId =
  | 'biomes' | 'cultures' | 'religions' | 'provinces'
  | 'population' | 'temperature' | 'precipitation' | 'none';
type LegendKind = 'biomes' | 'discrete' | 'ramp' | 'none';
interface AreaModeDef {
  id: AreaModeId;
  label: string;
  desc: string;
  legend: LegendKind;
  /** 3-stop gradient (matches the renderer's ramp) + end labels, for ramp legends. */
  ramp?: [string, string, string];
  ends?: [string, string];
  /** Model key whose emptiness disables this mode (undefined ⇒ always available). */
  dataKey?: keyof import('./atlasSvg').AtlasSvgModel;
  /** Discrete-legend noun for the "each color = one ___" caption. */
  noun?: string;
}
const AREA_MODES: AreaModeDef[] = [
  { id: 'biomes', label: 'Biomes', desc: 'Natural terrain type (forest, desert, tundra…)', legend: 'biomes' },
  { id: 'cultures', label: 'Cultures', desc: 'Which culture inhabits each region', legend: 'discrete', dataKey: 'cultureRegions', noun: 'culture' },
  { id: 'religions', label: 'Religions', desc: 'Dominant faith of each region', legend: 'discrete', dataKey: 'religionRegions', noun: 'religion' },
  { id: 'provinces', label: 'Provinces', desc: 'Administrative provinces within states', legend: 'discrete', dataKey: 'provinceRegions', noun: 'province' },
  { id: 'population', label: 'Population', desc: 'How densely each area is settled', legend: 'ramp', ramp: ['#ffffcc', '#fd8d3c', '#800026'], ends: ['Sparse', 'Dense'], dataKey: 'populationCells' },
  { id: 'temperature', label: 'Temperature', desc: 'Average temperature, cold to hot', legend: 'ramp', ramp: ['#2c7bb6', '#ffffbf', '#d7191c'], ends: ['Cold', 'Hot'], dataKey: 'temperatureCells' },
  { id: 'precipitation', label: 'Precipitation', desc: 'Rainfall, dry to wet', legend: 'ramp', ramp: ['#f6e8c3', '#80cdc1', '#01665e'], ends: ['Dry', 'Wet'], dataKey: 'precipitationCells' },
  { id: 'none', label: 'None (plain land)', desc: 'Flat parchment land — features only', legend: 'none' },
];

// ── Feature layers (independent toggles, drawn on top of the coloring) ─────────
type FeatureLayerId =
  | 'rivers' | 'routes' | 'borders' | 'coast' | 'ice' | 'zones' | 'military'
  | 'burgs' | 'markers' | 'labels' | 'cells' | 'grid' | 'vignette';
interface FeatureLayerDef {
  id: FeatureLayerId;
  label: string;
  group: 'Features' | 'Places' | 'Reference';
  desc: string;
  /** Model key whose emptiness disables this toggle (undefined ⇒ always available). */
  dataKey?: keyof import('./atlasSvg').AtlasSvgModel;
}
const FEATURE_LAYERS: FeatureLayerDef[] = [
  { id: 'rivers', label: 'Rivers', group: 'Features', desc: 'Watercourses, widening downstream' },
  { id: 'routes', label: 'Routes', group: 'Features', desc: 'Roads, trails and sea lanes' },
  { id: 'borders', label: 'State borders', group: 'Features', desc: 'Political boundaries between states' },
  { id: 'coast', label: 'Coastline', group: 'Features', desc: 'Inked shore between land and sea' },
  { id: 'ice', label: 'Ice', group: 'Features', desc: 'Glaciers and frozen sea', dataKey: 'iceCells' },
  { id: 'zones', label: 'Zones', group: 'Features', desc: 'Event/danger areas: wars, plagues, disasters', dataKey: 'zoneCells' },
  { id: 'military', label: 'Military', group: 'Features', desc: 'State regiments and fleets', dataKey: 'regiments' },
  { id: 'burgs', label: 'Burgs', group: 'Places', desc: 'Towns and cities (★ = capital)' },
  { id: 'markers', label: 'Markers', group: 'Places', desc: 'Points of interest', dataKey: 'poiMarkers' },
  { id: 'labels', label: 'Labels', group: 'Places', desc: 'State and settlement names' },
  { id: 'cells', label: 'Cells', group: 'Reference', desc: 'Voronoi cell mesh — the clickable grid' },
  { id: 'grid', label: 'Grid', group: 'Reference', desc: 'Latitude/longitude reference lines' },
  { id: 'vignette', label: 'Vignette', group: 'Reference', desc: 'Darkened map edges (cosmetic)' },
];
const FEATURE_GROUPS: Array<FeatureLayerDef['group']> = ['Features', 'Places', 'Reference'];

const DEFAULT_FEATURES: Record<FeatureLayerId, boolean> = {
  rivers: true, routes: true, borders: true, coast: true, ice: false, zones: false, military: false,
  burgs: true, markers: false, labels: true, cells: false, grid: false, vignette: false,
};
const DEFAULT_AREA_MODE: AreaModeId = 'biomes';
const LAYER_PREFS_KEY = 'aralia.atlas.layerPrefs.v1';

const SECTION_HEADER: React.CSSProperties = {
  color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: 0.5, marginBottom: 3,
};

const AtlasSvgView: React.FC<AtlasSvgViewProps> = ({ atlas, width = 960, height = 540, marker = null, markers = [], onPickCell, travelActive = false, planRoute, transportLabel = 'on foot' }) => {
  const model = useMemo(() => buildAtlasSvgModel(atlas), [atlas]);

  // Map coloring is a single exclusive choice; feature layers are independent
  // toggles. Persisted across map opens so a player's preferred view sticks.
  const [mapMode, setMapMode] = useState<AreaModeId>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYER_PREFS_KEY) || '{}');
      if (saved.mapMode && AREA_MODES.some((m) => m.id === saved.mapMode)) return saved.mapMode;
    } catch { /* ignore */ }
    return DEFAULT_AREA_MODE;
  });
  const [features, setFeatures] = useState<Record<FeatureLayerId, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYER_PREFS_KEY) || '{}');
      if (saved.features) return { ...DEFAULT_FEATURES, ...saved.features };
    } catch { /* ignore */ }
    return { ...DEFAULT_FEATURES };
  });
  useEffect(() => {
    try { localStorage.setItem(LAYER_PREFS_KEY, JSON.stringify({ mapMode, features })); } catch { /* ignore */ }
  }, [mapMode, features]);

  const [layersOpen, setLayersOpen] = useState(false);
  const toggleFeature = (id: FeatureLayerId) => setFeatures((f) => ({ ...f, [id]: !f[id] }));
  const resetLayers = () => { setMapMode(DEFAULT_AREA_MODE); setFeatures({ ...DEFAULT_FEATURES }); };

  // How many features each potentially-empty layer actually has — drives the
  // "(none on this map)" affordance so toggling an empty layer isn't read as a bug.
  const layerCounts = useMemo(() => {
    const count = (key?: keyof typeof model): number => {
      if (!key) return Infinity; // always-available layer
      const v = model[key] as unknown;
      return Array.isArray(v) ? v.length : Infinity;
    };
    const area: Partial<Record<AreaModeId, number>> = {};
    for (const m of AREA_MODES) area[m.id] = count(m.dataKey);
    const feat: Partial<Record<FeatureLayerId, number>> = {};
    for (const f of FEATURE_LAYERS) feat[f.id] = count(f.dataKey);
    return { area, feat };
  }, [model]);

  // The flat visibility map AtlasLayers expects, derived from the exclusive
  // mapMode + the feature toggles. Identity changes only when a real choice
  // changes (not on hover/pan), preserving the memoized layer subtree.
  const visible = useMemo<Record<string, boolean>>(() => ({
    biomes: mapMode === 'biomes',
    cultures: mapMode === 'cultures',
    religions: mapMode === 'religions',
    provinces: mapMode === 'provinces',
    population: mapMode === 'population',
    temperature: mapMode === 'temperature',
    precipitation: mapMode === 'precipitation',
    ...features,
  }), [mapMode, features]);

  const activeMode = AREA_MODES.find((m) => m.id === mapMode) ?? AREA_MODES[0];
  // Hover read-out: the cell under the cursor (highlighted + described), and how
  // much of its info the bottom-left panel shows.
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [infoVerbosity, setInfoVerbosity] = useState<InfoVerbosity>('standard');
  const fitView = useCallback(() => {
    const k = Math.min(width / model.width, height / model.height);
    return {
      k,
      x: (width - model.width * k) / 2,
      y: (height - model.height * k) / 2,
    };
  }, [height, model.height, model.width, width]);
  const [view, setView] = useState(fitView);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // The parent MapPane measures the available panel space. Refit the atlas
    // whenever that space changes so the SVG fills the visible window area.
    setView(fitView());
  }, [fitView]);

  // Wheel-zoom must call preventDefault to stop the page from scrolling, but
  // React's onWheel prop registers a PASSIVE listener (preventDefault is a no-op
  // and warns). Attach a native non-passive listener on the svg via the ref.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => {
        const nextK = Math.max(0.05, Math.min(64, v.k * factor));
        // Anchor the zoom on the cursor: keep the map point under the pointer
        // fixed by solving translate' = p - worldPointUnderCursor * nextK.
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
          return { ...v, k: nextK };
        }
        // Map the pointer into SVG user units (viewBox is 0 0 width height).
        const px = (e.clientX - rect.left) * (width / rect.width);
        const py = (e.clientY - rect.top) * (height / rect.height);
        const wx = (px - v.x) / v.k;
        const wy = (py - v.y) / v.k;
        return { k: nextK, x: px - wx * nextK, y: py - wy * nextK };
      });
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [width, height]);
  const onDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX - view.x, y: e.clientY - view.y };
    downPos.current = { x: e.clientX, y: e.clientY };
  };
  // Pointer (client) → atlas graph coords, accounting for pan/zoom + svg scaling.
  const pointerToGraph = (clientX: number, clientY: number): { gx: number; gy: number } | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const sx = (clientX - rect.left) * (width / rect.width);
    const sy = (clientY - rect.top) * (height / rect.height);
    return { gx: (sx - view.x) / view.k, gy: (sy - view.y) / view.k };
  };
  const onMove = (e: React.MouseEvent) => {
    if (drag.current) {
      setView((v) => ({ ...v, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }));
      return;
    }
    // Hover: resolve and highlight the cell under the cursor (always, even when
    // the Cells layer is off). setState with the same index is a no-op re-render.
    const p = pointerToGraph(e.clientX, e.clientY);
    if (!p) return;
    const i = findCellAtPoint(atlas, p.gx, p.gy);
    setHoveredCell(i >= 0 ? i : null);
  };
  const onUp = () => { drag.current = null; };
  const onLeave = () => { drag.current = null; setHoveredCell(null); };
  const onClick = (e: React.MouseEvent) => {
    if (!onPickCell) return;
    const dp = downPos.current;
    if (dp && Math.hypot(e.clientX - dp.x, e.clientY - dp.y) > 4) return; // it was a drag, not a click
    const p = pointerToGraph(e.clientX, e.clientY);
    if (!p) return;
    const i = findCellAtPoint(atlas, p.gx, p.gy);
    if (i >= 0) onPickCell(cellTraits(atlas, i));
  };

  // Full trait readout for the hovered cell (computed regardless of layer toggles).
  const hoveredTraits = useMemo(
    () => (hoveredCell != null ? cellTraits(atlas, hoveredCell) : null),
    [atlas, hoveredCell],
  );
  const hoveredOutline = hoveredCell != null ? cellPolygonPoints(atlas, hoveredCell) : '';

  // Travel preview: the fastest route from the player to the hovered cell. null
  // when not in travel mode, no hover, or the cell is unreachable (→ "No route").
  const travelRoute = useMemo<RoutePlan | null>(
    () => (travelActive && planRoute && hoveredCell != null ? planRoute(hoveredCell) : null),
    [travelActive, planRoute, hoveredCell],
  );

  // "Find Me": zoom in on the player's marker and surface their current cell in
  // the info panel (the red outline + readout answer "which cell am I at?").
  const centerOnPlayer = useCallback(() => {
    if (!marker) return;
    const k = Math.min(64, Math.max(view.k, (8 * width) / model.width)); // ~1/8 of the map wide
    setView({ k, x: width / 2 - marker.x * k, y: height / 2 - marker.y * k });
    const i = findCellAtPoint(atlas, marker.x, marker.y);
    setHoveredCell(i >= 0 ? i : null);
  }, [marker, view.k, width, height, model.width, atlas]);

  // The biome softening filter lives INSIDE the zoom transform, so a fixed
  // map-unit blur magnifies with zoom and smears biomes when zoomed in. Scale
  // stdDeviation by the fit ratio (fitK / view.k) so the on-screen blur holds at
  // its overview amount (~1 unit at fit) regardless of zoom — facet-hiding at
  // overview, crisp biome edges when zoomed in. Clamped for safety.
  const fitK = Math.min(width / model.width, height / model.height);
  const softenStdDev = Math.min(2, Math.max(0.05, fitK / view.k));

  return (
    <div style={{ position: 'relative', width, height }}>
    <svg
      ref={svgRef}
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#15375d', userSelect: 'none', cursor: drag.current ? 'grabbing' : 'grab' }}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onLeave} onClick={onClick}
      data-testid="atlas-svg-view"
    >
      <defs>
        {/* Seam-free softening of the raw-Voronoi biome edges (SP0 T6, Azgaar's
            blur technique). Coast/rivers/borders/labels draw crisp on top.
            stdDeviation is zoom-compensated (see softenStdDev) so it doesn't
            smear when zoomed in. */}
        <filter id="atlas-soften" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation={softenStdDev} />
        </filter>
        {/* Vignette: darkened edges (Azgaar "vignette" overlay). */}
        <radialGradient id="atlas-vignette" cx="50%" cy="50%" r="75%">
          <stop offset="55%" stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.55} />
        </radialGradient>
      </defs>
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        {/* Deep base ocean; shallow depth bands (T3b) layer on top near coasts. */}
        <rect x={0} y={0} width={model.width} height={model.height} fill="#1f4a73" />
        {/* Heavy static layers, memoized so hover/pan/zoom don't reconcile the
            whole (4k–18k node) subtree — the World Map freeze fix. */}
        <AtlasLayers model={model} visible={visible} />
        {/* Hover highlight — reddish outline on the cell under the cursor. Cheap
            sibling: re-renders on hover without touching AtlasLayers. */}
        {hoveredOutline ? (
          <polygon points={hoveredOutline} fill="none" stroke="#ef4444" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ) : null}
        {/* Travel route preview — fastest path from player to hovered cell. */}
        {travelRoute && travelRoute.points.length > 1 ? (
          <>
            <polyline
              points={travelRoute.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill="none" stroke="#0f172a" strokeOpacity={0.5} strokeWidth={4.5}
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none"
            />
            <polyline
              points={travelRoute.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill="none" stroke={dangerRating(travelRoute.danger).color} strokeWidth={2.2}
              strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none"
            />
            {(() => {
              const end = travelRoute.points[travelRoute.points.length - 1];
              return <circle cx={end[0]} cy={end[1]} r={3} fill={dangerRating(travelRoute.danger).color} stroke="#0f172a" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />;
            })()}
          </>
        ) : null}
      </g>
      {/* Labels overlay — screen space (constant size), zoom-thresholded + decluttered (T5c). */}
      {visible.labels ? declutterLabels(model.labels ?? [], view).map((l, i) => (
        <text
          key={`lb${i}`}
          x={l.sx}
          y={l.sy}
          textAnchor="middle"
          fontFamily={l.kind === 'state' ? 'Georgia, serif' : 'sans-serif'}
          fontSize={l.fontSize}
          fontWeight={l.kind === 'town' ? 400 : 700}
          fill={l.kind === 'state' ? '#2d1b38' : '#111827'}
          stroke="#ffffff"
          strokeWidth={l.kind === 'state' ? 3 : 2}
          paintOrder="stroke"
          style={{ pointerEvents: 'none' }}
        >
          {l.text}
        </text>
      )) : null}
      {/* Discovered hidden-place pins (SP4) — screen space, constant size. */}
      {markers.map((m, i) => (
        <g key={`disc${i}`} transform={`translate(${m.x * view.k + view.x},${m.y * view.k + view.y})`} style={{ pointerEvents: 'none' }} data-testid="atlas-discovery-pin">
          <path d="M0,-7 L5,0 L0,7 L-5,0 Z" fill="#2dd4bf" stroke="#0f766e" strokeWidth={1.5} />
          {m.label ? (
            <text x={0} y={-10} textAnchor="middle" fontFamily="Georgia, serif" fontSize={11} fill="#0f766e" stroke="#ffffff" strokeWidth={2.5} paintOrder="stroke">{m.label}</text>
          ) : null}
        </g>
      ))}
      {/* Always-on "you are here" marker (SP0 T7) — screen space, constant size. */}
      {marker ? (
        <g
          transform={`translate(${marker.x * view.k + view.x},${marker.y * view.k + view.y})`}
          style={{ pointerEvents: 'none' }}
          data-testid="atlas-player-marker"
        >
          <circle r={9} fill="none" stroke="#f5c542" strokeWidth={2} opacity={0.9} />
          <circle r={3.5} fill="#f5c542" stroke="#5a3e00" strokeWidth={1} />
        </g>
      ) : null}
      {/* Vignette overlay — screen space, covers the whole viewport. */}
      {visible.vignette ? (
        <rect x={0} y={0} width={width} height={height} fill="url(#atlas-vignette)" style={{ pointerEvents: 'none' }} />
      ) : null}
    </svg>
    {/* Find Me — zoom to the player's current cell (top-left). */}
    {marker ? (
      <button
        type="button"
        onClick={centerOnPlayer}
        title="Zoom to your current location"
        data-testid="atlas-center-player"
        style={{
          position: 'absolute', top: 8, left: 8, fontFamily: 'sans-serif',
          background: 'rgba(15,30,45,0.85)', color: '#f5c542', border: '1px solid #475569',
          borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer',
        }}
      >
        ⌖ Find Me
      </button>
    ) : null}
    {/* Travel readout — shows the previewed route's time/distance/danger (bottom-center). */}
    {travelActive && hoveredCell != null ? (
      <div
        data-testid="atlas-travel-readout"
        style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'sans-serif', fontSize: 12, whiteSpace: 'nowrap',
          background: 'rgba(15,30,45,0.9)', border: '1px solid #475569', borderRadius: 6,
          padding: '5px 12px', color: '#e2e8f0', pointerEvents: 'none',
        }}
      >
        {travelRoute
          ? formatRouteSummary(travelRoute, transportLabel)
          : <span style={{ color: '#f87171' }}>No route to here</span>}
      </div>
    ) : null}
    {/* Layers panel — owned atlas's equivalent of Azgaar's Layers toggle menu. */}
    <div style={{ position: 'absolute', top: 8, right: 8, fontFamily: 'sans-serif' }}>
      <button
        type="button"
        onClick={() => setLayersOpen((o) => !o)}
        style={{
          background: 'rgba(15,30,45,0.85)', color: '#e2e8f0', border: '1px solid #475569',
          borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer',
        }}
        data-testid="atlas-layers-toggle"
      >
        ☰ Menu
      </button>
      {layersOpen ? (
        <div
          style={{
            marginTop: 4, background: 'rgba(15,30,45,0.92)', border: '1px solid #475569',
            borderRadius: 4, padding: '8px 10px', minWidth: 184, maxHeight: 460, overflowY: 'auto',
          }}
          data-testid="atlas-layers-panel"
        >
          {/* Map coloring — exclusive radio. Only one base coloring at a time. */}
          <div style={SECTION_HEADER}>Map coloring</div>
          {AREA_MODES.map((m) => {
            const empty = (layerCounts.area[m.id] ?? Infinity) === 0;
            return (
              <label
                key={m.id}
                title={empty ? `${m.desc} (no data on this map)` : m.desc}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0', cursor: empty ? 'not-allowed' : 'pointer', color: empty ? '#64748b' : '#e2e8f0' }}
              >
                <input type="radio" name="atlas-map-mode" checked={mapMode === m.id} disabled={empty} onChange={() => setMapMode(m.id)} />
                <span>{m.label}{empty ? ' — none' : ''}</span>
              </label>
            );
          })}

          {/* Feature toggles, grouped. */}
          {FEATURE_GROUPS.map((group) => (
            <React.Fragment key={group}>
              <div style={{ height: 1, background: '#475569', margin: '7px 0 5px' }} />
              <div style={SECTION_HEADER}>{group}</div>
              {FEATURE_LAYERS.filter((l) => l.group === group).map((layer) => {
                const empty = (layerCounts.feat[layer.id] ?? Infinity) === 0;
                return (
                  <label
                    key={layer.id}
                    title={empty ? `${layer.desc} (none on this map)` : layer.desc}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0', cursor: empty ? 'not-allowed' : 'pointer', color: empty ? '#64748b' : '#e2e8f0' }}
                  >
                    <input type="checkbox" checked={!!features[layer.id] && !empty} disabled={empty} onChange={() => toggleFeature(layer.id)} />
                    <span>{layer.label}{empty ? ' — none' : ''}</span>
                  </label>
                );
              })}
            </React.Fragment>
          ))}

          <div style={{ height: 1, background: '#475569', margin: '7px 0 5px' }} />
          <div style={SECTION_HEADER}>Info panel</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0', fontSize: 12 }}>
            Detail
            <select
              value={infoVerbosity}
              onChange={(e) => setInfoVerbosity(e.target.value as InfoVerbosity)}
              style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 4, fontSize: 12, padding: '2px 4px' }}
              data-testid="atlas-info-verbosity"
            >
              {INFO_VERBOSITY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={resetLayers}
            style={{ marginTop: 8, width: '100%', background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 4, padding: '4px 6px', fontSize: 12, cursor: 'pointer' }}
            data-testid="atlas-layers-reset"
          >
            ↺ Reset to defaults
          </button>
        </div>
      ) : null}
    </div>
    {/* Legend / active-coloring caption — tells the player what the colors MEAN.
        Bottom-center, clear of Find Me (TL), Layers (TR), cell info (BL). */}
    {activeMode.legend !== 'none' ? (
      <div
        style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,30,45,0.9)', border: '1px solid #475569', borderRadius: 4,
          padding: '5px 10px', fontFamily: 'sans-serif', fontSize: 11, color: '#e2e8f0',
          pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8, maxWidth: '70%',
        }}
        data-testid="atlas-legend"
      >
        <span style={{ color: '#94a3b8' }}>Coloring:</span>
        <span style={{ fontWeight: 600 }}>{activeMode.label}</span>
        {activeMode.legend === 'ramp' && activeMode.ramp && activeMode.ends ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{activeMode.ends[0]}</span>
            <span style={{ width: 80, height: 9, borderRadius: 2, border: '1px solid #334155', background: `linear-gradient(to right, ${activeMode.ramp[0]}, ${activeMode.ramp[1]}, ${activeMode.ramp[2]})` }} />
            <span>{activeMode.ends[1]}</span>
          </span>
        ) : null}
        {activeMode.legend === 'discrete' ? (
          <span style={{ color: '#cbd5e1' }}>each tint = one {activeMode.noun}</span>
        ) : null}
        {activeMode.legend === 'biomes' ? (
          <span style={{ color: '#cbd5e1' }}>natural terrain type</span>
        ) : null}
      </div>
    ) : null}
    {/* Hover cell info panel — bottom-left of the world map window. */}
    {infoVerbosity !== 'off' && hoveredTraits ? (
      <div
        style={{
          position: 'absolute', bottom: 8, left: 8, maxWidth: 240,
          background: 'rgba(15,30,45,0.9)', border: '1px solid #475569', borderRadius: 4,
          padding: '6px 9px', fontFamily: 'sans-serif', fontSize: 12, color: '#e2e8f0',
          pointerEvents: 'none',
        }}
        data-testid="atlas-cell-info"
      >
        {renderCellInfo(hoveredTraits, infoVerbosity)}
      </div>
    ) : null}
    </div>
  );
};

/** Render the hover info rows for a cell, gated by the verbosity level. */
function renderCellInfo(t: CellTraits, level: InfoVerbosity): React.ReactNode {
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: 6, lineHeight: 1.5 }}>
      <span style={{ color: '#94a3b8', minWidth: 64 }}>{k}</span>
      <span style={{ color: '#f1f5f9' }}>{v}</span>
    </div>
  );
  const rows: React.ReactNode[] = [];
  // Headline: the burg if present, else the terrain.
  if (t.burg) rows.push(<Row key="burg" k={t.burg.capital ? 'Capital' : 'Burg'} v={t.burg.name} />);
  rows.push(<Row key="terrain" k="Terrain" v={t.land ? (t.biome ?? 'Land') : 'Ocean'} />);
  if (level === 'minimal') return rows;
  // standard + full
  if (t.state) rows.push(<Row key="state" k="State" v={t.state} />);
  if (t.culture) rows.push(<Row key="culture" k="Culture" v={t.culture} />);
  rows.push(<Row key="elev" k="Elevation" v={`${t.height}${t.land ? '' : ' (sea)'}`} />);
  if (level === 'full') {
    if (t.province) rows.push(<Row key="prov" k="Province" v={t.province} />);
    if (t.religion) rows.push(<Row key="rel" k="Religion" v={t.religion} />);
    if (t.population != null) rows.push(<Row key="pop" k="Population" v={t.population.toLocaleString()} />);
    rows.push(<Row key="cell" k="Cell #" v={t.i} />);
  }
  return rows;
}

export default AtlasSvgView;
