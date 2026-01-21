import { useMemo, useRef, useEffect } from 'react';
import { PlaneGeometry, Mesh, BufferAttribute, Color } from 'three';
import { DeformationManager } from './DeformationManager';

interface DeformableTerrainProps {
  size: number;
  segments: number;
  color?: string | number;
  manager: DeformationManager;
  version: number;
}

const GRASS_COLOR = new Color(0x4ade80);
const DIRT_COLOR = new Color(0x8b5a2b);

export const DeformableTerrain = ({ size, segments, color = 0x4ade80, manager, version }: DeformableTerrainProps) => {
  const meshRef = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(size, size, segments, segments);
    // Initialize vertex colors
    const count = geo.attributes.position.count;
    geo.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
    return geo;
  }, [size, segments]);
  
  useEffect(() => {
    if (!meshRef.current) return;
    
    const positions = meshRef.current.geometry.attributes.position;
    const colors = meshRef.current.geometry.attributes.color;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      
      const offset = manager.getHeightOffset(x, y);
      const disturbance = manager.getDisturbance(x, y);
      
      positions.setZ(i, offset);

      // Simple visual logic: If disturbed > 1.0, look like dirt.
      // Lerp between Grass and Dirt based on disturbance.
      const t = Math.min(disturbance / 5.0, 1.0); // Full dirt at 5ft disturbance
      const c = GRASS_COLOR.clone().lerp(DIRT_COLOR, t);
      
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  }, [manager, version, geometry]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial 
        vertexColors 
        roughness={0.8} 
        metalness={0.1} 
      />
    </mesh>
  );
};
