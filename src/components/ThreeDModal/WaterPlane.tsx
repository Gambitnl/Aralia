import type { Color } from 'three';
import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';

interface WaterPlaneProps {
  size: number;
  level: number;
  color: Color;
  opacity?: number;
}

const WaterPlane = ({ size, level, color, opacity = 0.65 }: WaterPlaneProps) => {
  const material = useMemo(() => new MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.2,
    metalness: 0.1,
  }), [color, opacity]);

  useEffect(() => () => {
    material.dispose();
  }, [material]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]} receiveShadow>
      <planeGeometry args={[size, size, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

export default WaterPlane;
