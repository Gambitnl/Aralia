import { useMemo, useRef, useEffect } from 'react';
import { PlaneGeometry, Mesh, BufferAttribute, Color } from 'three';
import { DeformationManager } from './DeformationManager';
import './BiomeShaderMaterial'; // Ensure registration happens
import { BiomeDNA } from '@/components/DesignPreview/steps/PreviewBiome';

interface DeformableTerrainProps {
  size: number;
  segments: number;
  color?: string | number; // Deprecated but kept for compat
  manager: DeformationManager;
  version: number;
  dna?: BiomeDNA;
}

export const DeformableTerrain = ({ 
  size, 
  segments, 
  manager, 
  version,
  dna 
}: DeformableTerrainProps) => {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<any>(null); // Ref to our custom shader material

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(size, size, segments, segments);
    
    // Instead of 'color', we now track 'disturbance' as a float attribute
    const count = geo.attributes.position.count;
    geo.setAttribute('aDisturbance', new BufferAttribute(new Float32Array(count), 1));
    
    return geo;
  }, [size, segments]);
  
  // UPDATE LOOP: Physics/Height/Disturbance
  useEffect(() => {
    if (!meshRef.current) return;
    
    const positions = meshRef.current.geometry.attributes.position;
    const disturbances = meshRef.current.geometry.attributes.aDisturbance as BufferAttribute;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      
      const offset = manager.getHeightOffset(x, y);
      const distVal = manager.getDisturbance(x, y);
      
      positions.setZ(i, offset);
      disturbances.setX(i, distVal);
    }
    
    positions.needsUpdate = true;
    disturbances.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  }, [manager, version, geometry]);

  // UNIFORM UPDATE: DNA Properties
  useEffect(() => {
    if (materialRef.current && dna) {
      materialRef.current.updatePrimaryColor(dna.primaryColor);
      materialRef.current.updateSecondaryColor(dna.secondaryColor);
      materialRef.current.updateRoughness(dna.roughness);
    }
  }, [dna]);

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <biomeShaderMaterial 
        ref={materialRef}
        primaryColor={dna?.primaryColor ?? '#4ade80'}
        secondaryColor={dna?.secondaryColor ?? '#8b5a2b'}
        roughness={dna?.roughness ?? 0.5}
      />
    </mesh>
  );
};
