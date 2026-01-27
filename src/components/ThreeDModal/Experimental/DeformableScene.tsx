// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:42:06
 * Dependents: PreviewBiome.tsx, PreviewEnvironment.tsx
 * Imports: 7 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useRef, useState } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { DeformableTerrain } from './DeformableTerrain';
import { DeformationManager } from './DeformationManager';
import { OverlayMesh } from './OverlayMesh';
import { ProceduralScatter } from './ProceduralScatter';
import { BiomeWater } from './BiomeWater';
import { BiomeHeightFog } from './BiomeHeightFog';
import { BiomeDNA } from '@/components/DesignPreview/steps/PreviewBiome';

export type ToolType = 'mold_earth' | 'create_bonfire' | 'grease' | 'clear';

// TODO: Add a 'Plant Seed' tool that lets the user grow specific scatter items (trees/rocks) on click
interface DeformableSceneProps {
  activeTool: ToolType;
  dna?: BiomeDNA;
}

export const DeformableScene: React.FC<DeformableSceneProps> = ({ activeTool, dna }) => {
  const manager = useRef(new DeformationManager()).current;
  const [version, setVersion] = useState(0); // Tick to trigger re-renders

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    // Cast to any to access 'point' which is present in R3F events but missing in some strict type definitions
    const { x, z } = (event as any).point;

    if (activeTool === 'mold_earth') {
      const type = event.shiftKey ? 'lower' : 'raise';
      manager.applyDeformation(x, z, 15, 4, type);
    } else if (activeTool === 'create_bonfire') {
      manager.addOverlay({
        id: `bonfire-${Date.now()}`,
        type: 'fire',
        x,
        z,
        radius: 8,
        intensity: 1.0
      });
    } else if (activeTool === 'grease') {
      manager.addOverlay({
        id: `grease-${Date.now()}`,
        type: 'grease',
        x,
        z,
        radius: 12,
        intensity: 0.8
      });
    } else if (activeTool === 'clear') {
      manager.clear();
    }

    setVersion(v => v + 1);
  };

  return (
    <Canvas
      shadows
      camera={{ position: [0, 80, 80], fov: 50 }}
      className="w-full h-full"
    >
      {dna?.fogDensity && (
        <fog attach="fog" args={[dna.secondaryColor, 0, 100 / dna.fogDensity]} />
      )}
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 100, 50]} intensity={1.5} castShadow />
      <DeformableTerrain
        size={50}
        segments={64}
        manager={manager}
        version={version}
        dna={dna}
      />

      {dna && (
        <>
          <BiomeWater size={50} dna={dna} />
          {dna.fogDensity && dna.fogDensity > 0 && (
             <BiomeHeightFog size={50} dna={dna} />
          )}
          <ProceduralScatter 
            dna={dna} 
            manager={manager} 
            size={50} 
            version={version} 
          />
        </>
      )}

      {/* Environmental Overlays */}
      {manager.getOverlays().map(overlay => (
        <OverlayMesh
          key={overlay.id}
          overlay={overlay}
          manager={manager}
          version={version}
        />
      ))}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.1, 0]}
        onPointerDown={handlePointerDown}
        visible={false}
      >
        <planeGeometry args={[1000, 1000]} />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
};
