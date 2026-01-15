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
  geometry: BufferGeometry;
  material: Material;
  yOffset?: number;
  spawnRadius?: number;
  avoidCenter?: { x: number; z: number };
  avoidRadius?: number;
}

const PropField = ({
  count,
  size,
  seed,
  minScale,
  maxScale,
  heightSampler,
  geometry,
  material,
  yOffset = 0,
  spawnRadius,
  avoidCenter,
  avoidRadius,
}: PropFieldProps) => {
  const meshRef = useRef<InstancedMesh>(null);

  const instances = useMemo(() => {
    const rng = new SeededRandom(seed);
    const half = spawnRadius ? Math.min(spawnRadius, size / 2) : size / 2;
    const safeRadius = avoidCenter && typeof avoidRadius === 'number'
      ? Math.max(0, Math.min(avoidRadius, Math.max(0, half - 1)))
      : 0;
    const safeRadiusSq = safeRadius * safeRadius;
    const centerX = avoidCenter?.x ?? 0;
    const centerZ = avoidCenter?.z ?? 0;
    const list: Array<{ x: number; y: number; z: number; scale: number; rotation: number }> = [];
    for (let i = 0; i < count; i += 1) {
      let x = 0;
      let z = 0;
      if (safeRadius > 0) {
        do {
          x = (rng.next() - 0.5) * half * 2;
          z = (rng.next() - 0.5) * half * 2;
        } while ((x - centerX) ** 2 + (z - centerZ) ** 2 < safeRadiusSq);
      } else {
        x = (rng.next() - 0.5) * half * 2;
        z = (rng.next() - 0.5) * half * 2;
      }
      const baseY = heightSampler(x, z);
      list.push({
        x: Math.min(half, Math.max(-half, x)),
        z: Math.min(half, Math.max(-half, z)),
        y: baseY + yOffset,
        scale: minScale + rng.next() * (maxScale - minScale),
        rotation: rng.next() * Math.PI * 2,
      });
    }
    return list;
  }, [
    count,
    heightSampler,
    maxScale,
    minScale,
    seed,
    size,
    spawnRadius,
    yOffset,
    avoidCenter?.x,
    avoidCenter?.z,
    avoidRadius,
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
