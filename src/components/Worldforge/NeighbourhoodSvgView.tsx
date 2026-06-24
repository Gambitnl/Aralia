import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pointInPolygon, polygonBounds, type Pt } from '../../systems/worldforge/submap/submapEngine';
import type { AtlasNeighbourhood } from '../../systems/worldforge/submap/neighbourhood';

export interface NeighbourhoodSvgViewProps {
  neighbourhood: AtlasNeighbourhood;
  width?: number;
  height?: number;
  /** Drill deeper: a focus-cell sub-cell was clicked (siteIndex into the focus submap). */
  onPickCell?: (siteIndex: number) => void;
  /** Recenter: a neighbour atlas cell was clicked (its cellId). */
  onPickNeighbour?: (cellId: number) => void;
}

const path = (pts: Pt[]): string => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
const open = (pts: Pt[]): string => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');
const centroid = (pts: Pt[]): Pt => {
  let x = 0, y = 0;
  for (const [px, py] of pts) { x += px; y += py; }
  return [x / pts.length, y / pts.length];
};

/**
 * Region-tier renderer (fog-of-war): the focus cell's submap surrounded by its
 * atlas neighbours. Explored cells (focus + visited) render their submap; grey
 * unexplored cells show basic info (biome/burg). Click a focus sub-cell to drill
 * deeper; click a neighbour to recenter the neighbourhood on it.
 */
const NeighbourhoodSvgView: React.FC<NeighbourhoodSvgViewProps> = ({
  neighbourhood, width = 900, height = 560, onPickCell, onPickNeighbour,
}) => {
  const bounds = useMemo(() => {
    const all: Pt[] = neighbourhood.cells.flatMap((c) => c.polygon);
    return all.length ? polygonBounds(all) : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }, [neighbourhood]);

  const fit = useMemo(() => {
    const w = bounds.maxX - bounds.minX || 1;
    const h = bounds.maxY - bounds.minY || 1;
    const pad = 28;
    const k = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
    return { k, x: pad - bounds.minX * k + (width - 2 * pad - w * k) / 2, y: pad - bounds.minY * k + (height - 2 * pad - h * k) / 2 };
  }, [bounds, width, height]);

  const [view, setView] = useState(fit);
  useEffect(() => setView(fit), [fit]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Non-passive wheel so preventDefault works; zoom anchors on the cursor (keep
  // the map point under the pointer fixed) rather than a fixed focal point.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
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
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [width, height]);

  const onDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX - view.x, y: e.clientY - view.y };
    downPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }));
  };
  const onUp = () => { drag.current = null; };

  const onClick = (e: React.MouseEvent) => {
    const dp = downPos.current;
    if (dp && Math.hypot(e.clientX - dp.x, e.clientY - dp.y) > 4) return; // was a drag
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const gx = ((e.clientX - rect.left) * (width / rect.width) - view.x) / view.k;
    const gy = ((e.clientY - rect.top) * (height / rect.height) - view.y) / view.k;
    const p: Pt = [gx, gy];
    // Neighbours first: clicking a non-focus cell recenters.
    const neighbour = neighbourhood.cells.find((c) => !c.isFocus && pointInPolygon(p, c.polygon));
    if (neighbour) { onPickNeighbour?.(neighbour.cellId); return; }
    // Focus: drill into the sub-cell under the cursor.
    const focus = neighbourhood.cells.find((c) => c.isFocus);
    if (focus?.model) {
      const sub = focus.model.cells.find((sc) => pointInPolygon(p, sc.polygon));
      if (sub) onPickCell?.(sub.siteIndex);
    }
  };

  return (
    <svg
      ref={svgRef}
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#1f3048', userSelect: 'none', cursor: drag.current ? 'grabbing' : 'grab' }}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onClick={onClick}
      data-testid="neighbourhood-svg-view"
    >
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        {neighbourhood.cells.map((c) => {
          if (!c.explored || !c.model) {
            // Grey unexplored cell — basic info only.
            return (
              <path key={`grey${c.cellId}`} d={path(c.polygon)} fill="#aab0a2" fillOpacity={0.55}
                stroke="#5c6356" strokeWidth={1} vectorEffect="non-scaling-stroke" data-testid="nbh-grey-cell" />
            );
          }
          const m = c.model;
          return (
            <g key={`cell${c.cellId}`} opacity={c.isFocus ? 1 : 0.82}>
              {m.cells.map((sc, i) => (
                <path key={i} d={path(sc.polygon)}
                  fill={i === m.burgCellIndex ? '#e0a73a' : c.isFocus ? '#d8e3c8' : '#cdd6bf'}
                  stroke="#7a8a6a" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
              ))}
              {(m.polylines ?? []).map((pl, i) => (
                <path key={`pl${i}`} d={open(pl.points)} fill="none"
                  stroke={pl.kind === 'river' ? '#5d97bb' : '#8b5a2b'} strokeWidth={pl.kind === 'river' ? 2 : 1.2}
                  strokeDasharray={pl.kind === 'road' ? '3 2' : undefined} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              ))}
              <path d={path(c.polygon)} fill="none"
                stroke={c.isFocus ? '#f5c542' : '#1a2233'} strokeWidth={c.isFocus ? 2.5 : 1.2}
                vectorEffect="non-scaling-stroke" data-testid={c.isFocus ? 'nbh-focus' : 'nbh-explored'} />
            </g>
          );
        })}
      </g>
      {/* Basic-info labels — screen space, constant size. */}
      {neighbourhood.cells.map((c) => {
        const [gx, gy] = centroid(c.polygon);
        const label = c.explored ? (c.burgName ?? '') : (c.burgName ?? c.biome ?? 'Unknown');
        if (!label) return null;
        return (
          <text key={`lbl${c.cellId}`} x={gx * view.k + view.x} y={gy * view.k + view.y}
            textAnchor="middle" fontFamily="Georgia, serif" fontSize={c.isFocus ? 13 : 11}
            fill={c.explored ? '#2d1b38' : '#33372e'} stroke="#ffffff" strokeWidth={2.5} paintOrder="stroke"
            style={{ pointerEvents: 'none' }}>
            {label}
          </text>
        );
      })}
    </svg>
  );
};

export default NeighbourhoodSvgView;
