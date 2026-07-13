/**
 * Mountains campaign Task 9 — SVG renderer smoke for the relief-glyph +
 * pass-mark layers.
 *
 * AtlasLayers renders `model.reliefGlyphs` as one band-inked <path> per land
 * cell (plus a WHITE snowcap path when the cell is a snow-tipped peak),
 * BELOW the forest glyphs (relief under trees) and above the biome fills. The
 * zoom ramp lives on the VIEW side via the CSS custom property
 * `--relief-glyph-opacity` (mirroring the forest layer's freeze fix). Pass
 * marks render in the ROUTES layer, after the route strokes, un-ramped.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import AtlasLayers from '../AtlasLayers';
import AtlasSvgView from '../AtlasSvgView';
import {
  reliefGlyphRampOpacity,
  passMarkPath,
  RELIEF_GLYPH_LAYER_OPACITY,
  type AtlasSvgModel,
} from '../atlasSvg';
import { reliefInk } from '../mountainGlyphs';
import { ROUTE_STROKES } from '../routeMapStyle';

beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

/** Minimal model: a hill, a snow-capped peak, a forest glyph, a route, a pass. */
function reliefModel(): AtlasSvgModel {
  return {
    width: 100,
    height: 100,
    layers: [
      { id: 'ocean', polygons: [], regions: [] },
      { id: 'land', polygons: [], regions: [{ d: 'M0,0L10,0L10,10Z', fill: '#3a5f3a' }] },
    ],
    routes: [{ d: 'M0,0L5,5', group: 'roads', kind: 'road', opacity: 1 }],
    forestGlyphs: [{ d: 'M3 3L3 1', tint: null }],
    reliefGlyphs: [
      { d: 'M1 1L1 -1', band: 'hill', snowD: '' },
      { d: 'M2 2L2 0', band: 'peak', snowD: 'M2 1L2 0' },
    ],
    passMarks: [{ x: 5, y: 5 }],
  };
}

