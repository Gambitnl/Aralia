import React, { useEffect, useMemo, useRef, useState } from 'react';
import { polygonBounds, pointInPolygon, type Pt } from '../../systems/worldforge/submap/submapEngine';
import type { TownPlan, CivicKind, BuildingPlot } from '../../systems/worldforge/town/townEngine';

export interface TownPlanViewProps {
  plan: TownPlan;
  width?: number;
  height?: number;
}

const CIVIC_COLOR: Record<CivicKind, string> = {
  plaza: '#c9b88a', temple: '#8a9bc4', keep: '#7a4b4b', citadel: '#5a2f2f', dock: '#3f6f8f', bridge: '#caa86a',
};

const CIVIC_LABEL: Record<CivicKind, string> = {
  plaza: 'Market Plaza', temple: 'Temple', keep: 'Keep', citadel: 'Citadel', dock: 'Docks', bridge: 'Bridge',
};

// Outskirts land-use fills: farmland (tilled, furrow-hatched) hugs the town,
// pasture (grassland) beyond, scrub/barren at the rim.
const OUTSKIRT_FILL: Record<'farm' | 'pasture' | 'scrub', string> = {
  farm: 'url(#town-farm)', pasture: '#7c9a57', scrub: '#9b9576',
};

const poly = (pts: Pt[]): string => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
const open = (pts: Pt[]): string => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');

const centroidOf = (pts: Pt[]): Pt => {
  let x = 0, y = 0;
  for (const [px, py] of pts) { x += px; y += py; }
  return [x / pts.length, y / pts.length];
};

