/**
 * @file sitePartTransform.ts — the single source for placing a site part.
 *
 * A building's `SitePart`s are authored in a local frame (+z = inward from the
 * street). Two places need to turn that local frame into world/scene space:
 *
 *   1. SiteBuilding (World3DScene.tsx) renders each part as a child mesh and
 *      lets three.js apply the building group's yaw + translate.
 *   2. InteriorLights projects the hearth part to a point-light position by
 *      hand, because the light is NOT a child of the building group.
 *
 * Both used to carry their own copy of the doorZSign z-flip and the y offset,
 * kept in sync only by comments. This module holds that math once so they can't
 * drift. `InteriorLights.test.ts` pins the scene projection against a real
 * THREE.Group to prove it still matches what SiteBuilding renders.
 */
import type { SitePart } from './interiorParts';

/** The minimal part fields the transform reads. */
type PartOffsetInput = Pick<SitePart, 'x' | 'z' | 'h' | 'baseY'>;

/** The building group transform SiteBuilding applies (scene meters + radians). */
export interface SiteGroupTransform {
  /** Group origin X in scene meters (chunk origin + site.localX, already summed). */
  groupX: number;
  /** Group origin Z in scene meters (chunk origin + site.localZ, already summed). */
  groupZ: number;
  /** Ground surface Y the building group sits on (site.surfaceY). */
  surfaceY: number;
  /** Group yaw about +Y in radians (site.rotationY). */
  rotationY: number;
  /** Street-face sign that flips the part's +z inward axis (site.doorZSign). */
  doorZSign: number;
}

/**
 * The LOCAL position SiteBuilding assigns to a part mesh, before the building
 * group's yaw + translate. Mirrors the mesh position in World3DScene.tsx:
 *   position={[p.x, (p.baseY ?? 0) + p.h * 0.5, p.z * -doorZSign]}
 * The part center sits half its height above its base.
 */
export function sitePartLocalOffset(
  part: PartOffsetInput,
  doorZSign: number,
): { x: number; y: number; z: number } {
  return {
    x: part.x,
    y: (part.baseY ?? 0) + part.h * 0.5,
    z: part.z * -doorZSign,
  };
}

/**
 * Project a part's local offset into SCENE space, applying the same transform
 * three.js applies to SiteBuilding's group: rotate the local offset by the yaw
 * about +Y, then translate by the group origin. Yaw does not touch the y axis.
 *
 * Keep this the ONLY hand-rolled copy of the group transform; it is pinned to
 * the real render in InteriorLights.test.ts.
 */
export function sitePartScenePosition(
  part: PartOffsetInput,
  t: SiteGroupTransform,
): { x: number; y: number; z: number } {
  const local = sitePartLocalOffset(part, t.doorZSign);
  const cos = Math.cos(t.rotationY);
  const sin = Math.sin(t.rotationY);
  // three.js rotates CCW about +Y: (x, z) -> (x·cos + z·sin, -x·sin + z·cos).
  const rx = local.x * cos + local.z * sin;
  const rz = -local.x * sin + local.z * cos;
  return {
    x: t.groupX + rx,
    y: t.surfaceY + local.y,
    z: t.groupZ + rz,
  };
}
