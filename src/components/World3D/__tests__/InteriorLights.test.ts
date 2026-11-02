/**
 * @file InteriorLights.test.ts — pins the hearth-light projection to the render.
 *
 * `collectInteriorLighting` computes each hearth point light's scene position by
 * hand: it rotates the part's local offset by the site yaw and translates it to
 * the group origin. `SiteBuilding` (World3DScene.tsx) gets the same result a
 * different way — it lets three.js apply the group transform to a child mesh.
 *
 * Two hand-kept copies of one transform can silently drift. This test uses a
 * real THREE.Group tree, configured EXACTLY as SiteBuilding's scene graph, as
 * the oracle. If the hand-rolled math in collectInteriorLighting ever diverges
 * from what three.js actually renders, these assertions fail.
 *
 * COUPLING: the oracle below mirrors World3DScene.tsx. If SiteBuilding's group
 * props (position, rotation) or a part mesh's local position change, update the
 * oracle here in the same commit.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { collectInteriorLighting, scenePatchFor } from '../InteriorLights';
import { sunFloorPatch } from '@/systems/world3d/interiorDaylight';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { LoadedChunk } from '@/systems/world3d/types';

interface OracleSite {
  localX: number;
  localZ: number;
  surfaceY: number;
  rotationY: number;
  doorZSign: number;
}
interface OraclePart {
  x: number;
  z: number;
  h: number;
  baseY: number;
}

/**
 * Reproduce World3DScene.tsx's scene graph for one part and read its true world
 * position via three.js:
 *   <group position={chunkScenePos}>                                  // chunk, y=0
 *     <group position={[localX, surfaceY, localZ]} rotation={[0, rotationY, 0]}>  // SiteBuilding
 *       <mesh position={[p.x, (p.baseY ?? 0) + p.h * 0.5, p.z * -doorZSign]} />   // part
 */
function renderedPartWorldPos(
  site: OracleSite,
  chunkSceneX: number,
  chunkSceneZ: number,
  part: OraclePart,
): THREE.Vector3 {
  const chunkGroup = new THREE.Group();
  chunkGroup.position.set(chunkSceneX, 0, chunkSceneZ);
  const siteGroup = new THREE.Group();
  siteGroup.position.set(site.localX, site.surfaceY, site.localZ);
  siteGroup.rotation.set(0, site.rotationY, 0);
  const partObj = new THREE.Object3D();
  partObj.position.set(part.x, part.baseY + part.h * 0.5, part.z * -site.doorZSign);
  chunkGroup.add(siteGroup);
  siteGroup.add(partObj);
  chunkGroup.updateMatrixWorld(true);
  return partObj.getWorldPosition(new THREE.Vector3());
}

function makeChunk(cx: number, cy: number, site: OracleSite, parts: unknown[], extra: Record<string, unknown> = {}): LoadedChunk {
  return {
    cx,
    cy,
    bundle: {
      sites: [
        {
          id: 'test-site',
          localX: site.localX,
          localZ: site.localZ,
          surfaceY: site.surfaceY,
          rotationY: site.rotationY,
          doorZSign: site.doorZSign,
          wallWidthM: 6,
          wallDepthM: 4,
          boxHeight: 6,
          parts,
          ...extra,
        },
      ],
    },
  } as unknown as LoadedChunk;
}

describe('collectInteriorLighting hearth projection', () => {
  const origin: SceneOrigin = { x: 12.5, z: -7.25 };
  // A hearth part (tagged lightRole 'hearth') plus a plain wall part (ignored).
  const hearth = { x: 1.2, z: 0.8, w: 1, d: 1, h: 1.2, baseY: 0.3, colorHex: '#fff', lightRole: 'hearth' as const };
  const wall = { x: 0, z: 0, w: 1, d: 1, h: 2, baseY: 0, colorHex: '#aaa' };

  const cases: Array<{ name: string; rotationY: number; doorZSign: number }> = [
    { name: 'yaw 0, doorZSign -1', rotationY: 0, doorZSign: -1 },
    { name: 'yaw 0, doorZSign +1', rotationY: 0, doorZSign: 1 },
    { name: 'yaw 90deg, doorZSign -1', rotationY: Math.PI / 2, doorZSign: -1 },
    { name: 'yaw 45deg, doorZSign +1', rotationY: Math.PI / 4, doorZSign: 1 },
    { name: 'yaw -60deg, doorZSign -1', rotationY: -Math.PI / 3, doorZSign: -1 },
    { name: 'yaw 2.7rad, doorZSign +1', rotationY: 2.7, doorZSign: 1 },
  ];

  for (const c of cases) {
    it(`matches the three.js render transform (${c.name})`, () => {
      const site: OracleSite = {
        localX: 4.5,
        localZ: -3.25,
        surfaceY: 1.75,
        rotationY: c.rotationY,
        doorZSign: c.doorZSign,
      };
      const cx = 2;
      const cy = -1;
      const o = chunkOriginWorld(cx, cy);
      const chunkScene = worldToScene(o.x, o.y, origin);

      const expected = renderedPartWorldPos(site, chunkScene.x, chunkScene.z, hearth);
      const { hearths } = collectInteriorLighting([makeChunk(cx, cy, site, [hearth, wall])], origin);

      expect(hearths).toHaveLength(1);
      expect(hearths[0].x).toBeCloseTo(expected.x, 6);
      expect(hearths[0].y).toBeCloseTo(expected.y, 6);
      expect(hearths[0].z).toBeCloseTo(expected.z, 6);
    });
  }

  it('only parts tagged with lightRole "hearth" become lights', () => {
    const site: OracleSite = { localX: 0, localZ: 0, surfaceY: 0, rotationY: 0.5, doorZSign: -1 };
    const { hearths } = collectInteriorLighting([makeChunk(0, 0, site, [wall, wall, hearth])], origin);
    expect(hearths).toHaveLength(1);
  });
});

