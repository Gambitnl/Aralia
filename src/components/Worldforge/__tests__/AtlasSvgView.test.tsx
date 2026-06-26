import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import AtlasSvgView from '../AtlasSvgView';
import type { MultiModalRoute } from '../../../systems/travel/multiModalRoute';

// Layer prefs persist to localStorage (real behavior); clear between tests so
// one test's coloring choice doesn't leak into the next.
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

const stub = {
  graphWidth: 100, graphHeight: 100,
  biomesData: { color: ['#000', '#11aa33'] },
  pack: { vertices: { p: [[0,0],[10,0],[10,10],[0,10]] },
          cells: { h: [5, 50], v: [[0,1,2], [0,1,2,3]], biome: [0, 1], p: [[2,2],[7,7]] } },
} as any;

describe('AtlasSvgView', () => {
  it('renders an <svg> with one merged land-region path (T2: no per-cell polygons)', () => {
    const { container } = render(<AtlasSvgView atlas={stub} width={300} height={300} />);
    expect(container.querySelector('svg')).toBeTruthy();
    const paths = container.querySelectorAll('path');
    // 1 merged biome region (filled) + 2 coastline strokes (shelf glow + crisp, T3)
    expect(paths).toHaveLength(3);
    expect(paths[0].getAttribute('fill')).toBe('#11aa33');           // biome region
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

  it('shows a Find Me button only when a player marker is given, and clicking it surfaces the player cell', () => {
    const { container, queryByTestId, getByTestId, rerender } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    expect(queryByTestId('atlas-center-player')).toBeNull(); // no marker → no button

    rerender(<AtlasSvgView atlas={stub} width={300} height={300} marker={{ x: 5, y: 5 }} />);
    const findMe = getByTestId('atlas-center-player');
    expect(findMe).toBeTruthy();
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

  it('a pan gesture (drag) suppresses the travel-click — onPickCell is not fired', () => {
    let picks = 0;
    const { getByTestId } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} onPickCell={() => { picks += 1; }} />,
    );
    const svg = getByTestId('atlas-svg-view');
    // Grab → move beyond the slop → release → click: this is a pan, not a pick.
    fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(svg, { clientX: 140, clientY: 130 });
    fireEvent.mouseUp(svg);
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
    fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(svg, { clientX: 140, clientY: 130 });
    fireEvent.mouseUp(svg);
    expect(() => fireEvent.mouseMove(svg, { clientX: 180, clientY: 160 })).not.toThrow();
    // Component survives (no error boundary swap): the atlas svg is still mounted.
    expect(container.querySelector('[data-testid="atlas-svg-view"]')).toBeTruthy();
  });

  it('menu exposes a Map coloring section + an Info panel detail selector', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    expect(queryByTestId('atlas-info-verbosity')).toBeNull(); // panel closed initially
    fireEvent.click(getByTestId('atlas-layers-toggle'));
    expect(getByText('Map coloring')).toBeTruthy();
    expect(getByText('Info panel')).toBeTruthy();
    const select = getByTestId('atlas-info-verbosity') as HTMLSelectElement;
    expect(select.value).toBe('standard');
    fireEvent.change(select, { target: { value: 'full' } });
    expect(select.value).toBe('full');
  });

  it('map coloring is an exclusive radio: picking "None" replaces biomes with the neutral land base', () => {
    const { container, getByTestId, getByLabelText } = render(
      <AtlasSvgView atlas={stub} width={300} height={300} />,
    );
    const hasFill = (f: string) =>
      Array.from(container.querySelectorAll('path')).some((p) => p.getAttribute('fill') === f);
    expect(hasFill('#11aa33')).toBe(true);  // biome region shown by default
    expect(hasFill('#d9d2bd')).toBe(false); // no neutral base while biomes is the coloring

    fireEvent.click(getByTestId('atlas-layers-toggle'));    // open the panel
    fireEvent.click(getByLabelText('None (plain land)'));   // exclusive: deselects Biomes

    expect(hasFill('#11aa33')).toBe(false); // biome region gone
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
    fireEvent.mouseMove(svg, { clientX: 150, clientY: 150 });

    expect(container.querySelectorAll('[data-testid="atlas-travel-segment-land"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="atlas-travel-segment-sea"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="atlas-harbor-marker"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="atlas-travel-readout"]')?.textContent).toContain('2.0 mi land');
    expect(container.querySelector('[data-testid="atlas-travel-readout"]')?.textContent).toContain('2.0 mi sea');
  });
});
