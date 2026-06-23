import React, { useMemo, useRef, useState } from 'react';
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';
import { buildAtlasSvgModel } from './atlasSvg';

export interface AtlasSvgViewProps { atlas: FmgAtlasResult; width?: number; height?: number }

/**
 * Iteration #1 native SVG atlas: ocean rect + per-cell land polygons, with
 * manual wheel-zoom / drag-pan via a transform on the root <g> (no new dep).
 * NOTE: T1 specifies d3-zoom, but d3-zoom is not installed. Manual pan/zoom is
 * kept as a T1-equivalent scaffold to avoid adding a new dependency. Can be
 * replaced with d3-zoom in a later task if the dependency is added.
 * Merged-region fills, rivers, filters, marker, and cell-pick are later SP0 tasks.
 */
const AtlasSvgView: React.FC<AtlasSvgViewProps> = ({ atlas, width = 960, height = 540 }) => {
  const model = useMemo(() => buildAtlasSvgModel(atlas), [atlas]);
  const [view, setView] = useState({ k: Math.min(width / model.width, height / model.height), x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setView((v) => {
      const nextK = Math.max(0.05, Math.min(64, v.k * factor));
      // Anchor the zoom on the cursor: keep the map point under the pointer
      // fixed by solving translate' = p - worldPointUnderCursor * nextK.
      const rect = svgRef.current?.getBoundingClientRect();
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
  const onDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX - view.x, y: e.clientY - view.y }; };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setView((v) => ({ ...v, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }));
  };
  const onUp = () => { drag.current = null; };

  return (
    <svg
      ref={svgRef}
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#15375d', userSelect: 'none', cursor: drag.current ? 'grabbing' : 'grab' }}
      onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      data-testid="atlas-svg-view"
    >
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        <rect x={0} y={0} width={model.width} height={model.height} fill="#3d6ea4" />
        {model.layers.find((l) => l.id === 'land')!.polygons.map((p, i) => (
          <polygon key={i} points={p.points} fill={p.fill} />
        ))}
      </g>
    </svg>
  );
};

export default AtlasSvgView;
