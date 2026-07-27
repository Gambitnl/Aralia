/**
 * @file localeWindow.ts — the 3000ft Locale-window tiling for open-region streaming.
 *
 * Stage 5 / S5.4: seamless walking streams the world as a grid of fixed 3000ft
 * Locale WINDOWS (open-region decision 4: "reuse the existing 3,000-ft locale as
 * the tile; prefetch the neighbour as the player nears an edge"). A Voronoi cell
 * is far larger than a window, so windows — not cells — are the streaming unit;
 * `playerCell.cellId` is re-derived from the world position as it crosses cells.
 *
 * Because terrain is a pure function of world position (proven seamless across
 * windows, S5.2), any global tiling is continuous — so we tile on a simple global
 * 3000ft grid anchored at the world origin. Pure, deterministic, grid-free.
 */
/** A Locale window is 3000ft per side (600 cells × 5ft) — matches LOCAL_SIZE_FT. */
export declare const WINDOW_FT = 3000;
export interface LocaleWindow {
    /** Window grid column / row (floor of world feet / WINDOW_FT; may be negative). */
    col: number;
    row: number;
    /** North-west corner of the window in world feet. */
    originFt: {
        x: number;
        y: number;
    };
    /** Window centre in world feet (what generateLocal is centred on). */
    centerFt: {
        x: number;
        y: number;
    };
    /** The asked position expressed as feet within the window ([0, WINDOW_FT)). */
    localFeet: {
        x: number;
        y: number;
    };
}
/** North-west corner (world feet) of window (col,row). */
export declare function windowOrigin(col: number, row: number): {
    x: number;
    y: number;
};
/** Stable cache/identity key for a window. */
export declare function windowKey(col: number, row: number): string;
/** The Locale window a world-feet position falls in, plus its in-window offset. */
export declare function windowForWorldPos(fx: number, fy: number): LocaleWindow;
