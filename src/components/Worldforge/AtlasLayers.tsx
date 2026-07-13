import React from 'react';
import { FOREST_GLYPH_LAYER_OPACITY, RELIEF_GLYPH_LAYER_OPACITY, passMarkPath, type AtlasSvgModel } from './atlasSvg';
import { reliefInk } from './mountainGlyphs';
import { ROUTE_STROKES } from './routeMapStyle';

/**
 * Forest glyph layer opacity (forests campaign T6). This memoized tree has NO
 * zoom access on purpose (re-rendering it per zoom frame is the World Map
 * freeze), so the zoom ramp arrives as the CSS custom property
 * `--forest-glyph-opacity`, which AtlasSvgView sets on the zoom-transform <g>
 * each frame. The fallback keeps other hosts (tests, proof pages) at full
 * layer opacity.
 */
const FOREST_GLYPH_OPACITY_VAR: React.CSSProperties = {
  opacity: `var(--forest-glyph-opacity, ${FOREST_GLYPH_LAYER_OPACITY})`,
};

/**
 * Relief glyph layer opacity (mountains campaign T9) — same freeze-safe CSS
 * custom-property channel as the forest layer: AtlasSvgView sets
 * `--relief-glyph-opacity` from view.k each frame; the fallback keeps
 * zoom-free hosts (tests, proof pages) at full layer opacity.
 */
const RELIEF_GLYPH_OPACITY_VAR: React.CSSProperties = {
  opacity: `var(--relief-glyph-opacity, ${RELIEF_GLYPH_LAYER_OPACITY})`,
};

