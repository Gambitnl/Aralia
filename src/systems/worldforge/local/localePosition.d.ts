/** One Locale (ground) cell is 5 ft — mirrors GROUND_METERS_PER_CELL (1.524 m). */
export declare const LOCALE_CELL_FT = 5;
/**
 * Tile-local ground meters (`playerGroundPos.{xM,zM}`) → Locale-local feet
 * `{x,y}`. The 3D Z axis maps to the 2D/Locale Y axis (same convention as
 * `PlayerWorldPosition.z` → 2D atlas Y). Pure + exact.
 */
export declare function groundPosToLocaleFeet(pos: {
    xM: number;
    zM: number;
}): {
    x: number;
    y: number;
};
/**
 * Locale-local feet `{x,y}` → tile-local ground meters `{xM,zM}` (for a 3D spawn
 * / camera move). Inverse of `groundPosToLocaleFeet`. Pure + exact.
 */
export declare function localeFeetToGroundMeters(feet: {
    x: number;
    y: number;
}): {
    xM: number;
    zM: number;
};
/**
 * Clamp a Locale-feet position to a ground world's extent. The Locale spans
 * `cols × LOCALE_CELL_FT` feet east and `rows × LOCALE_CELL_FT` feet south.
 */
export declare function clampLocaleFeet(feet: {
    x: number;
    y: number;
}, extent: {
    cols: number;
    rows: number;
}): {
    x: number;
    y: number;
};
