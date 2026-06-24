import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  pointInPolygon,
  polygonBounds,
  type SubmapModel,
} from '../../systems/worldforge/submap/submapEngine';
import type { RoutePlan } from '../../systems/travel/routePlanning';
import { formatRouteSummary, dangerRating } from '../../systems/travel/travelReadout';

/** Muted parchment-toned fills per sub-biome (keeps the atlas palette family). */
const BIOME_TINT: Record<string, string> = {
  Grassland: '#cdd9a6',
  Savanna: '#d8d199',
  Wetland: '#a9c6a3',
  'Temperate deciduous forest': '#bcd0a0',
  'Temperate rainforest': '#a7c69a',
  'Tropical rainforest': '#9cc295',
  'Tropical seasonal forest': '#bcd194',
  Taiga: '#b3c4a6',
  Tundra: '#cdd3c2',
  Glacier: '#e3e9ee',
  'Hot desert': '#e6d6a6',
  'Cold desert': '#d8d8be',
  Marine: '#9fc0d4',
};

const biomeFill = (biome?: string): string => (biome && BIOME_TINT[biome]) || '#d6e1c6';

export interface SubmapSvgViewProps {
  model: SubmapModel;
  width?: number;
  height?: number;
  /** Fired with the picked sub-cell's siteIndex on click (drives the deeper drill). */
  onPickCell?: (siteIndex: number) => void;
  /** Index (into model.cells) of the sub-cell the player occupies, or null. */
  playerCellIndex?: number | null;
  /** Travel mode: hovering a sub-cell previews the fastest route to it. */
  travelActive?: boolean;
  /** Plan the fastest route from the player to a hovered sub-cell index. */
  planRoute?: (toCellIndex: number) => RoutePlan | null;
  /** Transport label for the travel readout. */
  transportLabel?: string;
}

/** Vertex-mean centroid of a polygon (inside convex Voronoi cells). */
const cellCentroid = (pts: Array<readonly [number, number]>): [number, number] => {
  let x = 0, y = 0;
  for (const [px, py] of pts) { x += px; y += py; }
  return [x / pts.length, y / pts.length];
};

/**
 * SP2 renderer for an SP1 `SubmapModel`: the parent-shaped Voronoi submap — cells
 * filled (burg/feature cells highlighted), boundary inked, burg labeled — with
 * fit-to-view + manual pan/zoom and click-to-drill. Clicking a cell resolves it
 * by point-in-polygon and reports its siteIndex so the host can recurse.
 */