describe('collectInteriorLighting lit windows and lamps (night light out)', () => {
  const origin: SceneOrigin = { x: 12.5, z: -7.25 };
  // A 6 m by 4 m floor; one pane in the authored +z wall (z = 2.15); a table.
  const floor = { x: 0, z: 0, w: 6, d: 4, h: 0.1, baseY: -0.1, colorHex: '#9a8a72', walkSurface: 'floor' };
  const pane = { x: 0.5, z: 2.15, w: 1.2, d: 0.04, h: 1.2, baseY: 0.9, colorHex: '#2f3a4d', lightRole: 'window' as const };
  const table = { x: -1, z: -0.5, w: 1.6, d: 0.9, h: 0.8, baseY: 0, colorHex: '#c8a24a', furnishing: { kind: 'table' } };
  const evening = Array.from({ length: 24 }, (_, h) => h >= 17 && h <= 22);

  for (const c of [
    { rotationY: 0, doorZSign: -1 },
    { rotationY: 0, doorZSign: 1 },
    { rotationY: Math.PI / 3, doorZSign: -1 },
    { rotationY: -2.1, doorZSign: 1 },
  ]) {
    it(`puts each pane emitter on the rendered pane and points it out of the house (yaw ${c.rotationY.toFixed(2)}, doorZSign ${c.doorZSign})`, () => {
      const site: OracleSite = { localX: 4.5, localZ: -3.25, surfaceY: 1.75, ...c };
      const o = chunkOriginWorld(1, 2);
      const chunkScene = worldToScene(o.x, o.y, origin);
      const { windows } = collectInteriorLighting([makeChunk(1, 2, site, [floor, pane, table], { litHours: evening })], origin);
      expect(windows).toHaveLength(1);
      const w = windows[0];
      const expected = renderedPartWorldPos(site, chunkScene.x, chunkScene.z, pane);
      expect(w.x).toBeCloseTo(expected.x, 6);
      expect(w.y).toBeCloseTo(expected.y, 6);
      expect(w.z).toBeCloseTo(expected.z, 6);
      expect(w.width).toBeCloseTo(1.2, 6);
      expect(w.height).toBeCloseTo(1.2, 6);
      // Outward: a step along the normal moves away from the floor's center.
      const center = renderedPartWorldPos(site, chunkScene.x, chunkScene.z, { ...floor, h: 0.1 });
      const before = Math.hypot(w.x - center.x, w.z - center.z);
      const after = Math.hypot(w.x + w.nx - center.x, w.z + w.nz - center.z);
      expect(after).toBeGreaterThan(before);
      expect(Math.hypot(w.nx, w.nz)).toBeCloseTo(1, 6);
    });
  }

  it('sets a lamp just above each table-like furnishing of a lit household', () => {
    const site: OracleSite = { localX: 0, localZ: 0, surfaceY: 2, rotationY: 0.4, doorZSign: -1 };
    const o = chunkOriginWorld(0, 0);
    const chunkScene = worldToScene(o.x, o.y, origin);
    const { lamps } = collectInteriorLighting([makeChunk(0, 0, site, [floor, pane, table], { litHours: evening })], origin);
    expect(lamps).toHaveLength(1);
    const tableCenter = renderedPartWorldPos(site, chunkScene.x, chunkScene.z, table);
    expect(lamps[0].x).toBeCloseTo(tableCenter.x, 6);
    expect(lamps[0].z).toBeCloseTo(tableCenter.z, 6);
    expect(lamps[0].y).toBeCloseTo(tableCenter.y + table.h / 2 + 0.3, 6);
    expect(lamps[0].litHours).toBe(evening);
  });

  for (const c of [
    { rotationY: 0, doorZSign: -1 },
    { rotationY: 0, doorZSign: 1 },
    { rotationY: Math.PI / 3, doorZSign: -1 },
    { rotationY: -2.1, doorZSign: 1 },
  ]) {
    it(`puts the sun bounce patch where three.js renders the render-frame patch (yaw ${c.rotationY.toFixed(2)}, doorZSign ${c.doorZSign})`, () => {
      const site: OracleSite = { localX: 4.5, localZ: -3.25, surfaceY: 1.75, ...c };
      const o = chunkOriginWorld(1, 2);
      const chunkScene = worldToScene(o.x, o.y, origin);
      // Every pane is an aperture, lit schedule or not.
      const { apertures } = collectInteriorLighting([makeChunk(1, 2, site, [floor, pane, table])], origin);
      expect(apertures).toHaveLength(1);
      const a = apertures[0];
      // The sun at 45 degrees, straight in through this window, plus a slant.
      const tx = -a.nz, tz = a.nx;
      const l = Math.hypot(1, 1, 0.3);
      const sun = {
        direction: [(a.nx + 0.3 * tx) / l, 1 / l, (a.nz + 0.3 * tz) / l] as [number, number, number],
        sunColor: 0xfff0d0,
        sunIntensity: 2.35,
      };
      const patch = scenePatchFor(a, sun)!;
      expect(patch).not.toBeNull();
      // Oracle: the same patch in the render frame, placed by a three.js group
      // set up as SiteBuilding's.
      const [sx, sy, sz] = sun.direction;
      const cos = Math.cos(c.rotationY), sin = Math.sin(c.rotationY);
      const localSun = { x: sx * cos - sz * sin, y: sy, z: sx * sin + sz * cos };
      const local = sunFloorPatch(a.house.day, a.opening, localSun)!;
      const chunkGroup = new THREE.Group();
      chunkGroup.position.set(chunkScene.x, 0, chunkScene.z);
      const siteGroup = new THREE.Group();
      siteGroup.position.set(site.localX, site.surfaceY, site.localZ);
      siteGroup.rotation.set(0, site.rotationY, 0);
      chunkGroup.add(siteGroup);
      chunkGroup.updateMatrixWorld(true);
      const expected = siteGroup.localToWorld(new THREE.Vector3(local.center.x, local.center.y, local.center.z));
      expect(patch.x).toBeCloseTo(expected.x, 6);
      expect(patch.y).toBeCloseTo(expected.y, 6);
      expect(patch.z).toBeCloseTo(expected.z, 6);
      // The local sun is the scene sun seen from inside the rotated group.
      const back = new THREE.Vector3(localSun.x, localSun.y, localSun.z).applyQuaternion(siteGroup.quaternion);
      expect(back.x).toBeCloseTo(sx, 9);
      expect(back.z).toBeCloseTo(sz, 9);
      // The patch lies inside the house: on the room side of the pane.
      expect((patch.x - a.x) * a.nx + (patch.z - a.z) * a.nz).toBeLessThan(0);
      expect(patch.nx).toBeCloseTo(a.nx, 9);
      expect(patch.nz).toBeCloseTo(a.nz, 9);
      // Radiance of the drawn patch: E = I * s.y on the floor, L = rho E / pi.
      expect(patch.intensity).toBeCloseTo((2.35 * sy) / Math.PI, 9);
      const rho = new THREE.Color(0xfff0d0).multiply(new THREE.Color(floor.colorHex));
      expect(patch.color.r).toBeCloseTo(rho.r, 9);
      expect(patch.color.b).toBeCloseTo(rho.b, 9);
    });
  }

  it('gives no bounce patch when the sun is behind the window', () => {
    const site: OracleSite = { localX: 0, localZ: 0, surfaceY: 0, rotationY: 0.7, doorZSign: -1 };
    const { apertures } = collectInteriorLighting([makeChunk(0, 0, site, [floor, pane])], origin);
    const a = apertures[0];
    const l = Math.SQRT2;
    expect(scenePatchFor(a, { direction: [-a.nx / l, 1 / l, -a.nz / l], sunColor: 0xffffff, sunIntensity: 2 })).toBeNull();
  });

  it('gives a building that is never lit no window emitters and no lamps', () => {
    const site: OracleSite = { localX: 0, localZ: 0, surfaceY: 0, rotationY: 0, doorZSign: -1 };
    const dark = collectInteriorLighting([makeChunk(0, 0, site, [floor, pane, table], { litHours: Array(24).fill(false) })], origin);
    expect(dark.windows).toHaveLength(0);
    expect(dark.lamps).toHaveLength(0);
    const unscheduled = collectInteriorLighting([makeChunk(0, 0, site, [floor, pane, table])], origin);
    expect(unscheduled.windows).toHaveLength(0);
  });
});
