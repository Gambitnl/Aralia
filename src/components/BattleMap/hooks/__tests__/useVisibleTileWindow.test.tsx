import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useVisibleTileWindow, type TileWindowState } from '../useVisibleTileWindow';

/**
 * The 2D grid renders one DOM element per tile. Viewport culling keeps that
 * count down to what the scroll container can show.
 *
 * These tests protect the two invariants the culling rests on:
 *  1. The measured window covers the whole visible band, plus a margin.
 *  2. When there is no layout to measure, the hook reports `unmeasurable`
 *     instead of guessing a window, and the caller then renders every tile.
 */

const TILE = 32;
const WIDTH = 120;
const HEIGHT = 90;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const asDomRect = (r: Rect) =>
  ({
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    right: r.left + r.width,
    bottom: r.top + r.height,
    x: r.left,
    y: r.top,
    toJSON: () => r,
  }) as DOMRect;

/**
 * Drive the hook with fixed rectangles instead of real layout. jsdom gives
 * every element a zero-size rectangle, so a measured window can only be tested
 * by supplying the geometry directly.
 */
function renderWithRects(gridRect: Rect | null, wrapRect: Rect) {
  const states: TileWindowState[] = [];

  const Probe: React.FC = () => {
    const gridRef = React.useRef<HTMLDivElement>(null);
    const wrapRef = React.useRef<HTMLDivElement>(null);

    const state = useVisibleTileWindow({
      wrapRef,
      gridRef,
      width: WIDTH,
      height: HEIGHT,
      tileSize: TILE,
      boardScale: 1,
    });
    states.push(state);

    // Callback refs run during commit, before layout effects, so the stub
    // rectangles are in place by the time the hook measures.
    const attach = (
      ref: React.RefObject<HTMLDivElement | null>,
      rect: Rect | null,
    ) => (node: HTMLDivElement | null) => {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (node && rect) {
        node.getBoundingClientRect = () => asDomRect(rect);
      }
    };

    return (
      <div ref={attach(wrapRef, wrapRect)} data-testid="wrap">
        <div ref={attach(gridRef, gridRect)} data-testid="grid" />
      </div>
    );
  };

  const utils = render(<Probe />);
  return { states, last: states[states.length - 1], ...utils };
}

/** The grid's own border sits outside the tile area. */
const GRID_BORDER = 1;
const gridRectFor = (left: number, top: number): Rect => ({
  left,
  top,
  width: WIDTH * TILE + GRID_BORDER * 2,
  height: HEIGHT * TILE + GRID_BORDER * 2,
});

describe('useVisibleTileWindow', () => {
  it('reports unmeasurable when the grid has no layout, so the caller draws every tile', () => {
    // jsdom gives real zero-size rectangles. No stub, no measurement.
    const { last } = renderWithRects(null, { left: 0, top: 0, width: 0, height: 0 });
    expect(last.status).toBe('unmeasurable');
  });

  it('covers the visible band when the board sits at its origin', () => {
    // A 1600x1000 viewport over an unscrolled board shows columns 0..49 and
    // rows 0..31.
    const { last } = renderWithRects(gridRectFor(0, 0), {
      left: 0,
      top: 0,
      width: 1600,
      height: 1000,
    });
    expect(last.status).toBe('measured');
    if (last.status !== 'measured') return;
    expect(last.window.minX).toBe(0);
    expect(last.window.minY).toBe(0);
    // The window must reach past the last visible column and row.
    expect(last.window.maxX).toBeGreaterThanOrEqual(Math.ceil(1600 / TILE) - 1);
    expect(last.window.maxY).toBeGreaterThanOrEqual(Math.ceil(1000 / TILE) - 1);
  });

  it('follows a scrolled board and still covers the whole visible band', () => {
    // Scrolled right 1600px and down 1200px: the grid's own rectangle moves
    // negative relative to the viewport.
    const scrollLeft = 1600;
    const scrollTop = 1200;
    const { last } = renderWithRects(gridRectFor(-scrollLeft, -scrollTop), {
      left: 0,
      top: 0,
      width: 1600,
      height: 1000,
    });
    expect(last.status).toBe('measured');
    if (last.status !== 'measured') return;

    const firstVisibleCol = Math.floor(scrollLeft / TILE);
    const lastVisibleCol = Math.ceil((scrollLeft + 1600) / TILE) - 1;
    const firstVisibleRow = Math.floor(scrollTop / TILE);
    const lastVisibleRow = Math.ceil((scrollTop + 1000) / TILE) - 1;

    expect(last.window.minX).toBeLessThanOrEqual(firstVisibleCol);
    expect(last.window.maxX).toBeGreaterThanOrEqual(lastVisibleCol);
    expect(last.window.minY).toBeLessThanOrEqual(firstVisibleRow);
    expect(last.window.maxY).toBeGreaterThanOrEqual(lastVisibleRow);
  });

  it('clamps to the board instead of running past its last row and column', () => {
    // Scrolled hard into the bottom-right corner.
    const scrollLeft = WIDTH * TILE - 1600;
    const scrollTop = HEIGHT * TILE - 1000;
    const { last } = renderWithRects(gridRectFor(-scrollLeft, -scrollTop), {
      left: 0,
      top: 0,
      width: 1600,
      height: 1000,
    });
    expect(last.status).toBe('measured');
    if (last.status !== 'measured') return;
    expect(last.window.maxX).toBe(WIDTH - 1);
    expect(last.window.maxY).toBe(HEIGHT - 1);
    expect(last.window.minX).toBeGreaterThanOrEqual(0);
    expect(last.window.minY).toBeGreaterThanOrEqual(0);
  });

  it('renders the whole board when the viewport is larger than it', () => {
    // This is the "Fit" case: nothing is off screen, so nothing is culled.
    const { last } = renderWithRects(gridRectFor(0, 0), {
      left: 0,
      top: 0,
      width: WIDTH * TILE + 200,
      height: HEIGHT * TILE + 200,
    });
    expect(last.status).toBe('measured');
    if (last.status !== 'measured') return;
    expect(last.window).toEqual({
      minX: 0,
      maxX: WIDTH - 1,
      minY: 0,
      maxY: HEIGHT - 1,
    });
  });

  it('starts pending so the first commit costs nothing', () => {
    const { states } = renderWithRects(gridRectFor(0, 0), {
      left: 0,
      top: 0,
      width: 1600,
      height: 1000,
    });
    // The first render reports pending; the layout effect measures and the
    // re-render lands before the browser paints.
    expect(states[0].status).toBe('pending');
    expect(states[states.length - 1].status).toBe('measured');
  });
});