describe('AtlasLayers relief glyph layer', () => {
  it('renders one band-inked path per cell plus a white snowcap path for peaks', () => {
    const { container } = render(
      <svg><AtlasLayers model={reliefModel()} visible={{ biomes: true }} /></svg>,
    );
    const group = container.querySelector('[data-testid="atlas-relief-glyphs"]');
    expect(group).toBeTruthy();
    const paths = Array.from(group!.querySelectorAll('path'));
    // hill body + peak body + peak snowcap = 3 paths.
    expect(paths).toHaveLength(3);
    // Hill body inked soft grey-brown; peak body dark ink.
    expect(paths[0].getAttribute('stroke')).toBe(reliefInk('hill'));
    expect(paths[1].getAttribute('stroke')).toBe(reliefInk('peak'));
    // The snowcap re-strokes the cap WHITE.
    const white = paths.find((p) => p.getAttribute('stroke') === '#ffffff');
    expect(white).toBeTruthy();
    expect(white!.getAttribute('d')).toBe('M2 1L2 0');
    for (const p of paths) {
      expect(p.getAttribute('fill')).toBe('none');
      expect(p.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    }
  });

  it('draws relief glyphs UNDER the forest glyphs (relief under trees)', () => {
    const { container } = render(
      <svg><AtlasLayers model={reliefModel()} visible={{ biomes: true }} /></svg>,
    );
    const relief = container.querySelector('[data-testid="atlas-relief-glyphs"]')!;
    const forest = container.querySelector('[data-testid="atlas-forest-glyphs"]')!;
    expect(relief).toBeTruthy();
    expect(forest).toBeTruthy();
    // Forest must come AFTER relief in document order (paints on top).
    expect(relief.compareDocumentPosition(forest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reads its layer opacity from the view-side CSS variable with the full-opacity fallback', () => {
    const { container } = render(
      <svg><AtlasLayers model={reliefModel()} visible={{ biomes: true }} /></svg>,
    );
    const group = container.querySelector('[data-testid="atlas-relief-glyphs"]') as SVGGElement;
    expect(group.getAttribute('style') ?? '').toContain(
      `var(--relief-glyph-opacity, ${RELIEF_GLYPH_LAYER_OPACITY})`,
    );
  });

  it('is on by default and hides when the reliefGlyphs toggle is off', () => {
    const on = render(<svg><AtlasLayers model={reliefModel()} visible={{ biomes: true }} /></svg>);
    expect(on.container.querySelector('[data-testid="atlas-relief-glyphs"]')).toBeTruthy();
    const off = render(
      <svg><AtlasLayers model={reliefModel()} visible={{ biomes: true, reliefGlyphs: false }} /></svg>,
    );
    expect(off.container.querySelector('[data-testid="atlas-relief-glyphs"]')).toBeNull();
  });

  it('renders no group when the model carries no relief cells (pre-mountains fixtures)', () => {
    const bare = reliefModel();
    bare.reliefGlyphs = [];
    const { container } = render(<svg><AtlasLayers model={bare} visible={{ biomes: true }} /></svg>);
    expect(container.querySelector('[data-testid="atlas-relief-glyphs"]')).toBeNull();
    const noField = reliefModel();
    delete noField.reliefGlyphs;
    const { container: c2 } = render(<svg><AtlasLayers model={noField} visible={{ biomes: true }} /></svg>);
    expect(c2.querySelector('[data-testid="atlas-relief-glyphs"]')).toBeNull();
  });
});

describe('AtlasLayers pass marks', () => {
  it('renders a paired-chevron mark per pass in the routes layer, after the route strokes', () => {
    const { container } = render(
      <svg><AtlasLayers model={reliefModel()} visible={{ biomes: true, routes: true }} /></svg>,
    );
    const group = container.querySelector('[data-testid="atlas-pass-marks"]');
    expect(group).toBeTruthy();
    const paths = Array.from(group!.querySelectorAll('path'));
    expect(paths).toHaveLength(1);
    expect(paths[0].getAttribute('d')).toBe(passMarkPath(5, 5));
    expect(paths[0].getAttribute('stroke')).toBe('#3d3833');
    expect(paths[0].getAttribute('fill')).toBe('none');
    // Route ink paints BEFORE the pass mark (marks sit on top of routes).
    const route = container.querySelector(`path[stroke="${ROUTE_STROKES.road.stroke}"]`)!;
    expect(route.compareDocumentPosition(group!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides pass marks when the routes layer is off (passes sit on routes)', () => {
    const { container } = render(
      <svg><AtlasLayers model={reliefModel()} visible={{ biomes: true, routes: false }} /></svg>,
    );
    expect(container.querySelector('[data-testid="atlas-pass-marks"]')).toBeNull();
  });

  it('renders no pass group when the model carries none (pre-mountains packs)', () => {
    const bare = reliefModel();
    bare.passMarks = [];
    const { container } = render(
      <svg><AtlasLayers model={bare} visible={{ biomes: true, routes: true }} /></svg>,
    );
    expect(container.querySelector('[data-testid="atlas-pass-marks"]')).toBeNull();
  });
});

describe('AtlasSvgView relief zoom-ramp wiring', () => {
  // Two 20×20 mountain cells (h85 snow-peak + h60 hill); pack has no forests.
  const mountainAtlas = {
    graphWidth: 100,
    graphHeight: 100,
    biomesData: { color: ['#001122', '#11aa33', '#cccccc'] },
    pack: {
      vertices: { p: [[0, 0], [20, 0], [20, 20], [0, 20], [40, 0], [40, 20]] },
      cells: {
        h: [85, 60],
        v: [[0, 1, 2, 3], [1, 4, 5, 2]],
        biome: [2, 2],
        p: [[10, 10], [30, 10]],
      },
    },
  } as any;

  it('sets --relief-glyph-opacity from view.k on the zoom-transform group', () => {
    const { container } = render(<AtlasSvgView atlas={mountainAtlas} width={300} height={300} />);
    // The relief layer made it through model → AtlasLayers.
    expect(container.querySelector('[data-testid="atlas-relief-glyphs"]')).toBeTruthy();
    let transformG: SVGGElement | null = null;
    let k = NaN;
    for (const g of Array.from(container.querySelectorAll('g'))) {
      const m = /scale\(([-\d.]+)\)/.exec(g.getAttribute('transform') ?? '');
      if (m) { transformG = g as SVGGElement; k = parseFloat(m[1]); break; }
    }
    expect(transformG).toBeTruthy();
    const varValue = transformG!.style.getPropertyValue('--relief-glyph-opacity');
    expect(varValue).not.toBe('');
    expect(parseFloat(varValue)).toBeCloseTo(reliefGlyphRampOpacity(k), 10);
    // 300×300 over 100×100 → contain-fit k=3 ≥ FULL zoom → full layer opacity.
    expect(parseFloat(varValue)).toBeCloseTo(RELIEF_GLYPH_LAYER_OPACITY, 10);
  });
});
