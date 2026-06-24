import React from 'react';
import type { AtlasSvgModel } from './atlasSvg';

export interface AtlasLayersProps {
  model: AtlasSvgModel;
  visible: Record<string, boolean>;
}

/**
 * The heavy static layer subtree of the atlas (ocean + biomes/cultures/.../burgs/
 * markers/military — thousands of SVG nodes when per-cell layers are on). Split
 * out and `React.memo`'d so that HOVER and PAN/ZOOM in `AtlasSvgView` — which
 * change `hoveredCell`/`view` but not `model`/`visible` — do NOT reconcile this
 * whole tree. The transform lives on the parent `<g>`; the hover highlight is a
 * cheap sibling. This is the fix for the World Map freeze (re-rendering ~4k–18k
 * nodes on every mouse move). Props are shallow-compared: same `model` + same
 * `visible` ref ⇒ skipped.
 */
function AtlasLayersImpl({ model, visible }: AtlasLayersProps): React.ReactElement {
  const ocean = model.layers.find((l) => l.id === 'ocean');
  const land = model.layers.find((l) => l.id === 'land')!;
  return (
    <>
      {(ocean?.regions ?? []).map((r, i) => (
        <path key={`o${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
      ))}
      {visible.biomes ? (
        <>
          <g filter="url(#atlas-soften)">
            {(land.regions ?? []).map((r, i) => (
              <path key={`r${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
            ))}
          </g>
          {land.polygons.map((p, i) => (
            <polygon key={`p${i}`} points={p.points} fill={p.fill} />
          ))}
        </>
      ) : null}
      {visible.cultures ? (
        <g filter="url(#atlas-soften)" opacity={0.65}>
          {(model.cultureRegions ?? []).map((r, i) => (
            <path key={`cu${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
          ))}
        </g>
      ) : null}
      {visible.religions ? (
        <g filter="url(#atlas-soften)" opacity={0.6}>
          {(model.religionRegions ?? []).map((r, i) => (
            <path key={`rel${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
          ))}
        </g>
      ) : null}
      {visible.provinces ? (
        <g filter="url(#atlas-soften)" opacity={0.6}>
          {(model.provinceRegions ?? []).map((r, i) => (
            <path key={`prov${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
          ))}
        </g>
      ) : null}
      {visible.population ? (
        <g filter="url(#atlas-soften)" opacity={0.7}>
          {(model.populationCells ?? []).map((c, i) => (
            <polygon key={`pop${i}`} points={c.points} fill={c.fill} />
          ))}
        </g>
      ) : null}
      {visible.temperature ? (
        <g filter="url(#atlas-soften)" opacity={0.6}>
          {(model.temperatureCells ?? []).map((c, i) => (
            <polygon key={`tmp${i}`} points={c.points} fill={c.fill} />
          ))}
        </g>
      ) : null}
      {visible.precipitation ? (
        <g filter="url(#atlas-soften)" opacity={0.6}>
          {(model.precipitationCells ?? []).map((c, i) => (
            <polygon key={`prc${i}`} points={c.points} fill={c.fill} />
          ))}
        </g>
      ) : null}
      {visible.ice ? (
        <g opacity={0.8}>
          {(model.iceCells ?? []).map((c, i) => (
            <polygon key={`ice${i}`} points={c.points} fill={c.fill} stroke="#bcdcef" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      ) : null}
      {visible.zones ? (
        <g opacity={0.5}>
          {(model.zoneCells ?? []).map((c, i) => (
            <polygon key={`zone${i}`} points={c.points} fill={c.fill} />
          ))}
        </g>
      ) : null}
      {visible.cells ? (
        <g>
          {(model.cellOutlines ?? []).map((pts, i) => (
            <polygon key={`cell${i}`} points={pts} fill="none" stroke="#33415580" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      ) : null}
      {visible.grid ? (
        <path
          d={(() => {
            const step = model.width / 24; // graticule spacing
            let d = '';
            for (let x = step; x < model.width; x += step) d += `M${x.toFixed(1)},0V${model.height.toFixed(1)}`;
            for (let y = step; y < model.height; y += step) d += `M0,${y.toFixed(1)}H${model.width.toFixed(1)}`;
            return d;
          })()}
          fill="none" stroke="#2d3b4d55" strokeWidth={0.5} vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {visible.rivers ? (model.rivers ?? []).map((r, i) => (
        <path key={`riv${i}`} d={r.d} fill={r.fill} />
      )) : null}
      {visible.borders && model.stateBorders ? (
        <path d={model.stateBorders} fill="none" stroke="#2d1b38" strokeOpacity={0.7}
          strokeWidth={1} strokeDasharray="3 2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ) : null}
      {visible.routes ? (model.routes ?? []).map((rt, i) => {
        const s = rt.group === 'trails'
          ? { stroke: '#708090', dash: '3 3', w: 0.8 }
          : rt.group === 'searoutes'
            ? { stroke: '#87cefa', dash: '4 4', w: 1 }
            : { stroke: '#8b5a2b', dash: undefined, w: 1.2 };
        return (
          <path key={`rt${i}`} d={rt.d} fill="none" stroke={s.stroke} strokeWidth={s.w}
            strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        );
      }) : null}
      {visible.coast && model.coastline ? (
        <>
          {/* shelf glow + crisp inked coast (double stroke, T3) */}
          <path d={model.coastline} fill="none" stroke="#9fcdef" strokeOpacity={0.4} strokeWidth={5} vectorEffect="non-scaling-stroke" />
          <path d={model.coastline} fill="none" stroke="#1a3d66" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        </>
      ) : null}
      {visible.burgs ? (model.burgs ?? []).map((b, i) => (b.capital ? (
        <g key={`bg${i}`}>
          <circle cx={b.x} cy={b.y} r={3.5} fill="#ffffff" stroke="#7a1228" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          <circle cx={b.x} cy={b.y} r={1.6} fill="#e11d48" />
        </g>
      ) : (
        <circle key={`bg${i}`} cx={b.x} cy={b.y} r={2} fill="#ffffff" stroke="#374151" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      ))) : null}
      {visible.markers ? (model.poiMarkers ?? []).map((m, i) => (
        <g key={`mk${i}`}>
          <circle cx={m.x} cy={m.y} r={2.6} fill="#fde68a" stroke="#92400e" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          <circle cx={m.x} cy={m.y} r={0.9} fill="#92400e" />
        </g>
      )) : null}
      {visible.military ? (model.regiments ?? []).map((r, i) => (
        <rect key={`mil${i}`} x={r.x - 2.2} y={r.y - 2.2} width={4.4} height={4.4}
          fill={r.type === 'naval' ? '#1d4ed8' : '#b91c1c'} stroke="#1c1917" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      )) : null}
    </>
  );
}

/** Memoized: re-renders only when `model` or the `visible` object identity changes. */
const AtlasLayers = React.memo(AtlasLayersImpl);
export default AtlasLayers;
