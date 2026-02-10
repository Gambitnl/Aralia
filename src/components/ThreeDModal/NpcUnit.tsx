import type { RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Mesh, Object3D } from 'three';
import GridCellOutline from './GridCellOutline';

interface NpcUnitProps {
  id: string;
  label: string;
  position: { x: number; z: number };
  heightSampler: (x: number, z: number) => number;
  showOutline: boolean;
  playerRef?: RefObject<Object3D | Mesh | null>;
  isHovered?: boolean;
  isSelected?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onSelect?: () => void;
  bodyColor?: number;
  outlineColor?: number;
}

const NpcUnit = ({
  id: _id,
  label: _label,
  position,
  heightSampler,
  showOutline,
  playerRef,
  isHovered = false,
  isSelected = false,
  onHoverStart,
  onHoverEnd,
  onSelect,
  bodyColor = 0x22c55e,
  outlineColor = 0x38bdf8,
}: NpcUnitProps) => {
  const npcRootRef = useRef<Object3D | null>(null);
  const height = useMemo(() => heightSampler(position.x, position.z), [heightSampler, position.x, position.z]);

  useFrame(() => {
    const npc = npcRootRef.current;
    const player = playerRef?.current;
    if (!npc || !player) return;

    const dx = player.position.x - npc.position.x;
    const dz = player.position.z - npc.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001 || dist > 180) return;

    npc.rotation.y = Math.atan2(dx, dz);
  });

  const highlightVisible = showOutline || isHovered || isSelected;
  const highlightColor = isSelected ? 0xfde047 : outlineColor;

  return (
    <>
      <group ref={npcRootRef} position={[position.x, height + 3, position.z]}>
        <mesh
          castShadow
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHoverStart?.();
          }}
          onPointerOut={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHoverEnd?.();
          }}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onSelect?.();
          }}
        >
          <cylinderGeometry args={[2.2, 2.2, 6, 12]} />
          <meshStandardMaterial color={bodyColor} roughness={0.55} map={null} />
        </mesh>
        <mesh position={[0, 4.25, 0]} castShadow>
          <sphereGeometry args={[1.6, 16, 16]} />
          <meshStandardMaterial color={bodyColor} roughness={0.55} map={null} />
        </mesh>
      </group>
      <GridCellOutline
        playerRef={npcRootRef}
        gridSize={5}
        heightSampler={heightSampler}
        color={highlightColor}
        visible={highlightVisible}
      />
    </>
  );
};

export default NpcUnit;
