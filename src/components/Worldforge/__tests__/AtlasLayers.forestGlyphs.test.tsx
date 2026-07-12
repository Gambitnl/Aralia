/**
 * Forests campaign Task 6 — SVG renderer smoke for the forest tree-glyph layer.
 *
 * AtlasLayers renders `model.forestGlyphs` as one <path> per forest cell,
 * kind-tinted, BETWEEN the terrain fill layers and the routes ink. The zoom
 * ramp lives on the VIEW side: AtlasLayers is React.memo'd with no zoom access
 * (the World Map freeze fix), so its glyph group reads the CSS custom property
 * `--forest-glyph-opacity`, which AtlasSvgView sets on the zoom-transform <g>
 * every frame — zero memo busts while zooming.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import AtlasLayers from '../AtlasLayers';
import AtlasSvgView from '../AtlasSvgView';
import { forestGlyphRampOpacity, FOREST_GLYPH_LAYER_OPACITY, type AtlasSvgModel } from '../atlasSvg';
import { ROUTE_STROKES } from '../routeMapStyle';
import { Biomes } from '../../../systems/worldforge/fmg/biomes';
import { FOREST_TINTS } from '../../../systems/worldforge/forests/forestTunables';

beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

/** Hand-built minimal model carrying two glyph cells (one tinted) + a route. */
function glyphModel(): AtlasSvgModel {
  return {
    width: 100,
    height: 100,
    layers: [
      { id: 'ocean', polygons: [], regions: [] },
      { id: 'land', polygons: [], regions: [{ d: 'M0,0L10,0L10,10Z', fill: '#3a5f3a' }] },
    ],
    routes: [{ d: 'M0,0L5,5', group: 'roads', kind: 'road', opacity: 1 }],
    forestGlyphs: [
      { d: 'M1 1L1 -1', tint: null },
      { d: 'M2 2L2 0', tint: FOREST_TINTS.haunted },
    ],
  };
}

describe('AtlasLayers forest glyph layer', () => {
  it('renders one path per glyph cell, kind-tinted, with the shared ink style', () => {
    const { container } = render(
      <svg><AtlasLayers model={glyphModel()} visible={{ biomes: true, routes: true }} /></svg>,
    );
    const group = container.querySelector('[data-testid="atlas-forest-glyphs"]');
    expect(group).toBeTruthy();
    const paths = group!.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute('fill')).toBe('#2f5233'); // no tint → default glyph green
    expect(paths[1].getAttribute('fill')).toBe(FOREST_TINTS.haunted);
    for (const p of Array.from(paths)) {
      expect(p.getAttribute('stroke')).toBe('#2b3d2e');
      expect(p.getAttribute('stroke-width')).toBe('0.5');
      expect(p.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    }
  });

  it('draws glyphs UNDER the routes ink (between terrain fills and routes)', () => {
    const { container } = render(
      <svg><AtlasLayers model={glyphModel()} visible={{ biomes: true, routes: true }} /></svg>,
    );
    const group = container.querySelector('[data-testid="atlas-forest-glyphs"]')!;
    const route = container.querySelector(`path[stroke="${ROUTE_STROKES.road.stroke}"]`)!;
    expect(route).toBeTruthy();
    // Routes must come AFTER the glyph group in document order (paint on top).
    expect(group.compareDocumentPosition(route) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reads its layer opacity from the view-side CSS variable with the full-opacity fallback', () => {
    const { container } = render(
      <svg><AtlasLayers model={glyphModel()} visible={{ biomes: true }} /></svg>,
    );
    const group = container.querySelector('[data-testid="atlas-forest-glyphs"]') as SVGGElement;
    expect(group.getAttribute('style') ?? '').toContain(
      `var(--forest-glyph-opacity, ${FOREST_GLYPH_LAYER_OPACITY})`,
    );
  });

  it('is on by default and hides when the forestGlyphs toggle is off', () => {
    const on = render(<svg><AtlasLayers model={glyphModel()} visible={{ biomes: true }} /></svg>);
    expect(on.container.querySelector('[data-testid="atlas-forest-glyphs"]')).toBeTruthy();
    const off = render(
      <svg><AtlasLayers model={glyphModel()} visible={{ biomes: true, forestGlyphs: false }} /></svg>,
    );
    expect(off.container.querySelector('[data-testid="atlas-forest-glyphs"]')).toBeNull();
  });

  it('renders no group at all when the model carries no glyph cells (pre-forests fixtures)', () => {
    const bare = glyphModel();
    bare.forestGlyphs = [];
    const { container } = render(<svg><AtlasLayers model={bare} visible={{ biomes: true }} /></svg>);
    expect(container.querySelector('[data-testid="atlas-forest-glyphs"]')).toBeNull();
    const noField = glyphModel();
    delete noField.forestGlyphs;
    const { container: c2 } = render(<svg><AtlasLayers model={noField} visible={{ biomes: true }} /></svg>);
    expect(c2.querySelector('[data-testid="atlas-forest-glyphs"]')).toBeNull();
  });
});

describe('AtlasSvgView zoom ramp wiring', () => {
  // Two 20×20 forest cells; Biomes.getDefault() gives biome 6 a real icon table.
  const forestAtlas = {
    graphWidth: 100,
    graphHeight: 100,
    biomesData: Biomes.getDefault(),
    pack: {
      vertices: { p: [[0, 0], [20, 0], [20, 20], [0, 20], [40, 0], [40, 20]] },
      cells: {
        h: [50, 50],
        v: [[0, 1, 2, 3], [1, 4, 5, 2]],
        biome: [6, 6],
        p: [[10, 10], [30, 10]],
      },
      forests: [{ i: 1, name: 'Testwood', kind: 'ordinary', cells: [0, 1], pole: [20, 10] }],
    },
  } as any;

  it('sets --forest-glyph-opacity from view.k on the zoom-transform group', () => {
    const { container } = render(<AtlasSvgView atlas={forestAtlas} width={300} height={300} />);
    // The glyph layer made it through model → AtlasLayers.
    expect(container.querySelector('[data-testid="atlas-forest-glyphs"]')).toBeTruthy();
    // Find the zoom-transform group and read k back out of it.
    let transformG: SVGGElement | null = null;
    let k = NaN;
    for (const g of Array.from(container.querySelectorAll('g'))) {
      const m = /scale\(([-\d.]+)\)/.exec(g.getAttribute('transform') ?? '');
      if (m) { transformG = g as SVGGElement; k = parseFloat(m[1]); break; }
    }
    expect(transformG).toBeTruthy();
    // 300×300 viewport over a 100×100 world → contain-fit k=3 ≥ GLYPH_FULL_ZOOM.
    const varValue = transformG!.style.getPropertyValue('--forest-glyph-opacity');
    expect(varValue).not.toBe('');
    expect(parseFloat(varValue)).toBeCloseTo(forestGlyphRampOpacity(k), 10);
    expect(parseFloat(varValue)).toBeCloseTo(FOREST_GLYPH_LAYER_OPACITY, 10);
  });
});
