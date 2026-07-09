/**
 * @file interiorPlacement.ts — the shared site-local → scene transform.
 *
 * A building's interior data (hearth parts, occupant stations) is authored in a
 * site-LOCAL frame. Three places must turn that local frame into scene space:
 *
 *   1. InteriorLights projects each hearth part to a point-light position.
 *   2. InteriorOccupants places each live figure at its hourly station.
 *   3. SiteBuilding (World3DScene) renders each part as a child of the building
 *      group and lets three.js apply the same yaw + translate.
 *
 * Every copy of that math used to be hand-rolled and kept in sync only by
 * comments — a drift seam. This module holds the transform ONCE so the light
 * layer and the figure layer can never disagree with what SiteBuilding renders.
 *
 * The rotation/flip convention is pinned to the current render: the local z is
 * flipped by `-doorZSign` (street face), then the (x, z) pair is rotated CCW
 * about +Y by the group yaw and translated by the group origin. Yaw never
 * touches the y axis. See `sitePartTransform.ts` for the y-inclusive part
 * variant; this module is the 2D (x, z) source both share.
 */

/** Plan-feet → meters. */
const FT = 0.3048;

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
export function siteLocalToScene(
  localX: number,
  localZ: number,
  s: SitePlacement,
): { x: number; z: number } {
  const cos = Math.cos(s.rotationY);
  const sin = Math.sin(s.rotationY);
  const lx = localX;
  const lz = localZ * -s.doorZSign;
  return { x: s.gx + (lx * cos + lz * sin), z: s.gz + (-lx * sin + lz * cos) };
}

/**
 * Plan feet (blueprint frame, 0 = min corner) → site-local meters, centered.
 * `widthFt`/`depthFt` are the interior envelope in feet. Plan 0..widthFt maps to
 * -w/2..+w/2 (frontage +x), and 0..depthFt to depth +z inward — the same
 * centering SiteBuilding uses for its parts.
 */
export function planFeetToSiteLocal(
  xFt: number,
  yFt: number,
  widthFt: number,
  depthFt: number,
): { x: number; z: number } {
  return { x: (xFt - widthFt / 2) * FT, z: (yFt - depthFt / 2) * FT };
}
