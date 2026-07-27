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
 * The container (World3DWrapper) wires `onMoveTo` to dispatch the SAME
 * `SET_PLAYER_GROUND_POS` action the 3D camera walk dispatches (converting feet →
 * meters via the bridge and stamping the active `tileX/tileY`). So both views
 * write one action; the reducer is the single sync point and the two views stay
 * consistent. This pane is PURELY presentational — it knows nothing about the
 * store, only feet and pixels.
 *
 * It is ADDITIVE: it does NOT replace the compass, the drill views, or
 * `subMapCoordinates`. It introduces no cell↔tile mapping and never calls the
 * Stage-1 protected functions — it works entirely in Locale-local feet via the
 * `localePosition` bridge.
 *
 * GRID-RETIRE: BA-3 — this pane is the 2D consumer/producer of the continuous
 * Locale-feet movement state that resolves the Stage-2 "submap sub-tile" band-aid.
 */
import React from 'react';
export interface LocaleMovePaneProps {
    /** The active ground world's cell dimensions (Locale spans cols×5 ft by rows×5 ft). */
    localeExtent: {
        cols: number;
        rows: number;
    };
    /**
     * The live shared movement state (tile-local meters), or null when no ground
     * session has reported a position yet (honest "unknown" — no marker drawn).
     */
    groundPos: {
        xM: number;
        zM: number;
    } | null;
    /**
     * Click-to-move: invoked with the clicked Locale position in feet (clamped to
     * the extent). The container converts feet → meters and dispatches the shared
     * SET_PLAYER_GROUND_POS action.
     */
    onMoveTo: (feetX: number, feetY: number) => void;
}
/**
 * A compact, pure 2D Locale map with click-to-move. Fits the Locale (in feet)
 * into a fixed pixel surface with a uniform scale; the player marker and clicks
 * convert between the two via that single fit factor.
 */
declare const LocaleMovePane: React.FC<LocaleMovePaneProps>;
export default LocaleMovePane;
