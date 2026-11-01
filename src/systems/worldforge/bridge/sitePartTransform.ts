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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/11/2026, 17:09:18
 * Dependents: components/World3D/BuildingDoor.tsx, components/World3D/FurnishingFocusMarker.tsx, components/World3D/InteriorOccupants.tsx, components/World3D/NearbyBuildingDoor.tsx, components/World3D/NearbyFurnishing.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/buildingExteriorGeometry.ts, components/World3D/doorBodyClearance.ts, components/World3D/groundBuildingMotion.ts, components/World3D/groundDoorInteraction.ts, components/World3D/groundFurnishingInteraction.ts, components/World3D/groundResidentInteraction.ts, components/World3D/initialTownEntry.ts, components/World3D/publicBuildingDiscovery.ts, components/World3D/residentDoorUse.ts, systems/world3d/siteBoxBatches.ts, systems/world3d/siteGeometry.ts, systems/worldforge/bridge/buildingEntryApproach.ts, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/interiorParts.ts, systems/worldforge/bridge/residentDoorRoutes.ts, systems/worldforge/interior/guestCirculation.ts, systems/worldforge/interior/householdLayoutReferences.ts, systems/worldforge/props/exteriorPropRevision.ts, systems/worldforge/props/freshPropClearance.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SitePart } from './interiorParts';

/** Geometry belongs to the saved identity, so a rebuilt, relocated entry never
 * inherits another door's state just because its array index happens to match. */
export function siteDoorId(level: number, index: number, axis: 'x' | 'y', x: number, z: number): string {
  return `${level}:${index}:${axis}:${x.toFixed(4)}:${z.toFixed(4)}`;
}

export function siteDoorKey(siteId: string, part: Pick<SitePart, 'door'>): string {
  return `${siteId}/${part.door?.id ?? ''}`;
}

/** Swing about the negative end of the canonical wall edge into openDir.
 * The returned box is the exact open-leaf footprint used by movement. */
export function doorPartForState(part: SitePart, open: boolean): SitePart {
  if (!open || !part.door) return part;
  return { ...part,
    x: part.door.axis === 'x' ? part.x - part.w / 2 : part.x + part.door.swingX * part.d / 2,
    z: part.door.axis === 'x' ? part.z + part.door.swingZ * part.w / 2 : part.z - part.d / 2,
    w: part.d, d: part.w,
  };
}

/** The render leaf keeps its original box dimensions, turned about its hinge.
 * Its bounds equal doorPartForState's axis-aligned box in this site frame. */
export function siteDoorLocalPose(part: SitePart, doorZSign: number, open: boolean) {
  const offset = sitePartLocalOffset(doorPartForState(part, open), doorZSign);
  const rotationY = !open || !part.door ? 0 : (part.door.axis === 'x' ? part.door.swingZ * doorZSign : -part.door.swingX * doorZSign) * Math.PI / 2;
  return { offset, rotationY };
}

/** Intermediate hinge poses for clearance queries. The renderer's existing
 * boolean endpoints stay exact; no animation or saved state changes here. */
export function siteDoorLocalPoseAtFraction(part:SitePart,doorZSign:number,fraction:number){
  if(!Number.isFinite(fraction)||fraction<0||fraction>1)throw new Error('Door swing fraction must be between zero and one.');
  if(fraction===0||fraction===1||!part.door)return siteDoorLocalPose(part,doorZSign,fraction===1);
  const angle=fraction*Math.PI/2,axisX=part.door.axis==='x',length=axisX?part.w:part.d;
  const x=axisX?part.x-length/2+length/2*Math.cos(angle):part.x+part.door.swingX*length/2*Math.sin(angle);
  const z=axisX?part.z+part.door.swingZ*length/2*Math.sin(angle):part.z-length/2+length/2*Math.cos(angle);
  return {offset:{x,y:(part.baseY??0)+part.h/2,z:z*-doorZSign},
    rotationY:(axisX?part.door.swingZ*doorZSign:-part.door.swingX*doorZSign)*angle};
}

/** The minimal part fields the transform reads. */
type PartOffsetInput = Pick<SitePart, 'x' | 'z' | 'h' | 'baseY'>;

/**
 * The shared visibility rule used by both production renderers.
 * Tactical-only walls stay in streamed data for combat extraction but must
 * never become a visible WebGL or WebGPU mesh.
 */
export function isSitePartRenderable(
  part: Pick<SitePart, 'renderRole'>,
): boolean {
  return part.renderRole !== 'tactical-only';
}

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

/** A 2D corner of a building plot quad (ground meters or scene-local meters). */
type QuadCorner = { x: number; z: number };

/**
 * Derive a building's yaw + street-face sign from its 4-corner plot quad. This
 * is the ONE definition of that convention: the frontage edge is c1 - c0, and
 * c3 - c0 is the depth edge; three.js yaws CCW about +Y so the yaw negates the
 * frontage-edge angle, and the cross product's sign picks which local-z face the
 * street sits on (the door goes on the opposite face).
 *
 * The result is invariant under uniform scale + translation, so it returns the
 * SAME orientation whether the quad is in plan feet, ground meters, or
 * scene-local meters — that is why the render path (siteGeometry) and the
 * walkability path (groundChunkLoader) can both call it despite living in
 * different frames. `siteGeometry` sets `site.rotationY` / `site.doorZSign` from
 * this, so nothing may re-derive the convention by hand.
 */
export function siteOrientationFromQuad(
  corners: ReadonlyArray<QuadCorner>,
): { rotationY: number; doorZSign: number } {
  const e1x = corners[1].x - corners[0].x;
  const e1z = corners[1].z - corners[0].z;
  const e2x = corners[3].x - corners[0].x;
  const e2z = corners[3].z - corners[0].z;
  const rotationY = -Math.atan2(e1z, e1x);
  const cross = e1x * e2z - e1z * e2x;
  const doorZSign = cross >= 0 ? -1 : 1;
  return { rotationY, doorZSign };
}

/**
 * Inverse of the group yaw: turn a world/ground displacement measured FROM the
 * group origin back into the building's render-local (x, z) frame. This is the
 * exact inverse of the rotation `sitePartScenePosition` applies, so the returned
 * `z` is directly comparable to `sitePartLocalOffset(part, doorZSign).z` — i.e.
 * it already carries the `-doorZSign` flip the renderer used. The walkability
 * grid uses this to decide which floor cells a part covers, and it must land the
 * part on the SAME cells the renderer draws it on.
 */
export function worldOffsetToSiteLocal(
  dx: number,
  dz: number,
  rotationY: number,
): { lx: number; lz: number } {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  // Inverse of the three.js CCW yaw above (rotate by +rotationY):
  // (dx, dz) -> (dx·cos - dz·sin, dx·sin + dz·cos).
  return { lx: dx * cos - dz * sin, lz: dx * sin + dz * cos };
}
