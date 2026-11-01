/**
 * @file LocaleMovePane.tsx — the 2D Locale view + click-to-move (cell-native
 * world, Stage 3).
 *
 * Stage 3 ("Locale movement") makes the 2D Locale view and the 3D ground view
 * TWO SYNCED VIEWS of ONE movement state. That state is `GameState.playerGroundPos`
 * (tile-local meters), mirrored into `playerCell.localeCoords` as Locale feet by
 * the worldReducer. This pane is the 2D half:
 *
 *  - it draws a footprint rectangle sized to the current Locale's extent in feet
 *    (`cols × 5 ft` by `rows × 5 ft`, read from the active ground world),
 *  - it draws a player marker at `groundPosToLocaleFeet(playerGroundPos)`,
 *  - a click maps screen px → Locale feet (inverse of the fit transform), clamps
 *    to the extent, and calls `onMoveTo(feetX, feetY)`.
 *
 * The container (World3DWrapper) forwards `onMoveTo` to the same walking intent
 * as a 3D ground click. Actual admitted footfalls update the shared position;
 * this map cannot place the body through a wall, steep slope or unsafe water.
 * Pointer release preserves fractional screen coordinates because a rounded
 * click can miss by several feet at this overview scale. The pane knows only
 * feet and pixels, not terrain admission or the game store.
 *
 * It is ADDITIVE: it does NOT replace the compass, the drill views, or
 * `subMapCoordinates`. It introduces no cell↔tile mapping and never calls the
 * Stage-1 protected functions — it works entirely in Locale-local feet via the
 * `localePosition` bridge.
 *
 * GRID-RETIRE: BA-3 — this pane is the 2D consumer/producer of the continuous
 * Locale-feet movement state that resolves the Stage-2 "submap sub-tile" band-aid.
 */
import React, { useCallback, useMemo, useRef } from 'react';
import {
  LOCALE_CELL_FT,
  groundPosToLocaleFeet,
  clampLocaleFeet,
} from '../../systems/worldforge/local/localePosition';

/** Intrinsic pixel size of the pane's clickable surface (the fit target). */
const PANE_PX_W = 240;
const PANE_PX_H = 160;

export interface LocaleMovePaneProps {
  /** The active ground world's cell dimensions (Locale spans cols×5 ft by rows×5 ft). */
  localeExtent: { cols: number; rows: number };
  /**
   * The live shared movement state (tile-local meters), or null when no ground
   * session has reported a position yet (honest "unknown" — no marker drawn).
   */
  groundPos: { xM: number; zM: number } | null;
  /**
   * Click-to-move: invoked with the clicked Locale position in feet (clamped to
   * the extent). The container converts feet → meters and requests an ordinary
   * walk; actual reached feet, rather than this destination, are saved.
   */
  onMoveTo: (feetX: number, feetY: number) => void;
}

/**
 * A compact, pure 2D Locale map with click-to-move. Fits the Locale (in feet)
 * into a fixed pixel surface with a uniform scale; the player marker and clicks
 * convert between the two via that single fit factor.
 */
const LocaleMovePane: React.FC<LocaleMovePaneProps> = ({ localeExtent, groundPos, onMoveTo }) => {
  const extentFtX = localeExtent.cols * LOCALE_CELL_FT;
  const extentFtY = localeExtent.rows * LOCALE_CELL_FT;

  // Uniform fit: one ft → `fit` px on both axes (so the Locale is not distorted),
  // letterboxed inside the fixed pane. Guards against a degenerate zero extent.
  const fit = useMemo(() => {
    if (extentFtX <= 0 || extentFtY <= 0) return 1;
    return Math.min(PANE_PX_W / extentFtX, PANE_PX_H / extentFtY);
  }, [extentFtX, extentFtY]);

  // Centre the letterboxed Locale in the pane.
  const drawnW = extentFtX * fit;
  const drawnH = extentFtY * fit;
  const offsetX = (PANE_PX_W - drawnW) / 2;
  const offsetY = (PANE_PX_H - drawnH) / 2;

  const markerFeet = groundPos ? groundPosToLocaleFeet(groundPos) : null;
  const pointerRelease = useRef<{ clientX: number; clientY: number } | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      // Chromium's click rounds to whole CSS pixels, while pointerup retains
      // fractions. Use that release once for its pointer click. Click-only
      // callers keep the existing conversion and never inherit an old release.
      const point = e.detail > 0 && pointerRelease.current ? pointerRelease.current : e;
      pointerRelease.current = null;
      // The surface may be rendered at a different CSS size than its intrinsic
      // pixel box; normalise the click into intrinsic-px space first.
      const pxX = ((point.clientX - rect.left) / rect.width) * PANE_PX_W;
      const pxY = ((point.clientY - rect.top) / rect.height) * PANE_PX_H;
      // Inverse fit transform: px → Locale feet, then clamp to the extent.
      const rawFeet = {
        x: (pxX - offsetX) / fit,
        y: (pxY - offsetY) / fit,
      };
      const feet = clampLocaleFeet(rawFeet, localeExtent);
      onMoveTo(feet.x, feet.y);
    },
    [fit, offsetX, offsetY, localeExtent, onMoveTo],
  );

  const markerPx = markerFeet
    ? { cx: offsetX + markerFeet.x * fit, cy: offsetY + markerFeet.y * fit }
    : null;

  return (
    <div
      style={{
        background: 'var(--bg-surface-alt, rgba(20, 30, 42, 0.92))',
        border: '1px solid var(--border-color, #3a4a5a)',
        borderRadius: '8px',
        padding: '8px',
        width: 'fit-content',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      <div
        style={{
          color: 'var(--text-secondary, #8a9aaa)',
          fontSize: '11px',
          marginBottom: '4px',
          letterSpacing: '0.04em',
        }}
      >
        LOCALE MAP — click to move
      </div>
      <svg
        data-testid="locale-move-surface"
        data-px-w={PANE_PX_W}
        data-px-h={PANE_PX_H}
        width={PANE_PX_W}
        height={PANE_PX_H}
        viewBox={`0 0 ${PANE_PX_W} ${PANE_PX_H}`}
        onPointerDown={() => { pointerRelease.current = null; }}
        onPointerUp={event => {
          if (event.button === 0 && event.isPrimary !== false) {
            pointerRelease.current = { clientX: event.clientX, clientY: event.clientY };
          }
        }}
        onPointerCancel={() => { pointerRelease.current = null; }}
        onClick={handleClick}
        style={{ display: 'block', cursor: 'crosshair' }}
        role="img"
        aria-label="Locale movement map"
      >
        {/* Locale footprint — sized to the extent in feet. */}
        <rect
          data-testid="locale-footprint"
          data-extent-ft-x={extentFtX}
          data-extent-ft-y={extentFtY}
          x={offsetX}
          y={offsetY}
          width={drawnW}
          height={drawnH}
          fill="var(--bg-surface, #16212e)"
          stroke="var(--border-color, #3a4a5a)"
          strokeWidth={1}
          rx={2}
        />
        {markerPx && markerFeet ? (
          <circle
            data-testid="locale-player-marker"
            data-feet-x={markerFeet.x}
            data-feet-y={markerFeet.y}
            cx={markerPx.cx}
            cy={markerPx.cy}
            r={4}
            fill="var(--accent-gold, #e8c36a)"
            stroke="var(--bg-surface, #16212e)"
            strokeWidth={1}
          />
        ) : null}
      </svg>
    </div>
  );
};

export default LocaleMovePane;
