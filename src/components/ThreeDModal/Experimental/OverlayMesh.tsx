import { useMemo, useRef, useEffect } from 'react';
import { PlaneGeometry, Mesh } from 'three';
import { DeformationManager } from './DeformationManager';
import { EnvironmentalOverlay } from './types';

const EFFECT_COLORS: Record<string, number> = {
  fire: 0xef4444, // Red
  grease: 0x3f3f46, // Dark Gray
  ice: 0x60a5fa, // Blue
  water: 0x3b82f6, // Dark Blue
  fog: 0xe2e8f0, // Light Gray
};

interface OverlayMeshProps {
  overlay: EnvironmentalOverlay;
  manager: DeformationManager;
  version: number;
}

export const OverlayMesh = ({ overlay, manager, version }: OverlayMeshProps) => {
  const meshRef = useRef<Mesh>(null);
  const segments = 16;
  const geometry = useMemo(() => new PlaneGeometry(overlay.radius * 2, overlay.radius * 2, segments, segments), [overlay.radius]);
  
  useEffect(() => {
    if (!meshRef.current) return;
    const positions = meshRef.current.geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      // Local coordinates to world-ish relative sample
      const localX = positions.getX(i);
      const localY = positions.getY(i);
      const worldX = overlay.x + localX;
      const worldZ = overlay.z + localY;
      
      const height = manager.getHeightOffset(worldX, worldZ);
      positions.setZ(i, height + 0.2); // Elevate slightly above terrain
    }
    positions.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  }, [manager, version, overlay.x, overlay.z, geometry]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial 
        color={EFFECT_COLORS[overlay.type]} 
        transparent 
        opacity={0.6} 
        depthWrite={false}
      />
    </mesh>
  );
};
