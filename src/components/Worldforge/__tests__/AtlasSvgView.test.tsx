import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import AtlasSvgView, { labelBudgetForViewport } from '../AtlasSvgView';
import { requestMapCenterOnPlayer, consumeMapCenterOnPlayer } from '../mapFocusSignal';
import type { MultiModalRoute } from '../../../systems/travel/multiModalRoute';

// Layer prefs persist to localStorage (real behavior); clear between tests so
// one test's coloring choice doesn't leak into the next.
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

const stub = {
  graphWidth: 100, graphHeight: 100,
  biomesData: { color: ['#000', '#11aa33'] },
  pack: { vertices: { p: [[0,0],[10,0],[10,10],[0,10]] },
          // cell 1 is lowland (h30, below the relief-glyph band) so the shared
          // stub stays isolated from the mountains T9 relief layer — relief
          // stamping is exercised in AtlasLayers.reliefGlyphs / atlasDraw tests.
          cells: { h: [5, 30], v: [[0,1,2], [0,1,2,3]], biome: [0, 1], p: [[2,2],[7,7]] } },
} as any;

describe('AtlasSvgView', () => {
  it('renders an <svg> with one merged land-region path (T2: no per-cell polygons)', () => {
    const { container } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    expect(container.querySelector('svg')).toBeTruthy();
    const paths = container.querySelectorAll('path');
    // 1 merged biome region (filled) + 2 coastline strokes (shelf glow + crisp, T3)
    expect(paths).toHaveLength(3);
    expect(paths[0].getAttribute('fill')).toBe('rgb(17,170,51)');           // biome region
    const coasts = Array.from(paths).filter((p) => p.getAttribute('fill') === 'none');
    expect(coasts).toHaveLength(2);                                   // double-stroke coast
    expect(coasts.some((p) => p.getAttribute('stroke') === '#1a3d66')).toBe(true);
    expect(container.querySelectorAll('polygon')).toHaveLength(0);
  });

  it('renders the always-on player marker when a marker prop is given (T7)', () => {
    const { container, rerender } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    expect(container.querySelector('[data-testid="atlas-player-marker"]')).toBeNull();
    rerender(<AtlasSvgView atlas={stub} width={300} height={300} marker={{ x: 50, y: 50 }} />);
    expect(container.querySelector('[data-testid="atlas-player-marker"]')).toBeTruthy();
  });

  it('exposes a named keyboard map whose arrows inspect real neighbors and Enter picks', () => {
    const picks: number[] = [];
    const keyboardStub = {
      ...stub,
      pack: { ...stub.pack, cells: { ...stub.pack.cells, c: [[1], [0]] } },
    };
    const { getByRole, queryByTestId } = render(
      <AtlasSvgView
        atlas={keyboardStub}
        width={300}
        height={300}
        travelActive
        onPickCell={(cell) => picks.push(cell.i)}
      />,
    );

    const map = getByRole('application', { name: /world atlas travel map/i });
    fireEvent.focus(map);
    expect(map).toHaveAttribute('tabindex', '0');
    expect(map).toHaveStyle({ outline: '3px solid #f5c542' });
    fireEvent.keyDown(map, { key: 'ArrowLeft' });
    expect(queryByTestId('atlas-cell-info')).toBeTruthy();
    expect(picks).toEqual([]);
    fireEvent.keyDown(map, { key: 'Enter' });
    expect(picks).toEqual([0]);
  });

  it('uses first-tap preview and second-tap commit for touch travel', () => {
    const picks: number[] = [];
    const { getByTestId, queryByTestId } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} travelActive onPickCell={(cell) => picks.push(cell.i)} />,
    );
    const svg = getByTestId('atlas-svg-view');
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300,
      toJSON: () => ({}),
    } as DOMRect);

    const tap = () => {
      fireEvent.pointerDown(svg, { clientX: 150, clientY: 150, pointerId: 4, pointerType: 'touch' });
      fireEvent.pointerUp(svg, { clientX: 150, clientY: 150, pointerId: 4, pointerType: 'touch' });
      fireEvent.click(svg, { clientX: 150, clientY: 150 });
    };
    tap();
    expect(queryByTestId('atlas-cell-info')).toBeTruthy();
    expect(picks).toEqual([]);
    tap();
    expect(picks).toHaveLength(1);
  });

  it('shows a Find Me button only when a player marker is given, and clicking it surfaces the player cell', () => {
    const { container, queryByTestId, getByTestId, rerender } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    expect(queryByTestId('atlas-center-player')).toBeNull(); // no marker → no button

    rerender(<AtlasSvgView atlas={stub} width={300} height={300} marker={{ x: 5, y: 5 }} />);
    const findMe = getByTestId('atlas-center-player');
    expect(findMe).toBeTruthy();
    expect(findMe).toHaveStyle({ minHeight: '44px' });
    fireEvent.click(findMe);
    // Clicking resolves the player's cell → info panel appears (which cell am I at).
    expect(container.querySelector('[data-testid="atlas-cell-info"]')).toBeTruthy();
  });

  it('renders a discovery pin per markers entry (SP4 atlas pins)', () => {
    const { container } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} markers={[{ x: 10, y: 20, label: 'Cave' }, { x: 30, y: 40 }]} />,
    );
    expect(container.querySelectorAll('[data-testid="atlas-discovery-pin"]')).toHaveLength(2);
  });

  it('draws a provisioning ring (with labeled legend) for each resource horizon prop', () => {
    const { queryByTestId } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    // No rings without the prop.
    expect(queryByTestId('atlas-provision-ring')).toBeNull();
    expect(queryByTestId('atlas-provision-ring-legend')).toBeNull();

    const { container, getByTestId } = render(
      <AtlasSvgView
        atlas={stub}
        width={300}
        height={300}
        provisionRings={[
          { cellIds: [1], color: '#eab308', label: 'Food reach' },
          { cellIds: [1], color: '#38bdf8', label: 'Water reach' },
        ]}
      />,
    );
    expect(container.querySelectorAll('[data-testid="atlas-provision-ring"]')).toHaveLength(2);
    const legend = getByTestId('atlas-provision-ring-legend');
    expect(legend.textContent).toContain('Food reach');
    expect(legend.textContent).toContain('Water reach');
  });

  it('a pan gesture (drag) suppresses the travel-click — onPickCell is not fired', () => {
    let picks = 0;
    const { getByTestId } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} onPickCell={() => { picks += 1; }} />,
    );
    const svg = getByTestId('atlas-svg-view');
    // Grab → move beyond the slop → release → click: this is a pan, not a pick.
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(svg, { clientX: 140, clientY: 130, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(svg, { pointerId: 1, pointerType: 'mouse' });
    fireEvent.click(svg, { clientX: 140, clientY: 130 });
    expect(picks).toBe(0);
  });

  it('a stray move after the drag is released does not crash (drag.current null-read regression)', () => {
    const { getByTestId, container } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} onPickCell={() => {}} />,
    );
    const svg = getByTestId('atlas-svg-view');
    // Grab → pan → release → a stray move arrives after onUp nulled drag.current.
    // The setView updater used to lazily read drag.current!.x → "reading 'x' of null".
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(svg, { clientX: 140, clientY: 130, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(svg, { pointerId: 1, pointerType: 'mouse' });
    expect(() => fireEvent.pointerMove(svg, { clientX: 180, clientY: 160, pointerId: 1, pointerType: 'mouse' })).not.toThrow();
    // Component survives (no error boundary swap): the atlas svg is still mounted.
    expect(container.querySelector('[data-testid="atlas-svg-view"]')).toBeTruthy();
  });

  // The world content group is drawn as <g transform="translate(x,y) scale(k)">.
  // Reading k back is how we assert the zoom level survived (or was refit).
  const readScale = (container: HTMLElement): number | null => {
    for (const g of Array.from(container.querySelectorAll('g'))) {
      const m = /scale\(([-\d.]+)\)/.exec(g.getAttribute('transform') ?? '');
      if (m) return parseFloat(m[1]);
    }
    return null;
  };

  it('preserves the user zoom across a viewport-size change (Travel/Explore toggle no longer resets it)', () => {
    const { container, rerender } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    const svg = container.querySelector('[data-testid="atlas-svg-view"]')!;
    const fitK = readScale(container)!;

    // Player zooms in with the wheel.
    fireEvent.wheel(svg, { deltaY: -100 });
    const zoomedK = readScale(container)!;
    expect(zoomedK).toBeGreaterThan(fitK);

    // Toggling Travel↔Explore grows the toolbar, shrinking the measured map area.
    // Simulate that height change: the zoom must be PRESERVED, not refit to fill.
    rerender(<AtlasSvgView atlas={stub} width={300} height={240} />);
    expect(readScale(container)!).toBeCloseTo(zoomedK, 5);
  });

  it('still auto-refits on a viewport change until the player takes control of the view', () => {
    const { container, rerender } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    const k1 = readScale(container)!;
    // No manual zoom yet → a genuine size change should refit to the new viewport.
    rerender(<AtlasSvgView atlas={stub} width={600} height={600} />);
    expect(readScale(container)!).toBeGreaterThan(k1);
  });

  it('menu exposes a Map coloring section + an Info panel detail selector', () => {
    const { getByLabelText, getByTestId, getByText, queryByTestId } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    expect(queryByTestId('atlas-info-verbosity')).toBeNull(); // panel closed initially
    const toggle = getByTestId('atlas-layers-toggle');
    expect(toggle).toHaveStyle({ minHeight: '44px' });
    fireEvent.click(toggle);
    const panel = getByTestId('atlas-layers-panel');
    expect(panel).toHaveStyle({ maxHeight: '248px', overflowY: 'auto' });
    expect(getByText('Map coloring')).toBeTruthy();
    expect(getByText('Info panel')).toBeTruthy();
    // The native inputs span their 44px rows so the visible layer choices are
    // playable in cramped atlas panes, not just technically selectable by label.
    expect(getByLabelText('Biomes')).toHaveStyle({ position: 'absolute', width: '100%', height: '100%' });
    expect(panel.querySelector('input[type="checkbox"]')).toHaveStyle({ position: 'absolute', width: '100%', height: '100%' });
    const select = getByTestId('atlas-info-verbosity') as HTMLSelectElement;
    expect(select).toHaveStyle({ minHeight: '44px' });
    expect(select.value).toBe('standard');
    fireEvent.change(select, { target: { value: 'full' } });
    expect(select.value).toBe('full');
    expect(getByTestId('atlas-layers-reset')).toHaveStyle({ minHeight: '44px' });
  });

  it('dismisses the layer menu with Escape or an outside pointer press', () => {
    const { getByTestId, queryByTestId } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    const outerEscapeHandler = vi.fn();
    document.addEventListener('keydown', outerEscapeHandler, true);

    try {
      fireEvent.click(getByTestId('atlas-layers-toggle'));
      expect(queryByTestId('atlas-layers-panel')).toBeTruthy();
      fireEvent.keyDown(document, { key: 'Escape', bubbles: true, cancelable: true });
      expect(queryByTestId('atlas-layers-panel')).toBeNull();
      expect(outerEscapeHandler).not.toHaveBeenCalled();

      fireEvent.click(getByTestId('atlas-layers-toggle'));
      expect(queryByTestId('atlas-layers-panel')).toBeTruthy();
      fireEvent.pointerDown(document.body);
      expect(queryByTestId('atlas-layers-panel')).toBeNull();
    } finally {
      document.removeEventListener('keydown', outerEscapeHandler, true);
    }
  });

  it('caps the layer menu to the viewport space below its trigger', () => {
    const originalInnerHeight = window.innerHeight;
    const originalVisualViewport = window.visualViewport;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });

    try {
      const { getByTestId } = render(
        <AtlasSvgView atlas={stub} width={300} height={240} />,
      );
      const toggle = getByTestId('atlas-layers-toggle');
      toggle.getBoundingClientRect = () => ({
        x: 220,
        y: 190,
        width: 62,
        height: 30,
        top: 190,
        right: 282,
        bottom: 220,
        left: 220,
        toJSON: () => ({}),
      });

      fireEvent.click(toggle);
      const panel = getByTestId('atlas-layers-panel');
      expect(panel).toHaveStyle({
        position: 'fixed',
        top: '224px',
      });
      expect(panel.style.overflowY).toBe('auto');
      expect(Number.parseFloat(panel.style.maxHeight)).toBeLessThanOrEqual(548);
    } finally {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalVisualViewport });
    }
  });

  it('opens the layer menu upward when the trigger is near the viewport bottom', () => {
    const originalInnerHeight = window.innerHeight;
    const originalInnerWidth = window.innerWidth;
    const originalVisualViewport = window.visualViewport;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });

    try {
      const { getByTestId } = render(
        <AtlasSvgView atlas={stub} width={300} height={240} />,
      );
      const toggle = getByTestId('atlas-layers-toggle');
      toggle.getBoundingClientRect = () => ({
        x: 220,
        y: 462,
        width: 62,
        height: 44,
        top: 462,
        right: 282,
        bottom: 506,
        left: 220,
        toJSON: () => ({}),
      });

      fireEvent.click(toggle);

      // A small map inside a floating window can put the layer trigger near the
      // viewport bottom. The panel should escape the clipped atlas viewport and
      // sit in the available space above the trigger instead of exposing only
      // the first few rows.
      expect(getByTestId('atlas-layers-panel')).toHaveStyle({
        position: 'fixed',
        top: '270px',
        right: '38px',
        maxHeight: '188px',
        overflowY: 'auto',
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalVisualViewport });
    }
  });

  it('opens clicked town details as a mobile overlay above the map help area', () => {
    const burgStub = {
      graphWidth: 100,
      graphHeight: 100,
      biomesData: { color: ['#000', '#11aa33'], name: ['Ocean', 'Grassland'] },
      pack: {
        vertices: { p: [[40, 40], [60, 40], [60, 60], [40, 60]] },
        cells: {
          h: [50],
          v: [[0, 1, 2, 3]],
          biome: [1],
          p: [[50, 50]],
          burg: [1],
        },
        burgs: [null, { i: 1, name: 'Oakleigh', x: 50, y: 50, cell: 0, population: 20 }],
      },
    } as any;
    const { getByTestId } = render(
      <AtlasSvgView atlas={burgStub} width={220} height={160} onPickCell={() => {}} />,
    );
    const svg = getByTestId('atlas-svg-view');
    svg.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 220,
      bottom: 160,
      width: 220,
      height: 160,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.click(svg, { clientX: 110, clientY: 80 });

    expect(getByTestId('atlas-town-card')).toHaveStyle({
      left: '8px',
      right: '8px',
      overflowY: 'auto',
      zIndex: '60',
      background: 'rgb(28, 20, 12)',
    });
    expect(getByTestId('atlas-town-card').querySelector('button[aria-label="Close town details"]')).toHaveStyle({
      minHeight: '44px',
      minWidth: '44px',
    });
  });

  it('budgets only one overview label in phone-sized map panes', () => {
    expect(labelBudgetForViewport(300, 220)).toBe(1);
    expect(labelBudgetForViewport(246, 228)).toBe(1);
    expect(labelBudgetForViewport(640, 360)).toBeUndefined();
  });

  it('map coloring is an exclusive radio: picking "None" replaces biomes with the neutral land base', () => {
    const { container, getByTestId, getByLabelText } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    const hasFill = (f: string) =>
      Array.from(container.querySelectorAll('path')).some((p) => p.getAttribute('fill') === f);
    expect(hasFill('rgb(17,170,51)')).toBe(true);  // biome region shown by default
    expect(hasFill('#d9d2bd')).toBe(false); // no neutral base while biomes is the coloring

    fireEvent.click(getByTestId('atlas-layers-toggle'));    // open the panel
    fireEvent.click(getByLabelText('None (plain land)'));   // exclusive: deselects Biomes

    expect(hasFill('rgb(17,170,51)')).toBe(false); // biome region gone
    expect(hasFill('#d9d2bd')).toBe(true);  // land still drawn (neutral base) — never blank
  });

  it('the legend reports the active coloring and hides for the plain-land mode', () => {
    const { getByTestId, getByLabelText, queryByTestId } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    expect(getByTestId('atlas-legend').textContent).toContain('Biomes');

    fireEvent.click(getByTestId('atlas-layers-toggle'));
    fireEvent.click(getByLabelText('None (plain land)'));
    expect(queryByTestId('atlas-legend')).toBeNull(); // nothing to explain in plain-land mode
  });

  it('disables a coloring mode that has no data on this map (empty ⇒ not a silent no-op)', () => {
    // The stub has no culture/religion/province/climate arrays, so those modes are empty.
    const { getByTestId, getByLabelText } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    fireEvent.click(getByTestId('atlas-layers-toggle'));
    const cultures = getByLabelText(/Cultures/) as HTMLInputElement;
    expect(cultures.disabled).toBe(true); // empty layer is disabled, not a dead toggle
    const states = getByLabelText(/States/) as HTMLInputElement;
    expect(states.disabled).toBe(true);   // no pack.states ⇒ States coloring disabled too
  });

  // A world with two land cells under one named state, for political-coloring tests.
  const statefulStub = {
    graphWidth: 100, graphHeight: 100,
    biomesData: { color: ['#000', '#11aa33'] },
    pack: {
      vertices: { p: [[0, 0], [10, 0], [10, 10], [0, 10]] },
      cells: { h: [50, 50], v: [[0, 1, 2], [0, 1, 2, 3]], biome: [1, 1], p: [[2, 2], [7, 7]], state: [1, 1] },
      states: [{ i: 0, name: 'Neutrals' }, { i: 1, name: 'Aralia', fullName: 'Kingdom of Aralia', color: '#cc4444' }],
    },
  } as any;

  it('States coloring fills land by state color and names the state in the legend swatch', () => {
    const { container, getByTestId, getByLabelText } = render(
      <AtlasSvgView atlas={statefulStub} width={300} height={300} />,
    );
    const hasFill = (f: string) =>
      Array.from(container.querySelectorAll('path')).some((p) => p.getAttribute('fill') === f);

    fireEvent.click(getByTestId('atlas-layers-toggle'));
    const states = getByLabelText(/States/) as HTMLInputElement;
    expect(states.disabled).toBe(false); // has pack.states ⇒ enabled
    fireEvent.click(states);

    expect(hasFill('#cc4444')).toBe(true);  // land painted by the state color
    expect(hasFill('#11aa33')).toBe(false); // biome coloring replaced (exclusive)
    // Named swatch (not the generic "each tint = one state" caption).
    const swatches = getByTestId('atlas-legend-swatches');
    expect(swatches.textContent).toContain('Kingdom of Aralia');
  });

  it('Danger overlay (PROTOTYPE) hatches threatened cells over the active coloring', () => {
    // Cell 1 is the lone land cell (like the base stub) and hosts a war ⇒ the
    // danger overlay should hatch it while the biome coloring stays underneath.
    const dangerStub = {
      graphWidth: 100, graphHeight: 100,
      biomesData: { color: ['#000', '#11aa33'] },
      pack: {
        vertices: { p: [[0, 0], [10, 0], [10, 10], [0, 10]] },
        cells: { h: [5, 50], v: [[0, 1, 2], [0, 1, 2, 3]], biome: [0, 1], p: [[2, 2], [7, 7]], c: [[1], [0]] },
        zones: [{ type: 'Invasion', cells: [1] }],
      },
    } as any;
    const { container, getByTestId, getByLabelText } = render(
      <AtlasSvgView atlas={dangerStub} width={300} height={300} />,
    );
    const hatched = () =>
      Array.from(container.querySelectorAll('polygon')).filter((p) => (p.getAttribute('fill') || '').includes('danger-hatch')).length;
    expect(hatched()).toBe(0); // off by default

    fireEvent.click(getByTestId('atlas-layers-toggle'));
    const danger = getByLabelText(/Danger/) as HTMLInputElement;
    expect(danger.disabled).toBe(false); // has a zone ⇒ enabled
    fireEvent.click(danger);
    expect(hatched()).toBeGreaterThan(0); // threatened cell(s) now hatched
    // Danger is a feature toggle (blends), so the biome coloring is still present.
    expect(Array.from(container.querySelectorAll('path')).some((p) => (p.getAttribute('fill') ?? '').startsWith('rgb('))).toBe(true);
  });

  it('persists layer prefs per scope (different worlds remember different colorings)', () => {
    // World A: switch to None and remember it.
    const a = render(<AtlasSvgView atlas={stub} width={300} height={300} prefsScope="world-A" />);
    fireEvent.click(a.getByTestId('atlas-layers-toggle'));
    fireEvent.click(a.getByLabelText('None (plain land)'));
    a.unmount();

    // World B (different scope) opens at the default coloring, not World A's choice.
    const b = render(<AtlasSvgView atlas={stub} width={300} height={300} prefsScope="world-B" />);
    expect(b.getByTestId('atlas-legend').textContent).toContain('Biomes');
    b.unmount();

    // Reopening World A restores its remembered None mode (legend hidden).
    const a2 = render(<AtlasSvgView atlas={stub} width={300} height={300} prefsScope="world-A" />);
    expect(a2.queryByTestId('atlas-legend')).toBeNull();
  });
  it('renders segmented multimodal travel legs and the composite readout', () => {
    const multimodalRoute: MultiModalRoute = {
      cells: [0, 1, 2],
      points: [[2, 2], [5, 5], [7, 7]],
      segments: [
        { kind: 'land', points: [[2, 2], [5, 5]] },
        { kind: 'sea', points: [[5, 5], [7, 7]] },
      ],
      miles: 4,
      landMiles: 2,
      seaMiles: 2,
      minutes: 200,
      danger: 0.4,
    };
    const { container } = render(
      <AtlasSvgView
        atlas={stub}
        width={300}
        height={300}
        travelActive
        planRoute={() => null}
        planMultiModalRoute={() => multimodalRoute}
      />,
    );

    const svg = container.querySelector('[data-testid="atlas-svg-view"]')!;
    svg.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 300,
      width: 300, height: 300,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 150, pointerId: 1, pointerType: 'mouse' });

    expect(container.querySelectorAll('[data-testid="atlas-travel-segment-land"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="atlas-travel-segment-sea"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="atlas-harbor-marker"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="atlas-travel-readout"]')?.textContent).toContain('2.0 mi land');
    expect(container.querySelector('[data-testid="atlas-travel-readout"]')?.textContent).toContain('2.0 mi sea');
  });

  it('renders a tender leg with its own muted dotted style, distinct from sea and land', () => {
    const multimodalRoute: MultiModalRoute = {
      cells: [0, 1, 2, 3],
      points: [[2, 2], [5, 5], [7, 7], [7.3, 7.3]],
      segments: [
        { kind: 'land', points: [[2, 2], [5, 5]] },
        { kind: 'sea', points: [[5, 5], [7, 7]] },
        { kind: 'tender', points: [[7, 7], [7.3, 7.3]] },
      ],
      miles: 4.3,
      landMiles: 2,
      seaMiles: 2,
      tenderMiles: 0.3,
      minutes: 210,
      danger: 0.4,
    };
    const { container } = render(
      <AtlasSvgView
        atlas={stub}
        width={300}
        height={300}
        travelActive
        planRoute={() => null}
        planMultiModalRoute={() => multimodalRoute}
      />,
    );

    const svg = container.querySelector('[data-testid="atlas-svg-view"]')!;
    svg.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 300, bottom: 300,
      width: 300, height: 300,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.pointerMove(svg, { clientX: 150, clientY: 150, pointerId: 1, pointerType: 'mouse' });

    const tenderSeg = container.querySelector('[data-testid="atlas-travel-segment-tender"]')!;
    expect(tenderSeg).not.toBeNull();
    expect(tenderSeg.getAttribute('stroke')).toBe('#cbb48f');
    expect(tenderSeg.getAttribute('stroke-dasharray')).toBe('0.5 3');
    // Distinct from the sea leg (cyan '2 5') and the land leg ('6 4').
    const seaSeg = container.querySelector('[data-testid="atlas-travel-segment-sea"]')!;
    expect(seaSeg.getAttribute('stroke')).toBe('#38bdf8');
    expect(seaSeg.getAttribute('stroke-dasharray')).toBe('2 5');
    const landSeg = container.querySelector('[data-testid="atlas-travel-segment-land"]')!;
    expect(landSeg.getAttribute('stroke-dasharray')).toBe('6 4');
    expect(tenderSeg.getAttribute('stroke')).not.toBe(seaSeg.getAttribute('stroke'));
    expect(tenderSeg.getAttribute('stroke')).not.toBe(landSeg.getAttribute('stroke'));
    // Readout shows the tender distance alongside land + sea.
    expect(container.querySelector('[data-testid="atlas-travel-readout"]')?.textContent).toContain('0.3 mi tender');
  });

  // The 3D HUD "Cell Map" button sets a one-shot module signal, then opens this
  // map. AtlasSvgView consumes it on mount and centers on the player marker —
  // proven here without a full game world (the dev-start flows that lack a
  // player marker leave the live build unverifiable, so the contract is pinned
  // by a unit test instead).
  describe('map-center-on-player signal (3D HUD "Cell Map")', () => {
    // The player marker is drawn in SCREEN space at translate(markerX*k+viewX, …),
    // so a centered map puts it at the exact viewport middle (width/2, height/2),
    // independent of the zoom level chosen.
    const markerScreenPos = (container: HTMLElement) => {
      const el = container.querySelector('[data-testid="atlas-player-marker"]');
      const m = /translate\(([-\d.]+),\s*([-\d.]+)\)/.exec(el?.getAttribute('transform') ?? '');
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
    };

    beforeEach(() => { consumeMapCenterOnPlayer(); }); // clear any stray request

    it('without the signal, the map opens at fit-view (marker NOT centered)', () => {
      const { container } = render(
        <AtlasSvgView atlas={stub} width={300} height={300} marker={{ x: 7, y: 7 }} />,
      );
      const p = markerScreenPos(container)!;
      expect(p).not.toBeNull();
      expect(Math.hypot(p.x - 150, p.y - 150)).toBeGreaterThan(20); // off-center at fit
    });

    it('with the signal set before open, the player cell is centered in the viewport', () => {
      requestMapCenterOnPlayer();
      const { container } = render(
        <AtlasSvgView atlas={stub} width={300} height={300} marker={{ x: 7, y: 7 }} />,
      );
      const p = markerScreenPos(container)!;
      expect(p.x).toBeCloseTo(150, 0); // viewport center x
      expect(p.y).toBeCloseTo(150, 0); // viewport center y
    });

    it('consumes the request once: a second open (no new request) is fit-view again', () => {
      requestMapCenterOnPlayer();
      const first = render(
        <AtlasSvgView atlas={stub} width={300} height={300} marker={{ x: 7, y: 7 }} />,
      );
      expect(markerScreenPos(first.container)!.x).toBeCloseTo(150, 0);
      first.unmount();

      const second = render(
        <AtlasSvgView atlas={stub} width={300} height={300} marker={{ x: 7, y: 7 }} />,
      );
      const p = markerScreenPos(second.container)!;
      expect(Math.hypot(p.x - 150, p.y - 150)).toBeGreaterThan(20); // one-shot consumed
    });

    it('with the signal but no marker, it no-ops (no crash, fit-view)', () => {
      requestMapCenterOnPlayer();
      const { container } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
      // No marker → centerOnPlayer guards out; the map still renders.
      expect(container.querySelector('[data-testid="atlas-svg-view"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="atlas-player-marker"]')).toBeNull();
    });
  });
});
