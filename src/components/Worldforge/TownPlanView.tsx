import React, { useEffect, useMemo, useRef, useState } from 'react';
import { polygonBounds, type Pt } from '../../systems/worldforge/submap/submapEngine';
import type { TownPlan, CivicKind } from '../../systems/worldforge/town/townEngine';

export interface TownPlanViewProps {
  plan: TownPlan;
  width?: number;
  height?: number;
}

const CIVIC_COLOR: Record<CivicKind, string> = {
  plaza: '#c9b88a', temple: '#8a9bc4', keep: '#7a4b4b', citadel: '#5a2f2f', dock: '#3f6f8f', bridge: '#caa86a',
};

const poly = (pts: Pt[]): string => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
const open = (pts: Pt[]): string => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');

/**
 * SP3/SP-T leaf renderer: draws a generated `TownPlan` — footprint, Voronoi
 * wards, party-wall + interior building plots, main streets, defensive walls +
 * gatehouses, and civic anatomy (plaza/temple/keep/citadel/docks/bridges) — with
 * fit-to-view + manual pan/zoom. This is the deepest 2D tier the drill reaches.
 */
const TownPlanView: React.FC<TownPlanViewProps> = ({ plan, width = 900, height = 560 }) => {
  const bounds = useMemo(() => polygonBounds(plan.footprint), [plan]);
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
  const onDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX - view.x, y: e.clientY - view.y }; };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }));
  };
  const onUp = () => { drag.current = null; };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#3a5a40', userSelect: 'none', cursor: drag.current ? 'grabbing' : 'grab' }}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      data-testid="town-plan-view"
    >
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        <path d={poly(plan.footprint)} fill="#d9cdb0" />
        {plan.wards.map((w, i) => (
          <path key={`w${i}`} d={poly(w.polygon)} fill={w.civic === 'plaza' ? '#e7dcc0' : '#efe6d2'} stroke="#b7a77f" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        ))}
        {plan.streets.map((s, i) => (
          <path key={`st${i}`} d={open(s)} fill="none" stroke="#cdbf9c" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
        {plan.wards.flatMap((w, wi) => w.plots.map((pl, pi) => (
          <path key={`p${wi}-${pi}`} d={poly(pl.polygon)} fill={pl.kind === 'interior' ? '#b89a72' : '#9c7b54'} stroke="#5f4527" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        )))}
        {plan.civic.map((c, i) => (
          <path key={`c${i}`} d={poly(c.polygon)} fill={CIVIC_COLOR[c.kind]} stroke="#1c150a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {plan.walls.ring.length > 0 && (
          <path d={poly(plan.walls.ring)} fill="none" stroke="#6b5836" strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}
        {plan.walls.gatehouses.map((g, i) => (
          <rect key={`g${i}`} x={g[0] - 4} y={g[1] - 4} width={8} height={8} fill="#5a4a2a" stroke="#2a1f10" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={poly(plan.footprint)} fill="none" stroke="#3a2a14" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
};

export default TownPlanView;
