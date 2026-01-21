import { useMemo, useRef, useEffect } from 'react';
import { PlaneGeometry, Mesh } from 'three';
import { DeformationManager } from './DeformationManager';

interface DeformableTerrainProps {
  size: number;
  segments: number;
  color?: string | number;
  manager: DeformationManager;
  version: number; // Used to trigger re-renders/updates
}

export const DeformableTerrain = ({ size, segments, color = 0x4ade80, manager, version }: DeformableTerrainProps) => {
  const meshRef = useRef<Mesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(size, size, segments, segments), [size, segments]);
  
  useEffect(() => {
    if (!meshRef.current) return;
    
    const positions = meshRef.current.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const offset = manager.getHeightOffset(x, y);
      positions.setZ(i, offset);
    }
    
    positions.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  }, [manager, version, geometry]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
    </mesh>
  );
};
