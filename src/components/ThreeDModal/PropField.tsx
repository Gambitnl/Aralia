import { useEffect, useMemo, useRef } from 'react';
import type { BufferGeometry, Material } from 'three';
import { InstancedMesh, Object3D } from 'three';
import { SeededRandom } from '../../utils/random/seededRandom';

interface PropFieldProps {
  count: number;
  size: number;
  seed: number;
  minScale: number;
  maxScale: number;
  heightSampler: (x: number, z: number) => number;
  /** Optional weighting function. Return [0,1] where 0 is "never place". */
  placementWeight?: (x: number, z: number, scale: number) => number;
  /** Candidate retries per instance before giving up and placing anyway. */
  maxAttemptsPerInstance?: number;
  geometry: BufferGeometry;
  material: Material;
  yOffset?: number;
  spawnRadius?: number;
  avoidCenter?: { x: number; z: number };
  avoidRadius?: number;
  avoidBuffer?: number;
}

const PropField = ({
  count,
  size,
  seed,
  minScale,
  maxScale,
  heightSampler,
  placementWeight,
  maxAttemptsPerInstance = 10,
  geometry,
  material,
  yOffset = 0,
  spawnRadius,
  avoidCenter,
  avoidRadius,
  avoidBuffer,
}: PropFieldProps) => {
  const meshRef = useRef<InstancedMesh>(null);

  const instances = useMemo(() => {
    const rng = new SeededRandom(seed);
    const half = spawnRadius ? Math.min(spawnRadius, size / 2) : size / 2;
    const safeRadius = avoidCenter && typeof avoidRadius === 'number'
      ? Math.max(0, Math.min(avoidRadius, Math.max(0, half - 1)))
      : 0;
    const maxSafeRadius = Math.max(0, half - 1);
    const safeBuffer = Math.max(0, avoidBuffer ?? 0);
    const centerX = avoidCenter?.x ?? 0;
    const centerZ = avoidCenter?.z ?? 0;
    const list: Array<{ x: number; y: number; z: number; scale: number; rotation: number }> = [];
    for (let i = 0; i < count; i += 1) {
      const scale = minScale + rng.next() * (maxScale - minScale);
      // Expand the safe radius by a caller-provided buffer so large props
      // cannot visually overlap the spawn-safe zone.
      const bufferedSafeRadius = safeRadius > 0
        ? Math.min(maxSafeRadius, safeRadius + safeBuffer * scale)
        : 0;
      const bufferedSafeRadiusSq = bufferedSafeRadius * bufferedSafeRadius;
      let x = 0;
      let z = 0;
      let placed = false;
      let attempts = 0;
      while (attempts < Math.max(1, maxAttemptsPerInstance)) {
        attempts += 1;
        x = (rng.next() - 0.5) * half * 2;
        z = (rng.next() - 0.5) * half * 2;

        if (bufferedSafeRadius > 0 && (x - centerX) ** 2 + (z - centerZ) ** 2 < bufferedSafeRadiusSq) {
          continue;
        }

        if (placementWeight) {
          const weight = Math.max(0, Math.min(1, placementWeight(x, z, scale)));
          if (weight <= 0) continue;
          if (weight < 1 && rng.next() > weight) continue;
        }

        placed = true;
        break;
      }

      // If we failed to find a candidate outside the reserved spawn zone after
      // max attempts, force a point outside the zone instead of "giving up and
      // placing anyway" on top of the player spawn.
      if (!placed && bufferedSafeRadius > 0) {
        const remaining = Math.max(0, half - bufferedSafeRadius);
        const r = bufferedSafeRadius + rng.next() * remaining;
        const theta = rng.next() * Math.PI * 2;
        x = centerX + Math.cos(theta) * r;
        z = centerZ + Math.sin(theta) * r;
      }

      const baseY = heightSampler(x, z);
      list.push({
        x: Math.min(half, Math.max(-half, x)),
        z: Math.min(half, Math.max(-half, z)),
        y: baseY + yOffset,
        scale,
        rotation: rng.next() * Math.PI * 2,
      });
    }
    return list;
  }, [
    count,
    heightSampler,
    maxAttemptsPerInstance,
    maxScale,
    minScale,
    placementWeight,
    seed,
    size,
    spawnRadius,
    yOffset,
    avoidCenter,
    avoidRadius,
    avoidBuffer,
  ]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new Object3D();

    instances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z);
      dummy.scale.setScalar(instance.scale);
      dummy.rotation.set(0, instance.rotation, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [instances]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      castShadow
      receiveShadow
    />
  );
};

export default PropField;
