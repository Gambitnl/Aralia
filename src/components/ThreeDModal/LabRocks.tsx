// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:56
 * Dependents: Scene3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import type { InstancedMesh } from 'three';
import { Object3D } from 'three';
import { GLTFLoader, DRACOLoader } from 'three-stdlib';
import { SeededRandom } from '../../utils/random/seededRandom';

interface LabRocksProps {
  seed: number;
  enabled?: boolean;
  countPerType?: number;
  radius?: number;
  avoidCenter?: { x: number; z: number };
  avoidRadius?: number;
}

const MAX_INSTANCES_PER_TYPE = 250;

const findFirstMesh = (root: unknown) => {
  const scene = root as { traverse: (fn: (o: any) => void) => void };
  let found: any = null;
  scene.traverse((o: any) => {
    if (!found && o?.isMesh) found = o;
  });
  if (!found) throw new Error('No mesh found inside GLB scene');
  return found;
};

const shiftGeometryToGround = (geometry: any) => {
  geometry.computeBoundingBox?.();
  const minY = geometry.boundingBox?.min?.y ?? 0;
  if (minY !== 0 && geometry.translate) {
    geometry.translate(0, -minY, 0);
  }
  geometry.computeBoundingSphere?.();
  geometry.computeBoundingBox?.();
  return geometry;
};

const scatter = ({
  seed,
  maxInstances,
  radius,
  avoidCenter,
  avoidRadius,
}: {
  seed: number;
  maxInstances: number;
  radius: number;
  avoidCenter: { x: number; z: number };
  avoidRadius: number;
}) => {
  const rng = new SeededRandom(seed);
  const placements: Array<{ x: number; y: number; z: number; rot: number; scale: number }> = [];
  const avoidSq = avoidRadius * avoidRadius;
  const attemptsMax = maxInstances * 4;
  let attempts = 0;

  while (placements.length < maxInstances && attempts < attemptsMax) {
    attempts += 1;
    const x = (rng.next() * 2 - 1) * radius;
    const z = (rng.next() * 2 - 1) * radius;
    if ((x - avoidCenter.x) ** 2 + (z - avoidCenter.z) ** 2 < avoidSq) continue;
    placements.push({
      x,
      y: 0.3,
      z,
      rot: rng.next() * Math.PI * 2,
      scale: 2 + rng.next() * 3,
    });
  }

  return placements;
};

const LabRocks = ({
  seed,
  enabled = true,
  countPerType = 50,
  radius = 250,
  avoidCenter = { x: 0, z: 0 },
  avoidRadius = 50,
}: LabRocksProps) => {
  const baseUrl = import.meta.env.BASE_URL;
  const dracoLoader = useMemo(() => {
    const loader = new DRACOLoader();
    loader.setDecoderPath(`${baseUrl}assets/ez-tree-lab/draco/`);
    return loader;
  }, [baseUrl]);

  const [rock1, rock2, rock3] = useLoader(
    GLTFLoader,
    [
      `${baseUrl}assets/ez-tree-lab/rock1.glb`,
      `${baseUrl}assets/ez-tree-lab/rock2.glb`,
      `${baseUrl}assets/ez-tree-lab/rock3.glb`,
    ],
    (loader) => {
      (loader as any).setDRACOLoader(dracoLoader);
    }
  );

  useEffect(() => () => {
    dracoLoader.dispose();
  }, [dracoLoader]);

  const rockMeshes = useMemo(() => [findFirstMesh(rock1.scene), findFirstMesh(rock2.scene), findFirstMesh(rock3.scene)], [
    rock1.scene,
    rock2.scene,
    rock3.scene,
  ]);

  const geometries = useMemo(() => rockMeshes.map((mesh) => shiftGeometryToGround(mesh.geometry.clone())), [rockMeshes]);

  useEffect(() => () => {
    geometries.forEach((geometry) => geometry.dispose?.());
  }, [geometries]);

  const rockRef1 = useRef<InstancedMesh>(null);
  const rockRef2 = useRef<InstancedMesh>(null);
  const rockRef3 = useRef<InstancedMesh>(null);
  const refs = [rockRef1, rockRef2, rockRef3];
  const placementsByType = useMemo(() => (
    rockMeshes.map((_, index) => scatter({
      seed: seed + 900 + index * 77,
      maxInstances: MAX_INSTANCES_PER_TYPE,
      radius,
      avoidCenter,
      avoidRadius,
    }))
  ), [avoidCenter, avoidRadius, radius, rockMeshes, seed]);

  useEffect(() => {
    if (!enabled) return;
    refs.forEach((ref, index) => {
      const mesh = ref.current as any;
      if (!mesh) return;
      const dummy = new Object3D();
      const placements = placementsByType[index];
      placements.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.count = Math.max(0, Math.min(countPerType, placements.length));
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [countPerType, enabled, placementsByType]);

  if (!enabled) return null;

  return (
    <>
      {rockMeshes.map((mesh, index) => (
        <instancedMesh
           
          key={`lab-rock-${index}`}
          ref={refs[index]}
          args={[geometries[index], mesh.material, MAX_INSTANCES_PER_TYPE]}
          castShadow
          receiveShadow
        />
      ))}
    </>
  );
};

export default LabRocks;
