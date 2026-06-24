import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pointInPolygon, polygonBounds, type Pt } from '../../systems/worldforge/submap/submapEngine';
import type { AtlasNeighbourhood } from '../../systems/worldforge/submap/neighbourhood';

export interface NeighbourhoodSvgViewProps {
  neighbourhood: AtlasNeighbourhood;
  width?: number;
  height?: number;
  /** Atlas cell the party currently occupies — cell-level "You are here" fallback. */
  playerCellId?: number | null;
  /** Player's precise sub-cell index within the FOCUS submap (gold highlight). */
  playerCellIndex?: number | null;
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
  neighbourhood, width = 900, height = 560, playerCellId = null, playerCellIndex = null, onPickCell, onPickNeighbour,
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

  // Per-cell label/marker anchors in graph space. A settlement is pinned to its
  // actual burg sub-cell (not the atlas-cell centroid) so the town name points at
  // the town; the player's cell carries a "You are here" anchor. Grey/unexplored
  // cells fall back to the cell centroid for their basic biome/burg label.
  const anchors = useMemo(() => {
    return neighbourhood.cells.map((c) => {
      // Cell-level "You are here" fires only as a fallback — when we lack a precise
      // sub-cell index (which gets the gold polygon highlight instead).
      const isPlayer = playerCellId != null && c.cellId === playerCellId && playerCellIndex == null;
      let gx: number, gy: number, isBurg = false;
      if (c.explored && c.model && c.model.burgCellIndex != null && c.model.cells[c.model.burgCellIndex]) {
        [gx, gy] = centroid(c.model.cells[c.model.burgCellIndex].polygon);
        isBurg = true;
      } else {
        [gx, gy] = centroid(c.polygon);
      }
      const label = c.explored ? (c.burgName ?? '') : (c.burgName ?? c.biome ?? 'Unknown');
      return { cellId: c.cellId, gx, gy, label, isBurg, isPlayer, isFocus: c.isFocus, explored: c.explored };
    });
  }, [neighbourhood, playerCellId, playerCellIndex]);

  // Player's precise sub-cell within the focus submap (gold highlight, matching
  // SubmapSvgView). Present only when the party occupies the focus cell.
  const playerSub = useMemo(() => {
    if (playerCellIndex == null) return null;
    const focus = neighbourhood.cells.find((c) => c.isFocus);
    const cell = focus?.model?.cells[playerCellIndex];
    if (!cell) return null;
    const [gx, gy] = centroid(cell.polygon);
    return { polygon: cell.polygon, gx, gy };
  }, [neighbourhood, playerCellIndex]);

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
    // Capture the drag origin locally — the setView updater runs after onUp may
    // have nulled drag.current (avoids a null-read race).
    const d = drag.current;
    if (!d) return;
    const { clientX, clientY } = e;
    setView((v) => ({ ...v, x: clientX - d.x, y: clientY - d.y }));
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
        {/* Player's precise sub-cell within the focus submap — gold ring (matches
            SubmapSvgView), so the party reads at a glance even when zoomed in. */}
        {playerSub && (
          <g pointerEvents="none" data-testid="nbh-player-subcell">
            <polygon points={playerSub.polygon.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
              fill="#f5c54222" stroke="#f5c542" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <circle cx={playerSub.gx} cy={playerSub.gy} r={6} fill="none" stroke="#f5c542" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <circle cx={playerSub.gx} cy={playerSub.gy} r={2.5} fill="#f5c542" stroke="#5a3e00" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </g>
      {/* Settlement glyphs, "You are here", and labels — screen space, constant size. */}
      {anchors.map((a) => {
        const sx = a.gx * view.k + view.x;
        const sy = a.gy * view.k + view.y;
        const labelDy = a.isBurg ? -9 : 0;
        return (
          <g key={`anchor${a.cellId}`} style={{ pointerEvents: 'none' }} data-testid={a.isPlayer ? 'nbh-you-are-here' : undefined}>
            {a.isBurg && (
              <>
                {/* Settlement marker: white-ringed ochre disc pinned at the burg. */}
                <circle cx={sx} cy={sy} r={5.5} fill="#b5462f" stroke="#ffffff" strokeWidth={1.5} />
                <circle cx={sx} cy={sy} r={1.8} fill="#ffffff" />
              </>
            )}
            {a.isPlayer && (
              <>
                {/* "You are here": cyan double ring so the party's cell reads at a glance. */}
                <circle cx={sx} cy={sy} r={11} fill="none" stroke="#22d3ee" strokeWidth={2.5} opacity={0.95} />
                <circle cx={sx} cy={sy} r={15} fill="none" stroke="#22d3ee" strokeWidth={1} opacity={0.5} />
              </>
            )}
            {a.label && (
              <text x={sx} y={sy + labelDy} textAnchor="middle" fontFamily="Georgia, serif"
                fontSize={a.isFocus ? 13 : 11} fontWeight={a.isBurg ? 600 : 400}
                fill={a.explored ? '#2d1b38' : '#33372e'} stroke="#ffffff" strokeWidth={2.5} paintOrder="stroke">
                {a.label}
              </text>
            )}
            {a.isPlayer && (
              <text x={sx} y={sy + 26} textAnchor="middle" fontFamily="Georgia, serif" fontSize={10}
                fill="#0e7490" stroke="#ffffff" strokeWidth={2.5} paintOrder="stroke" fontWeight={600}>
                You are here
              </text>
            )}
          </g>
        );
      })}
      {/* "You are here" label for the precise sub-cell (gold highlight drawn above). */}
      {playerSub && (
        <text x={playerSub.gx * view.k + view.x} y={playerSub.gy * view.k + view.y + 20}
          textAnchor="middle" fontFamily="Georgia, serif" fontSize={10}
          fill="#5a3e00" stroke="#ffffff" strokeWidth={2.5} paintOrder="stroke" fontWeight={600}
          style={{ pointerEvents: 'none' }} data-testid="nbh-you-are-here">
          You are here
        </text>
      )}
    </svg>
  );
};

export default NeighbourhoodSvgView;
