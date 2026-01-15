import type { MutableRefObject, RefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, Object3D } from 'three';
import { Vector3 } from 'three';
import GridCellOutline from './GridCellOutline';

interface PartyUnitProps {
  playerRef: RefObject<Object3D | Mesh | null>;
  positionsRef: MutableRefObject<Array<{ x: number; y: number; z: number } | null>>;
  unitIndex: number;
  offset: { x: number; z: number };
  heightSampler: (x: number, z: number) => number;
  submapHalfSize: number;
  showOutline: boolean;
  playerSpeed: number;
  enemyPositions: Array<{ x: number; z: number }>;
  behaviorMode: 'explore' | 'combat';
  preferredRange: number;
  bodyColor?: number;
  outlineColor?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const PartyUnit = ({
  playerRef,
  positionsRef,
  unitIndex,
  offset,
  heightSampler,
  submapHalfSize,
  showOutline,
  playerSpeed,
  enemyPositions,
  behaviorMode,
  preferredRange,
  bodyColor = 0x60a5fa,
  outlineColor = 0x22c55e,
}: PartyUnitProps) => {
  const unitRef = useRef<Mesh>(null);

  const offsetVector = useMemo(() => offset, [offset]);

  useFrame(() => {
    const unit = unitRef.current;
    const player = playerRef.current;
    if (!unit || !player) return;

    const heading = player.rotation.y;
    const cos = Math.cos(heading);
    const sin = Math.sin(heading);
    const rotatedOffsetX = offsetVector.x * cos - offsetVector.z * sin;
    const rotatedOffsetZ = offsetVector.x * sin + offsetVector.z * cos;

    const formationX = player.position.x + rotatedOffsetX;
    const formationZ = player.position.z + rotatedOffsetZ;

    let targetX = formationX;
    let targetZ = formationZ;

    if (behaviorMode === 'combat' && enemyPositions.length > 0) {
      let closest = enemyPositions[0];
      let closestDist = Infinity;
      enemyPositions.forEach((enemy) => {
        const dist = Math.hypot(enemy.x - unit.position.x, enemy.z - unit.position.z);
        if (dist < closestDist) {
          closestDist = dist;
          closest = enemy;
        }
      });

      if (closestDist < preferredRange) {
        const dx = unit.position.x - closest.x;
        const dz = unit.position.z - closest.z;
        const dist = Math.max(0.001, Math.hypot(dx, dz));
        const desiredX = closest.x + (dx / dist) * preferredRange;
        const desiredZ = closest.z + (dz / dist) * preferredRange;
        targetX = desiredX;
        targetZ = desiredZ;
      }
    }

    targetX = clamp(targetX, -submapHalfSize, submapHalfSize);
    targetZ = clamp(targetZ, -submapHalfSize, submapHalfSize);

    if (behaviorMode === 'combat') {
      const driftX = targetX - formationX;
      const driftZ = targetZ - formationZ;
      const driftDist = Math.hypot(driftX, driftZ);
      const maxDrift = 35;
      if (driftDist > maxDrift) {
        targetX = formationX + (driftX / driftDist) * maxDrift;
        targetZ = formationZ + (driftZ / driftDist) * maxDrift;
      }
    }

    const current = unit.position.clone();
    const desired = new Vector3(targetX - current.x, 0, targetZ - current.z);
    const distance = desired.length();

    const speedPerSecond = (playerSpeed || 30) / 6;
    const maxSpeed = speedPerSecond * (behaviorMode === 'combat' ? 0.95 : 0.85);
    const slowRadius = 6;
    const desiredSpeed = distance > slowRadius ? maxSpeed : maxSpeed * (distance / slowRadius);

    const velocity = desired.lengthSq() > 0 ? desired.normalize().multiplyScalar(desiredSpeed) : new Vector3();

    const separation = new Vector3();
    positionsRef.current.forEach((pos, idx) => {
      if (!pos || idx === unitIndex) return;
      const diff = new Vector3(current.x - pos.x, 0, current.z - pos.z);
      const dist = diff.length();
      if (dist > 0 && dist < 8) {
        separation.add(diff.normalize().multiplyScalar((8 - dist) / 8));
      }
    });

    const playerDiff = new Vector3(current.x - player.position.x, 0, current.z - player.position.z);
    const playerDist = playerDiff.length();
    if (playerDist > 0 && playerDist < 6) {
      separation.add(playerDiff.normalize().multiplyScalar((6 - playerDist) / 6));
    }

    const enemyAvoidRadius = behaviorMode === 'combat' ? Math.max(6, preferredRange * 0.35) : 8;
    enemyPositions.forEach((enemy) => {
      const diff = new Vector3(current.x - enemy.x, 0, current.z - enemy.z);
      const dist = diff.length();
      if (dist > 0 && dist < enemyAvoidRadius) {
        separation.add(diff.normalize().multiplyScalar((enemyAvoidRadius - dist) / enemyAvoidRadius));
      }
    });

    velocity.addScaledVector(separation, 4);

    const nextX = clamp(current.x + velocity.x, -submapHalfSize, submapHalfSize);
    const nextZ = clamp(current.z + velocity.z, -submapHalfSize, submapHalfSize);
    const height = heightSampler(nextX, nextZ);

    unit.position.set(nextX, height + 3, nextZ);
    if (velocity.lengthSq() > 0.0001) {
      unit.rotation.y = Math.atan2(velocity.x, velocity.z);
    }

    positionsRef.current[unitIndex] = { x: unit.position.x, y: unit.position.y, z: unit.position.z };
  });

  useEffect(() => () => {
    unitRef.current?.geometry?.dispose();
    (unitRef.current?.material as { dispose?: () => void } | undefined)?.dispose?.();
  }, []);

  return (
    <>
      <mesh ref={unitRef} position={[offsetVector.x, 3, offsetVector.z]} castShadow>
        <boxGeometry args={[3, 6, 3]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} />
      </mesh>
      <GridCellOutline
        playerRef={unitRef}
        gridSize={5}
        heightSampler={heightSampler}
        color={outlineColor}
        visible={showOutline}
      />
    </>
  );
};

export default PartyUnit;
