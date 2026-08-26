/**
 * @file useVisibleTileWindow.ts
 * Viewport culling for the 2D tactical grid.
 *
 * The battle map renders one DOM element per tile. A 120x90 board is 10,800
 * tiles, which costs seconds of main-thread time and about 33,000 DOM nodes.
 * A render that long is also fragile: any default-priority state update in the
 * same React root can discard an in-progress Suspense retry render.
 *
 * This hook measures the scroll viewport and reports the rectangle of tile
 * coordinates that can actually be seen. BattleMap renders only that rectangle.
 * The grid keeps explicit row and column tracks, so the visible tiles land in
 * the same cells they occupied before and nothing shifts.
 *
 * Called by: BattleMap.tsx
 * Depends on: nothing but DOM measurement (getBoundingClientRect, scroll,
 * ResizeObserver). The painted ground and fog canvases are untouched — they
 * are single canvases, not per-tile nodes.
 */
import { useLayoutEffect, useRef, useState } from "react";

/** Inclusive tile-coordinate rectangle that the grid must render. */
export interface VisibleTileWindow {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * What the caller knows about the viewport right now.
 *
 * - `pending`: the first render, before any layout exists to measure. The grid
 *   renders no tiles. The layout effect measures and replaces this state before
 *   the browser paints, so no empty grid ever reaches the screen. This is what
 *   keeps the FIRST paint cheap instead of paying for the whole board once.
 * - `unmeasurable`: the grid has a zero-size rectangle — jsdom, or an ancestor
 *   set to display:none. There is no viewport to cull against, so the grid
 *   renders every tile.
 * - `measured`: a real rectangle. The grid renders that window only.
 */
export type TileWindowState =
  | { status: "pending" }
  | { status: "unmeasurable" }
  | { status: "measured"; window: VisibleTileWindow };

export interface UseVisibleTileWindowParams {
  /** Scroll container that clips the board. */
  wrapRef: React.RefObject<HTMLElement | null>;
  /** The `.battle-map-grid` element itself. */
  gridRef: React.RefObject<HTMLElement | null>;
  /** Board size in tiles. */
  width: number;
  height: number;
  /** Unscaled tile edge in CSS pixels. */
  tileSize: number;
  /** Board transform scale; a change forces a fresh measurement. */
  boardScale: number;
}

// Extra tiles rendered beyond each viewport edge. This covers sub-pixel
// rounding and gives a scroll a small head start before new tiles mount.
const MARGIN_TILES = 2;

// The window snaps outward to a multiple of this many tiles. Without the snap,
// every 32px of scroll would move the window by one tile and force a re-render.
// With it, the window changes once per block instead, and React.memo keeps the
// tiles that stay inside the window from re-rendering at all.
const BLOCK_TILES = 6;

/** Border width of the grid element, in unscaled CSS pixels. */
const GRID_BORDER_PX = 1;

const PENDING: TileWindowState = { status: "pending" };
const UNMEASURABLE: TileWindowState = { status: "unmeasurable" };

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const sameState = (a: TileWindowState, b: TileWindowState) => {
  if (a.status !== b.status) return false;
  if (a.status !== "measured" || b.status !== "measured") return true;
  return (
    a.window.minX === b.window.minX &&
    a.window.maxX === b.window.maxX &&
    a.window.minY === b.window.minY &&
    a.window.maxY === b.window.maxY
  );
};

/** Report the tile rectangle inside the scroll viewport, plus a margin. */
export function useVisibleTileWindow({
  wrapRef,
  gridRef,
  width,
  height,
  tileSize,
  boardScale,
}: UseVisibleTileWindowParams): TileWindowState {
  const [state, setState] = useState<TileWindowState>(PENDING);
  const frameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (width <= 0 || height <= 0) {
      setState((prev) => (prev.status === "pending" ? prev : PENDING));
      return;
    }

    const apply = (next: TileWindowState) =>
      setState((prev) => (sameState(prev, next) ? prev : next));

    const measure = () => {
      const grid = gridRef.current;
      const wrap = wrapRef.current;
      if (!grid || !wrap) return;

      const gridRect = grid.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      // No layout to read. Say so instead of guessing a window.
      if (gridRect.width <= 0 || gridRect.height <= 0) {
        apply(UNMEASURABLE);
        return;
      }

      // Read the live scale off the rectangle. This picks up the board zoom and
      // any ancestor transform without the hook having to know about either.
      const unscaledWidth = width * tileSize + GRID_BORDER_PX * 2;
      const unscaledHeight = height * tileSize + GRID_BORDER_PX * 2;
      const scaleX = gridRect.width / unscaledWidth;
      const scaleY = gridRect.height / unscaledHeight;
      if (!(scaleX > 0) || !(scaleY > 0)) {
        apply(UNMEASURABLE);
        return;
      }

      // Client-space origin of tile (0, 0), inside the grid's own border.
      const originX = gridRect.left + GRID_BORDER_PX * scaleX;
      const originY = gridRect.top + GRID_BORDER_PX * scaleY;
      const stepX = tileSize * scaleX;
      const stepY = tileSize * scaleY;

      // The visible band is the part of the grid the scroll container shows.
      const bandLeft = Math.max(wrapRect.left, gridRect.left);
      const bandRight = Math.min(wrapRect.right, gridRect.right);
      const bandTop = Math.max(wrapRect.top, gridRect.top);
      const bandBottom = Math.min(wrapRect.bottom, gridRect.bottom);

      const rawMinX = Math.floor((bandLeft - originX) / stepX) - MARGIN_TILES;
      const rawMaxX = Math.ceil((bandRight - originX) / stepX) + MARGIN_TILES;
      const rawMinY = Math.floor((bandTop - originY) / stepY) - MARGIN_TILES;
      const rawMaxY = Math.ceil((bandBottom - originY) / stepY) + MARGIN_TILES;

      apply({
        status: "measured",
        window: {
          minX: clamp(
            Math.floor(rawMinX / BLOCK_TILES) * BLOCK_TILES,
            0,
            width - 1,
          ),
          maxX: clamp(
            Math.ceil(rawMaxX / BLOCK_TILES) * BLOCK_TILES,
            0,
            width - 1,
          ),
          minY: clamp(
            Math.floor(rawMinY / BLOCK_TILES) * BLOCK_TILES,
            0,
            height - 1,
          ),
          maxY: clamp(
            Math.ceil(rawMaxY / BLOCK_TILES) * BLOCK_TILES,
            0,
            height - 1,
          ),
        },
      });
    };

    const schedule = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        measure();
      });
    };

    measure();

    const wrap = wrapRef.current;
    wrap?.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      if (wrap) observer.observe(wrap);
      if (gridRef.current) observer.observe(gridRef.current);
    }

    return () => {
      wrap?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [wrapRef, gridRef, width, height, tileSize, boardScale]);

  return state;
}
