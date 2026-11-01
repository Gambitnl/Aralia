/**
 * @file LocaleMovePane.test.tsx — the 2D Locale view + click-to-move (cell-native
 * world, Stage 3). The 2D Locale view and the 3D ground view are TWO SYNCED VIEWS
 * of ONE movement state (`playerGroundPos`, mirrored to feet on `playerCell`).
 *
 * This pane is the 2D half: it renders the current Locale's extent (cols×5 ft by
 * rows×5 ft) with a player marker at `groundPosToLocaleFeet(groundPos)`, and a
 * click maps screen px → Locale feet (inverse of the fit transform), clamps to
 * extent, and invokes `onMoveTo(feetX, feetY)`. The container wires `onMoveTo` to
 * dispatch the SAME `SET_PLAYER_GROUND_POS` action the 3D view writes, so the
 * reducer is the single sync point.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LocaleMovePane from '../LocaleMovePane';
import { groundPosToLocaleFeet } from '../../../systems/worldforge/local/localePosition';

// A 100×60 cell Locale = 500 ft × 300 ft. The pane fits this into its viewBox.
const EXTENT = { cols: 100, rows: 60 } as const;

// A ground position somewhere inside the Locale (tile-local meters).
// 30.48 m = 100 ft east, 15.24 m = 50 ft south.
const GROUND_POS = { tileX: 3, tileY: 4, xM: 30.48, zM: 15.24 } as const;

describe('LocaleMovePane — 2D Locale view + click-to-move (Stage 3)', () => {
  it('renders a footprint sized to the Locale extent in feet', () => {
    render(
      <LocaleMovePane localeExtent={EXTENT} groundPos={GROUND_POS} onMoveTo={() => {}} />,
    );
    const footprint = screen.getByTestId('locale-footprint');
    // The footprint rect carries the Locale's feet dimensions for the renderer.
    expect(footprint).toHaveAttribute('data-extent-ft-x', String(EXTENT.cols * 5));
    expect(footprint).toHaveAttribute('data-extent-ft-y', String(EXTENT.rows * 5));
  });

  it('places the player marker at groundPosToLocaleFeet(groundPos)', () => {
    render(
      <LocaleMovePane localeExtent={EXTENT} groundPos={GROUND_POS} onMoveTo={() => {}} />,
    );
    const marker = screen.getByTestId('locale-player-marker');
    const feet = groundPosToLocaleFeet(GROUND_POS);
    // The marker exposes its Locale-feet position so the test is transform-agnostic.
    expect(Number(marker.getAttribute('data-feet-x'))).toBeCloseTo(feet.x, 6);
    expect(Number(marker.getAttribute('data-feet-y'))).toBeCloseTo(feet.y, 6);
    // 30.48 m → 100 ft east, 15.24 m → 50 ft south.
    expect(Number(marker.getAttribute('data-feet-x'))).toBeCloseTo(100, 6);
    expect(Number(marker.getAttribute('data-feet-y'))).toBeCloseTo(50, 6);
  });

  it('renders no player marker when groundPos is null (honest unknown)', () => {
    render(<LocaleMovePane localeExtent={EXTENT} groundPos={null} onMoveTo={() => {}} />);
    expect(screen.queryByTestId('locale-player-marker')).toBeNull();
  });

  it('click maps screen px → Locale feet (inverse fit transform), clamped to extent', () => {
    const onMoveTo = vi.fn();
    render(
      <LocaleMovePane localeExtent={EXTENT} groundPos={GROUND_POS} onMoveTo={onMoveTo} />,
    );
    const surface = screen.getByTestId('locale-move-surface') as unknown as SVGSVGElement;

    // The pane fits the Locale into a fixed pixel viewport. We make the geometry
    // deterministic by stubbing the bounding rect to a known box that matches the
    // pane's intrinsic px size, then click the CENTER — which must map to the
    // Locale's centre in feet (250, 150) regardless of the internal fit math.
    const W = Number(surface.getAttribute('data-px-w'));
    const H = Number(surface.getAttribute('data-px-h'));
    expect(W).toBeGreaterThan(0);
    expect(H).toBeGreaterThan(0);
    surface.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON() {} }) as DOMRect;

    fireEvent.click(surface, { clientX: W / 2, clientY: H / 2 });

    expect(onMoveTo).toHaveBeenCalledTimes(1);
    const [fx, fy] = onMoveTo.mock.calls[0];
    expect(fx).toBeCloseTo(EXTENT.cols * 5 / 2, 4); // 250 ft
    expect(fy).toBeCloseTo(EXTENT.rows * 5 / 2, 4); // 150 ft
  });

  it('clamps an out-of-bounds click to the Locale extent', () => {
    const onMoveTo = vi.fn();
    render(
      <LocaleMovePane localeExtent={EXTENT} groundPos={GROUND_POS} onMoveTo={onMoveTo} />,
    );
    const surface = screen.getByTestId('locale-move-surface') as unknown as SVGSVGElement;
    const W = Number(surface.getAttribute('data-px-w'));
    const H = Number(surface.getAttribute('data-px-h'));
    surface.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON() {} }) as DOMRect;

    // Click well past the bottom-right corner — must clamp to (500, 300).
    fireEvent.click(surface, { clientX: W * 3, clientY: H * 3 });

    const [fx, fy] = onMoveTo.mock.calls[0];
    expect(fx).toBeCloseTo(EXTENT.cols * 5, 4); // 500 ft
    expect(fy).toBeCloseTo(EXTENT.rows * 5, 4); // 300 ft
  });

  it('keeps fractional pointer coordinates when the following click rounds to whole pixels', () => {
    const onMoveTo = vi.fn();
    const position = { xM: 439.8759186625575, zM: 388.59424434971515 };
    render(<LocaleMovePane localeExtent={{ cols: 600, rows: 600 }} groundPos={position} onMoveTo={onMoveTo} />);
    const surface = screen.getByTestId('locale-move-surface');
    surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 240, height: 160 }) as DOMRect;
    const feet = groundPosToLocaleFeet(position);
    const x = 40 + feet.x * 160 / 3000, y = feet.y * 160 / 3000;

    // Native Chromium preserved these fractions on pointerup, then rounded
    // click coordinates and sent Bera roughly sixteen feet off her marker.
    fireEvent(surface, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: x, clientY: y }));
    fireEvent.click(surface, { detail: 1, clientX: Math.floor(x), clientY: Math.floor(y) });

    expect(onMoveTo).toHaveBeenCalledTimes(1);
    expect(onMoveTo.mock.calls[0][0]).toBeCloseTo(feet.x, 6);
    expect(onMoveTo.mock.calls[0][1]).toBeCloseTo(feet.y, 6);
  });

  it('consumes a pointer position once and retains the ordinary click fallback', () => {
    const onMoveTo = vi.fn();
    render(<LocaleMovePane localeExtent={EXTENT} groundPos={GROUND_POS} onMoveTo={onMoveTo} />);
    const surface = screen.getByTestId('locale-move-surface');
    surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 240, height: 160 }) as DOMRect;
    fireEvent(surface, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 72.25, clientY: 55.75 }));
    fireEvent.click(surface, { detail: 1, clientX: 72, clientY: 55 });
    fireEvent.click(surface, { detail: 1, clientX: 120, clientY: 80 });
    expect(onMoveTo).toHaveBeenCalledTimes(2);
    expect(onMoveTo.mock.calls[1][0]).toBeCloseTo(250, 6);
    expect(onMoveTo.mock.calls[1][1]).toBeCloseTo(150, 6);
  });

  it('does not reuse a pointer position for a cancelled gesture or a non-pointer click', () => {
    const onMoveTo = vi.fn();
    render(<LocaleMovePane localeExtent={EXTENT} groundPos={GROUND_POS} onMoveTo={onMoveTo} />);
    const surface = screen.getByTestId('locale-move-surface');
    surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 240, height: 160 }) as DOMRect;
    for (const cancel of [true, false]) {
      fireEvent(surface, new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 72.25, clientY: 55.75 }));
      if (cancel) fireEvent.pointerCancel(surface);
      fireEvent.click(surface, { detail: cancel ? 1 : 0, clientX: 120, clientY: 80 });
    }
    expect(onMoveTo).toHaveBeenCalledTimes(2);
    for (const [x, y] of onMoveTo.mock.calls) {
      expect(x).toBeCloseTo(250, 6);
      expect(y).toBeCloseTo(150, 6);
    }
  });
});
