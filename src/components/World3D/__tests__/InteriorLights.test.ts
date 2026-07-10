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
import { collectInteriorLighting } from '../InteriorLights';
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

function makeChunk(cx: number, cy: number, site: OracleSite, parts: unknown[]): LoadedChunk {
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
