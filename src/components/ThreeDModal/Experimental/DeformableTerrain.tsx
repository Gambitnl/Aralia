// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:42:08
 * Dependents: DeformableScene.tsx
 * Imports: 3 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useMemo, useRef, useEffect } from 'react';
import { PlaneGeometry, Mesh, BufferAttribute, Color, Texture } from 'three';
import { useTexture } from '@react-three/drei';
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

  // Load Tri-Planar Textures
  // Note: Paths are relative to public/ or base URL
  const [texTop, texSide] = useTexture([
    'assets/ez-tree-lab/grass.jpg',
    'assets/ez-tree-lab/dirt_color.jpg'
  ]);

  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(size, size, segments, segments);
    
    // Instead of 'color', we now track 'disturbance' as a float attribute
    const count = geo.attributes.position.count;
    geo.setAttribute('aDisturbance', new BufferAttribute(new Float32Array(count), 1));
    
    return geo;
  }, [size, segments]);
  
    // UPDATE LOOP: Physics/Height/Disturbance
    // TODO: Offload terrain deformation math to a Worker or Compute Shader if segment count increases
    useEffect(() => {
      if (!meshRef.current) return;
  
      const positions = meshRef.current.geometry.attributes.position;    const disturbances = meshRef.current.geometry.attributes.aDisturbance as BufferAttribute;

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
    if (materialRef.current) {
      if (dna) {
        materialRef.current.updatePrimaryColor(dna.primaryColor);
        materialRef.current.updateSecondaryColor(dna.secondaryColor);
        materialRef.current.updateRoughness(dna.roughness);
      }
      // Pass loaded textures to shader
      if (texTop && texSide) {
        materialRef.current.updateTextures(texTop, texSide);
      }
    }
  }, [dna, texTop, texSide]);

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