/** Shoelace area (absolute) of a polygon in its own coordinate frame. */
const areaOf = (pts: Pt[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

/** Stable hash of a point (rounded) — deterministic building flavour across renders. */
const hashPt = (x: number, y: number): number => {
  let h = 2166136261 >>> 0;
  const s = `${Math.round(x)},${Math.round(y)}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
};

// Architectural building types by position — town-map categories, not wired to
// specific NPCs/businesses. Central street-fronts read as commercial/civic,
// outer fronts residential, ward interiors as utility/outbuildings.
const TYPES_CENTRAL = ['Inn', 'Tavern', 'Trade Hall', 'Merchant Shop', 'Guild House', 'Townhouse'];
const TYPES_OUTER = ['Townhouse', 'Cottage', 'Workshop', 'Smithy', 'Bakehouse', 'Longhouse'];
const TYPES_INTERIOR = ['Cottage', 'Storehouse', 'Stable', 'Workshop', 'Granary'];

interface HoverInfo {
  poly: Pt[];
  title: string;
  lines: string[];
  px: number; // tooltip anchor in viewBox space
  py: number;
}

/**
 * SP3/SP-T leaf renderer: draws a generated `TownPlan` — footprint, Voronoi
 * wards, party-wall + interior building plots, main streets, defensive walls +
 * gatehouses, and civic anatomy (plaza/temple/keep/citadel/docks/bridges) — with
 * fit-to-view + manual pan/zoom. Hovering a building or civic structure highlights
 * it and shows an inspector tooltip. This is the deepest 2D tier the drill reaches.
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

  // Town centre + median plot area: drive relative size categories and the
  // central/outer building-type split (frame-independent, so it works regardless
  // of the normalized submap scale this town was generated in).
  const stats = useMemo(() => {
    const centre = centroidOf(plan.footprint);
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
    const areas: number[] = [];
    for (const w of plan.wards) for (const pl of w.plots) areas.push(areaOf(pl.polygon));
    areas.sort((a, b) => a - b);
    const median = areas.length ? areas[Math.floor(areas.length / 2)] : 1;
    return { centre, span, median };
  }, [plan, bounds]);

  const describeBuilding = (pl: BuildingPlot, wardCivic?: CivicKind): { title: string; lines: string[] } => {
    const c = centroidOf(pl.polygon);
    const dist = Math.hypot(c[0] - stats.centre[0], c[1] - stats.centre[1]) / stats.span; // 0=centre .. ~0.7 edge
    const interior = pl.kind === 'interior';
    const central = !interior && dist < 0.22;
    const pool = interior ? TYPES_INTERIOR : central ? TYPES_CENTRAL : TYPES_OUTER;
    const h = hashPt(c[0], c[1]);
    const title = pool[h % pool.length];

    const area = areaOf(pl.polygon);
    const size = area < stats.median * 0.6 ? 'Small' : area > stats.median * 1.6 ? 'Large' : 'Average';
    // Estimated storeys: central commercial taller, interior outbuildings low.
    // (Unsigned shift — a signed >> can go negative when h's top bit is set.)
    const storeys = central ? 2 + ((h >>> 3) % 2) : interior ? 1 : 1 + ((h >>> 3) % 2);

    const lines = [
      interior ? 'Courtyard building (ward interior)' : 'Street-front building',
      `${size} footprint · ${pl.shape === 'L' ? 'L-shaped' : 'rectangular'}`,
      `~${storeys} ${storeys === 1 ? 'storey' : 'storeys'}`,
    ];
    if (wardCivic) lines.push(`In the ${CIVIC_LABEL[wardCivic].toLowerCase()} ward`);
    return { title, lines };
  };

  const [view, setView] = useState(fit);
  useEffect(() => setView(fit), [fit]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

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

  // Pointer → town-frame (graph) coordinates, accounting for pan/zoom + viewBox.
  const toGraph = (clientX: number, clientY: number): Pt | null => {
    const el = svgRef.current;
    const rect = el?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const px = (clientX - rect.left) * (width / rect.width);
    const py = (clientY - rect.top) * (height / rect.height);
    return [(px - view.x) / view.k, (py - view.y) / view.k];
  };

  // Hit-test the cursor: civic structures first (drawn on top), then ward plots.
  const inspectAt = (clientX: number, clientY: number): HoverInfo | null => {
    const g = toGraph(clientX, clientY);
    if (!g) return null;
    for (const c of plan.civic) {
      if (pointInPolygon(g, c.polygon)) {
        const [cx, cy] = centroidOf(c.polygon);
        return { poly: c.polygon, title: CIVIC_LABEL[c.kind], lines: ['Civic structure'], px: cx, py: cy };
      }
    }
    for (const w of plan.wards) {
      for (const pl of w.plots) {
        if (pointInPolygon(g, pl.polygon)) {
          const d = describeBuilding(pl, w.civic);
          const [cx, cy] = centroidOf(pl.polygon);
          return { poly: pl.polygon, title: d.title, lines: d.lines, px: cx, py: cy };
        }
      }
    }
    return null;
  };

  const onDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX - view.x, y: e.clientY - view.y }; };
  const onMove = (e: React.MouseEvent) => {
    // Capture the drag origin locally: the setView updater runs asynchronously,
    // and onUp/onLeave can null drag.current before it flushes (the crash that
    // surfaced as "Cannot read properties of null (reading 'x')").
    const d = drag.current;
    if (d) {
      const { clientX, clientY } = e;
      setView((v) => ({ ...v, x: clientX - d.x, y: clientY - d.y }));
      if (hover) setHover(null);
      return;
    }
    setHover(inspectAt(e.clientX, e.clientY));
  };
  const onUp = () => { drag.current = null; };
  const onLeave = () => { drag.current = null; setHover(null); };

  // Tooltip anchor in viewBox space (constant-size, follows the hovered shape).
  const tipX = hover ? hover.px * view.k + view.x : 0;
  const tipY = hover ? hover.py * view.k + view.y : 0;
  const tipW = 168;
  const tipLeft = Math.min(Math.max(tipX + 12, 4), width - tipW - 4);
  const lineH = 14;
  const tipH = 22 + (hover?.lines.length ?? 0) * lineH + 6;
  const tipTop = Math.min(Math.max(tipY + 12, 4), height - tipH - 4);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#3a5a40', userSelect: 'none', cursor: drag.current ? 'grabbing' : hover ? 'pointer' : 'grab' }}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onLeave}
      data-testid="town-plan-view"
    >
      <defs>
        {/* Tilled-field furrows for farmland parcels. */}
        <pattern id="town-farm" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
          <rect width="7" height="7" fill="#c7a567" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#a6843f" strokeWidth="1.5" />
        </pattern>
      </defs>
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        {/* Cell base = open countryside (the whole parent cell is land). */}
        <path d={poly(plan.footprint)} fill="#88a05f" />
        {/* Outskirts: farmland near the town, pasture beyond, scrub at the rim —
            so the town isn't hardset to the cell's edge. */}
        {(plan.outskirts ?? []).map((o, i) => (
          <path key={`out${i}`} d={poly(o.polygon)} fill={OUTSKIRT_FILL[o.kind]} stroke="#6f7a52" strokeWidth={0.3} vectorEffect="non-scaling-stroke" data-testid={`town-outskirt-${o.kind}`} />
        ))}
        {/* Organic built-up CORE filled in the STREET/ground tone: the gaps between
            block fills (the ward insets) then read as the street network. */}
        <path d={poly(plan.core ?? plan.footprint)} fill="#cdbf9c" stroke="#8a7a55" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {/* Buildable blocks (ward insets) in parchment — the area between them is
            street. Fall back to the full ward if no block (older plans). */}
        {plan.wards.map((w, i) => (
          <path key={`w${i}`} d={poly(w.block ?? w.polygon)} fill={w.civic === 'plaza' ? '#e7dcc0' : '#efe6d2'} stroke="#b7a77f" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />
        ))}
        {/* Inherited main roads on top of the street grid (wider, distinct). */}
        {plan.streets.map((s, i) => (
          <path key={`st${i}`} d={open(s)} fill="none" stroke="#b8a577" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
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
        {/* Hover highlight — drawn last so it sits above the building it traces. */}
        {hover && (
          <path d={poly(hover.poly)} fill="#fff3" stroke="#ffe08a" strokeWidth={2.5}
            strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" data-testid="town-hover-highlight" />
        )}
      </g>
      {/* Inspector tooltip — screen space, constant size. */}
      {hover && (
        <g pointerEvents="none" data-testid="town-inspector">
          <rect x={tipLeft} y={tipTop} width={tipW} height={tipH} rx={4}
            fill="#1c150aee" stroke="#ffe08a" strokeWidth={1} />
          <text x={tipLeft + 8} y={tipTop + 16} fontFamily="Georgia, serif" fontSize={12} fontWeight={700} fill="#ffe08a">
            {hover.title}
          </text>
          {hover.lines.map((ln, i) => (
            <text key={i} x={tipLeft + 8} y={tipTop + 16 + (i + 1) * lineH} fontFamily="Georgia, serif" fontSize={10} fill="#e8dcc0">
              {ln}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
};

export default TownPlanView;
