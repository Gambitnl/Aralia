import { useMemo } from 'react';
import { PlaneGeometry } from 'three';

interface DeformableTerrainProps {
  size: number;
  segments: number;
  color?: string | number;
}

export const DeformableTerrain = ({ size, segments, color = 0x4ade80 }: DeformableTerrainProps) => {
  const geometry = useMemo(() => new PlaneGeometry(size, size, segments, segments), [size, segments]);
  
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} wireframe={true} />
    </mesh>
  );
};
