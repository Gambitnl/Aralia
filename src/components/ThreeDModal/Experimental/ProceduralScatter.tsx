// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:42:20
 * Dependents: DeformableScene.tsx
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useEffect, useState } from 'react';
import { Instance, Instances } from '@react-three/drei';
import { DoubleSide, Object3D, Vector3 } from 'three';
import { DeformationManager } from './DeformationManager';
import { BiomeDNA, ScatterRule } from '@/components/DesignPreview/steps/PreviewBiome';

interface ProceduralScatterProps {
  dna: BiomeDNA;
  manager: DeformationManager;
  size: number;
  version: number; // Trigger re-scatter on terrain change
}

export const ProceduralScatter: React.FC<ProceduralScatterProps> = ({ dna, manager, size, version }) => {
  // We only re-calculate the scatter positions when DNA or Terrain changes (version)
  const scatterData = useMemo(() => {
    const data: { ruleId: string; positions: { position: [number, number, number]; scale: number; rotation: [number, number, number] }[] }[] = [];
    
    if (!dna.scatter) return [];

    const area = size * size;
    // Simple slope estimator
    // TODO: Implement more robust normal-based slope calculation for precision
    const getSlope = (x: number, z: number): number => {
       const h0 = manager.getHeightOffset(x, z);
       const h1 = manager.getHeightOffset(x + 1, z);
       const h2 = manager.getHeightOffset(x, z + 1);
       // Rise over run (approx 1 unit)
       const dx = Math.abs(h1 - h0);
       const dz = Math.abs(h2 - h0);
       return Math.max(dx, dz); // 0 = flat, 1+ = steep
    };

    dna.scatter.forEach(rule => {
        // Density is probability per unit square roughly, or just raw count factor
        // Let's treat density as "items per 100 sq units"
        const count = Math.floor(area * (rule.density * 0.1)); 
        const instances = [];

        for (let i = 0; i < count; i++) {
            // Random pos
            const x = (Math.random() - 0.5) * size;
            const z = (Math.random() - 0.5) * size;
            
            // Check height constraints
            const y = manager.getHeightOffset(x, z);
            if (rule.minHeight !== undefined && y < rule.minHeight) continue;
            if (rule.maxHeight !== undefined && y > rule.maxHeight) continue;

            // Check slope constraints
            const slope = getSlope(x, z);
            const minS = rule.minSlope ?? 0;
            const maxS = rule.maxSlope ?? 10;
            if (slope < minS || slope > maxS) continue;

            // Scale
            const s = rule.scaleMean + (Math.random() - 0.5) * rule.scaleVar;
            
            // Rotation (random Y)
            const rot: [number, number, number] = [0, Math.random() * Math.PI * 2, 0];

            instances.push({
                position: [x, y, z] as [number, number, number],
                scale: Math.max(0.1, s),
                rotation: rot
            });
        }
        data.push({ ruleId: rule.id, positions: instances });
    });

    return data;
  }, [dna, size, version, manager]); // 'manager' is stable ref, but its content changes. 'version' signals that content change.

  return (
    <group>
      {dna.scatter.map((rule, idx) => {
        const instances = scatterData.find(d => d.ruleId === rule.id)?.positions || [];
        if (instances.length === 0) return null;

        let color = '#ffffff';
        let geometry = <coneGeometry args={[0.5, 2, 8]} />; // Tree default

        if (rule.assetType === 'rock') {
           color = '#888888';
           geometry = <dodecahedronGeometry args={[0.8, 0] as any} />;
        } else if (rule.assetType === 'grass') {
           color = dna.primaryColor; // Match terrain
           geometry = <planeGeometry args={[0.5, 1] as any} />;
        } else {
           // Trees
           color = '#2d5a27';
           geometry = <coneGeometry args={[0.5, 2, 8] as any} />;
        }

        return (
          <Instances key={rule.id} range={instances.length} castShadow receiveShadow>
            {geometry}
            <meshStandardMaterial color={color} />
            
            {instances.map((data, i) => (
                <Instance 
                   key={i} 
                   position={data.position} 
                   scale={data.scale} 
                   rotation={data.rotation} 
                />
            ))}
          </Instances>
        );
      })}
    </group>
  );
};
