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
}

/**
 * Native SVG atlas (SP0): ocean depth bands + merged per-biome land regions
 * (soften-filtered, no facets) + rivers + routes + state borders + burgs +
 * decluttered labels, with manual wheel-zoom / drag-pan. Click picks the cell
 * under the cursor (owned nearest-site lookup) and an always-on marker shows the
 * current location. No iframe.
 */
/** Toggleable atlas layers (owned port's equivalent of Azgaar's Layers menu). */
const ATLAS_LAYERS = [
  { id: 'biomes', label: 'Biomes' },
  { id: 'cultures', label: 'Cultures' },
  { id: 'religions', label: 'Religions' },
  { id: 'provinces', label: 'Provinces' },
  { id: 'population', label: 'Population' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'precipitation', label: 'Precipitation' },
  { id: 'ice', label: 'Ice' },
  { id: 'rivers', label: 'Rivers' },
  { id: 'routes', label: 'Routes' },
  { id: 'borders', label: 'State borders' },
  { id: 'coast', label: 'Coastline' },
  { id: 'zones', label: 'Zones' },
  { id: 'military', label: 'Military' },
  { id: 'cells', label: 'Cells' },
  { id: 'grid', label: 'Grid' },
  { id: 'markers', label: 'Markers' },
  { id: 'burgs', label: 'Burgs' },
  { id: 'labels', label: 'Labels' },
  { id: 'vignette', label: 'Vignette' },
] as const;
type AtlasLayerId = typeof ATLAS_LAYERS[number]['id'];

const AtlasSvgView: React.FC<AtlasSvgViewProps> = ({ atlas, width = 960, height = 540, marker = null, markers = [], onPickCell }) => {
  const model = useMemo(() => buildAtlasSvgModel(atlas), [atlas]);
  // Per-layer visibility — all on by default (matches the prior always-on render).
  const [visible, setVisible] = useState<Record<AtlasLayerId, boolean>>({
    biomes: true, cultures: false, religions: false, provinces: false,
    population: false, temperature: false, precipitation: false, ice: false,
    rivers: true, routes: true, borders: true, coast: true, zones: false, military: false, cells: false, grid: false, markers: false,
    burgs: true, labels: true, vignette: false,
  });
  const [layersOpen, setLayersOpen] = useState(false);
  const toggleLayer = (id: AtlasLayerId) => setVisible((v) => ({ ...v, [id]: !v[id] }));
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

  // "Find Me": zoom in on the player's marker and surface their current cell in
  // the info panel (the red outline + readout answer "which cell am I at?").
  const centerOnPlayer = useCallback(() => {
    if (!marker) return;
    const k = Math.min(64, Math.max(view.k, (8 * width) / model.width)); // ~1/8 of the map wide
    setView({ k, x: width / 2 - marker.x * k, y: height / 2 - marker.y * k });
    const i = findCellAtPoint(atlas, marker.x, marker.y);
    setHoveredCell(i >= 0 ? i : null);
  }, [marker, view.k, width, height, model.width, atlas]);

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
            blur technique). Coast/rivers/borders/labels draw crisp on top. */}
        <filter id="atlas-soften" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="1" />
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
            borderRadius: 4, padding: '6px 8px', minWidth: 150,
          }}
          data-testid="atlas-layers-panel"
        >
          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Layers</div>
          {ATLAS_LAYERS.map((layer) => (
            <label
              key={layer.id}
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0', fontSize: 12, padding: '2px 0', cursor: 'pointer' }}
            >
              <input type="checkbox" checked={visible[layer.id]} onChange={() => toggleLayer(layer.id)} />
              {layer.label}
            </label>
          ))}
          <div style={{ height: 1, background: '#475569', margin: '6px 0' }} />
          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Info Panel</div>
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
        </div>
      ) : null}
    </div>
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
