/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 16:55:29
 * Dependents: components/World3D/InteriorLights.tsx, components/World3D/InteriorOccupants.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/** The building group placement SiteBuilding applies (scene meters + radians). */
export interface SitePlacement {
    /** Group origin X in scene meters (chunk origin + site.localX, already summed). */
    gx: number;
    /** Group origin Z in scene meters (chunk origin + site.localZ, already summed). */
    gz: number;
    /** Group yaw about +Y in radians (site.rotationY). */
    rotationY: number;
    /** Street-face sign that flips the local +z inward axis (site.doorZSign). */
    doorZSign: number;
}
/**
 * Project a site-local (x, z) meters point into scene-space (x, z). Applies the
 * doorZSign z-flip then the group yaw — the SAME transform SiteBuilding applies
 * to its group. Single source of truth for hearth lights and occupant figures.
 */
export declare function siteLocalToScene(localX: number, localZ: number, s: SitePlacement): {
    x: number;
    z: number;
};
/**
 * Plan feet (blueprint frame, 0 = min corner) → site-local meters, centered.
 * `widthFt`/`depthFt` are the interior envelope in feet. Plan 0..widthFt maps to
 * -w/2..+w/2 (frontage +x), and 0..depthFt to depth +z inward — the same
 * centering SiteBuilding uses for its parts.
 */
export declare function planFeetToSiteLocal(xFt: number, yFt: number, widthFt: number, depthFt: number, originXFt?: number, originYFt?: number): {
    x: number;
    z: number;
};