const SubmapSvgView: React.FC<SubmapSvgViewProps> = ({ model, width = 900, height = 560, onPickCell, playerCellIndex = null, travelActive = false, planRoute, transportLabel = 'on foot' }) => {
  const bounds = useMemo(() => polygonBounds(model.boundary), [model]);
  const fit = useMemo(() => {
    const w = bounds.maxX - bounds.minX || 1;
    const h = bounds.maxY - bounds.minY || 1;
    const pad = 24;
    const k = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
    return {
      k,
      x: pad - bounds.minX * k + (width - 2 * pad - w * k) / 2,
      y: pad - bounds.minY * k + (height - 2 * pad - h * k) / 2,
    };
  }, [bounds, width, height]);

  const [view, setView] = useState(fit);
  useEffect(() => setView(fit), [fit]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Native non-passive wheel listener so preventDefault works (React's onWheel
  // prop is passive — preventDefault is a no-op there and warns). Zoom anchors on
  // the cursor (keep the map point under the pointer fixed), not a fixed focal point.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => {
        const nextK = Math.max(0.05, Math.min(64, v.k * f));
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return { ...v, k: nextK };
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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const onMove = (e: React.MouseEvent) => {
    // Capture the drag origin locally — the setView updater runs after onUp may
    // have nulled drag.current (avoids a null-read race).
    const d = drag.current;
    if (d) {
      const { clientX, clientY } = e;
      setView((v) => ({ ...v, x: clientX - d.x, y: clientY - d.y }));
      return;
    }
    // Hover: resolve the sub-cell under the cursor (for the travel route preview).
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const wx = ((e.clientX - rect.left) * (width / rect.width) - view.x) / view.k;
    const wy = ((e.clientY - rect.top) * (height / rect.height) - view.y) / view.k;
    const idx = model.cells.findIndex((c) => pointInPolygon([wx, wy], c.polygon));
    setHoveredIdx(idx >= 0 ? idx : null);
  };
  const onUp = () => { drag.current = null; };
  const onLeave = () => { drag.current = null; setHoveredIdx(null); };

  // Travel preview: fastest route from the player's sub-cell to the hovered one.
  const travelRoute = useMemo<RoutePlan | null>(
    () => (travelActive && planRoute && hoveredIdx != null ? planRoute(hoveredIdx) : null),
    [travelActive, planRoute, hoveredIdx],
  );
  const onClick = (e: React.MouseEvent) => {
    if (!onPickCell) return;
    const dp = downPos.current;
    if (dp && Math.hypot(e.clientX - dp.x, e.clientY - dp.y) > 4) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const sx = (e.clientX - rect.left) * (width / rect.width);
    const sy = (e.clientY - rect.top) * (height / rect.height);
    const gx = (sx - view.x) / view.k;
    const gy = (sy - view.y) / view.k;
    const cell = model.cells.find((c) => pointInPolygon([gx, gy], c.polygon));
    if (cell) onPickCell(cell.siteIndex);
  };

  const boundaryD = 'M' + model.boundary.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
  const burg = model.burgCellIndex != null ? model.cells[model.burgCellIndex]?.feature : undefined;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#1f3048', userSelect: 'none', cursor: drag.current ? 'grabbing' : 'grab' }}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onLeave}
      onClick={onClick}
      data-testid="submap-svg-view"
    >
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        {model.cells.map((c, i) => {
          const isBurg = i === model.burgCellIndex;
          const isFeature = !!c.feature && !isBurg;
          const fill = isBurg ? '#e0a73a' : isFeature ? '#c9d6b0' : biomeFill(c.biome);
          const d = 'M' + c.polygon.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
          return <path key={i} d={d} fill={fill} stroke="#7a8a6a" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />;
        })}
        {(model.polylines ?? []).map((pl, i) => {
          const d = 'M' + pl.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');
          return pl.kind === 'river'
            ? <path key={`pl${i}`} d={d} fill="none" stroke="#5d97bb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            : <path key={`pl${i}`} d={d} fill="none" stroke="#8b5a2b" strokeWidth={1.2} strokeDasharray="3 2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
        })}
        <path d={boundaryD} fill="none" stroke="#1a2233" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        {/* Travel route preview — fastest path from the player's sub-cell to the hovered one. */}
        {travelRoute && travelRoute.points.length > 1 ? (
          <>
            <polyline points={travelRoute.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill="none" stroke="#0f172a" strokeOpacity={0.5} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            <polyline points={travelRoute.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill="none" stroke={dangerRating(travelRoute.danger).color} strokeWidth={2.2} strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
          </>
        ) : null}
        {/* Player indicator — highlight the sub-cell the player occupies (gold ring). */}
        {playerCellIndex != null && model.cells[playerCellIndex] ? (() => {
          const [px, py] = cellCentroid(model.cells[playerCellIndex].polygon);
          return (
            <g pointerEvents="none" data-testid="submap-player-cell">
              <polygon points={model.cells[playerCellIndex].polygon.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
                fill="#f5c54222" stroke="#f5c542" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <circle cx={px} cy={py} r={6} fill="none" stroke="#f5c542" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <circle cx={px} cy={py} r={2.5} fill="#f5c542" stroke="#5a3e00" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })() : null}
        {burg ? (
          <>
            <circle cx={burg.x} cy={burg.y} r={5} fill="#fff" stroke="#7a1228" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
      </g>
      {burg ? (
        <text
          x={burg.x * view.k + view.x}
          y={burg.y * view.k + view.y - 10}
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize={13}
          fill="#2d1b38"
          stroke="#fff"
          strokeWidth={3}
          paintOrder="stroke"
          style={{ pointerEvents: 'none' }}
        >
          {burg.name}
        </text>
      ) : null}
      {/* Travel readout — screen space, bottom-center. */}
      {travelActive && hoveredIdx != null ? (
        <g pointerEvents="none">
          <rect x={width / 2 - 130} y={height - 30} width={260} height={20} rx={4} fill="rgba(15,30,45,0.9)" stroke="#475569" />
          <text x={width / 2} y={height - 16} textAnchor="middle" fontFamily="sans-serif" fontSize={11} fill={travelRoute ? '#e2e8f0' : '#f87171'}>
            {travelRoute ? formatRouteSummary(travelRoute, transportLabel) : 'No route to here'}
          </text>
        </g>
      ) : null}
    </svg>
  );
};

export default SubmapSvgView;
