/** Place the existing regional atlas on a planet without inventing geography.
 * The normalized rectangle is used by the globe texture; the direction matches
 * Three's SphereGeometry UV convention so reset faces the generated region.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/10/2026, 14:37:32
 * Dependents: components/Worldforge/AtlasGlobeView.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { MapCoordinates } from '../../systems/worldforge/fmg/climate';

export function globeRegion(c: MapCoordinates | undefined) {
  if (!c || ![c.latN, c.latS, c.lonW, c.lonE].every(Number.isFinite)
    || c.latN > 90 || c.latS < -90 || c.latN <= c.latS
    || c.lonW < -180 || c.lonE > 180 || c.lonE <= c.lonW) return null;
  return {
    x: (c.lonW + 180) / 360, y: (90 - c.latN) / 180,
    width: (c.lonE - c.lonW) / 360, height: (c.latN - c.latS) / 180,
    latitude: (c.latN + c.latS) / 2, longitude: (c.lonW + c.lonE) / 2,
  };
}

export function globeDirection(latitude: number, longitude: number): [number, number, number] {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
}