export interface AtlasLayersProps {
  model: AtlasSvgModel;
  visible: Record<string, boolean>;
  /**
   * P1 perf — whether the `#atlas-soften` Gaussian-blur filter should be applied
   * to the biome/overlay groups. AtlasSvgView already zeroes the filter's
   * `stdDeviation` once zoomed in past ~2× the fit scale (`zoomedIn`), but a
   * stdDeviation-0 blur STILL forces the browser to allocate and walk the filter
   * region for ~8 groups (≈1900 nodes) on every pan/zoom frame. Gating the
   * `filter=` attribute off entirely above that threshold removes the filter
   * pass altogether (not just a no-op blur), so panning/zooming a zoomed-in atlas
   * does no per-frame rasterization.
   *
   * Defaults to `true` so callers that don't pass it keep the original
   * filter-always-on behaviour — the low-zoom look is unchanged. AtlasSvgView
   * should pass `softenActive={softenStdDev > 0}` (i.e. `!zoomedIn`) to mirror its
   * own cutoff; see the cross-file follow-up note in AtlasSvgView.tsx (~544).
   */
  softenActive?: boolean;
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
function AtlasLayersImpl({ model, visible, softenActive = true }: AtlasLayersProps): React.ReactElement {
  const ocean = model.layers.find((l) => l.id === 'ocean');
  const land = model.layers.find((l) => l.id === 'land')!;
  // P1 perf: only reference the expensive `#atlas-soften` blur filter when it is
  // actually doing visible work (low zoom). Above AtlasSvgView's zoom cutoff the
  // blur is a no-op that would still cost a per-frame filter-region pass, so we
  // omit the attribute entirely (`undefined` ⇒ no `filter=` rendered). The
  // low-zoom look is identical to before because `softenActive` defaults to true.
  const softenFilter = softenActive ? 'url(#atlas-soften)' : undefined;
  return (
    <>
      {(ocean?.regions ?? []).map((r, i) => (
        <path key={`o${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
      ))}
      {/* Neutral land base. Drawn whenever Biomes is NOT the active coloring, so
          partial overlays (cultures/religions/provinces/population) and the
          "None" mode never leave land invisible against the ocean. */}
      {!visible.biomes ? (
        <g>
          {(land.regions ?? []).map((r, i) => (
            <path key={`lb${i}`} d={r.d} fill="#d9d2bd" fillRule="evenodd" />
          ))}
        </g>
      ) : null}
      {visible.biomes ? (
        <>
          <g filter={softenFilter}>
            {(land.regions ?? []).map((r, i) => (
              <path key={`r${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
            ))}
          </g>
          {land.polygons.map((p, i) => (
            <polygon key={`p${i}`} points={p.points} fill={p.fill} />
          ))}
        </>
      ) : null}
      {visible.states ? (
        <g filter={softenFilter} opacity={0.7}>
          {(model.stateRegions ?? []).map((r, i) => (
            <path key={`st${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
          ))}
        </g>
      ) : null}
      {visible.cultures ? (
        <g filter={softenFilter} opacity={0.65}>
          {(model.cultureRegions ?? []).map((r, i) => (
            <path key={`cu${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
          ))}
        </g>
      ) : null}
      {visible.religions ? (
        <g filter={softenFilter} opacity={0.6}>
          {(model.religionRegions ?? []).map((r, i) => (
            <path key={`rel${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
          ))}
        </g>
      ) : null}
      {visible.provinces ? (
        <g filter={softenFilter} opacity={0.6}>
          {(model.provinceRegions ?? []).map((r, i) => (
            <path key={`prov${i}`} d={r.d} fill={r.fill} fillRule="evenodd" />
          ))}
        </g>
      ) : null}
      {visible.population ? (
        <g filter={softenFilter} opacity={0.7}>
          {(model.populationCells ?? []).map((c, i) => (
            <polygon key={`pop${i}`} points={c.points} fill={c.fill} />
          ))}
        </g>
      ) : null}
      {visible.temperature ? (
        <g filter={softenFilter} opacity={0.6}>
          {(model.temperatureCells ?? []).map((c, i) => (
            <polygon key={`tmp${i}`} points={c.points} fill={c.fill} />
          ))}
        </g>
      ) : null}
      {visible.precipitation ? (
        <g filter={softenFilter} opacity={0.6}>
          {(model.precipitationCells ?? []).map((c, i) => (
            <polygon key={`prc${i}`} points={c.points} fill={c.fill} />
          ))}
        </g>
      ) : null}
      {/* Mountain relief glyphs (mountains campaign T9) — peak carets + hill
          chevrons for EVERY land cell in a relief band (height-truth). Placed
          just BELOW the forest glyphs (relief under trees: a forested hill
          shows its canopy over the chevron) and ABOVE the biome fills. Each
          cell strokes its band-inked body, then re-strokes any snowcap sub-path
          WHITE. Crisp (no soften filter); zoom ramp via --relief-glyph-opacity. */}
      {(visible.reliefGlyphs ?? true) && (model.reliefGlyphs?.length ?? 0) > 0 ? (
        <g data-testid="atlas-relief-glyphs" style={RELIEF_GLYPH_OPACITY_VAR}>
          {(model.reliefGlyphs ?? []).map((c, i) => (
            <React.Fragment key={`rg${i}`}>
              <path
                d={c.d}
                fill="none"
                stroke={reliefInk(c.band)}
                strokeWidth={0.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {c.snowD ? (
                <path
                  d={c.snowD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={0.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </React.Fragment>
          ))}
        </g>
      ) : null}
      {/* Forest tree glyphs (forests campaign T6) — tiny per-cell tree stamps
          for NAMED forests only, kind-tinted. Placed at the terrain-texture
          boundary: above every softened fill coloring (the canvas renderer's
          "after the blur" line), below zones/ink (rivers/borders/routes/coast)
          so the map ink stays on top. Crisp on purpose: no soften filter.
          Zoom ramp comes in via --forest-glyph-opacity (see the const above). */}
      {(visible.forestGlyphs ?? true) && (model.forestGlyphs?.length ?? 0) > 0 ? (
        <g data-testid="atlas-forest-glyphs" style={FOREST_GLYPH_OPACITY_VAR}>
          {(model.forestGlyphs ?? []).map((c, i) => (
            <path
              key={`fg${i}`}
              d={c.d}
              fill={c.tint ?? '#2f5233'}
              stroke="#2b3d2e"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
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
      {/* PROTOTYPE danger overlay — red hatch whose per-cell opacity tracks the
          threat scalar. A PATTERN fill (not a solid tint) so it BLENDS over the
          active coloring instead of replacing it (controlled-blending branch). */}
      {visible.danger ? (
        <g>
          {(model.dangerCells ?? []).map((c, i) => (
            <polygon key={`dgr${i}`} points={c.points} fill="url(#danger-hatch)"
              fillOpacity={0.25 + 0.65 * c.danger} />
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
        // Shared route stroke language (road-systems Task 8): the model carries
        // kind + fade opacity; the table here matches the canvas renderer.
        const s = ROUTE_STROKES[(rt.kind ?? 'road') as keyof typeof ROUTE_STROKES] ?? ROUTE_STROKES.road;
        return (
          <g key={`rt${i}`} opacity={rt.opacity ?? 1}>
            {s.casing ? (
              <path d={rt.d} fill="none" stroke={s.casing.stroke} strokeWidth={s.casing.width}
                strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ) : null}
            <path d={rt.d} fill="none" stroke={s.stroke} strokeWidth={s.width}
              strokeDasharray={s.dash ? s.dash.join(' ') : undefined}
              strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </g>
        );
      }) : null}
      {/* Pass marks (mountains campaign T9) — a paired chevron flanking each
          pass cell, drawn in the routes layer AFTER the route strokes (passes
          sit ON routes). Ink only, no fill; NOT zoom-hidden (no opacity ramp) —
          passes are load-bearing wayfinding. */}
      {visible.routes && (model.passMarks?.length ?? 0) > 0 ? (
        <g data-testid="atlas-pass-marks">
          {(model.passMarks ?? []).map((m, i) => (
            <path
              key={`pass${i}`}
              d={passMarkPath(m.x, m.y)}
              fill="none"
              stroke="#3d3833"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ) : null}
      {visible.coast && model.coastline ? (
        <>
          {/* shelf glow + crisp inked coast (double stroke, T3) */}
          <path d={model.coastline} fill="none" stroke="#9fcdef" strokeOpacity={0.4} strokeWidth={5} vectorEffect="non-scaling-stroke" />
          <path d={model.coastline} fill="none" stroke="#1a3d66" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        </>
      ) : null}
      {/* Burgs render as screen-space settlement glyphs in AtlasSvgView (constant
          size, tier-distinct), so they read as map icons instead of facet-sized
          circles on the Voronoi. */}
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
