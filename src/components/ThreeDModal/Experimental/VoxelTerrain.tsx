import React, { useRef, useEffect, useMemo, useState, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, BufferAttribute, Mesh, Vector3, Color, DoubleSide } from 'three';
import { useTexture } from '@react-three/drei';
import { BiomeDNA } from '@/components/DesignPreview/steps/PreviewBiome';
import { SimplexNoise } from '@/utils/random/simplexNoise';
import { simpleHash } from '@/utils/core/hashUtils';
import { BiomeShaderMaterial } from './BiomeShaderMaterial';
import { extend } from '@react-three/fiber';
import type { VoxelWorkerRequest, VoxelWorkerResponse } from '@/workers/voxelMesher.worker';

// Register custom material with R3F explicitly in this module
extend({ BiomeShaderMaterial });

interface VoxelTerrainProps extends React.ComponentProps<'mesh'> {
  dna: BiomeDNA;
  resolution?: number; // Grid cells per axis
  size?: number; // World size
  isoLevel?: number;
  onGenerated?: (scatter: any[]) => void;
}

export interface VoxelTerrainRef {
  modify: (point: Vector3, radius: number, amount: number) => void;
  getHeight: (x: number, z: number) => number;
}

export const VoxelTerrain = forwardRef<VoxelTerrainRef, VoxelTerrainProps>(({ 
  dna,
  resolution = 32,
  size = 50,
  isoLevel = 0.0,
  onGenerated,
  ...props
}, ref) => {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<any>(null);
  const workerRef = useRef<Worker | null>(null);
  const isMeshing = useRef(false);
  const pendingUpdate = useRef(false);

  // Density Field: (res+1)^3
  const gridSize = resolution + 1;
  const density = useRef<Float32Array>(new Float32Array(gridSize * gridSize * gridSize));

  // Helper: World Pos to Grid Index
  const getSafeIndex = (x: number, y: number, z: number) => {
    const rx = Math.max(0, Math.min(gridSize - 1, Math.round(x)));
    const ry = Math.max(0, Math.min(gridSize - 1, Math.round(y)));
    const rz = Math.max(0, Math.min(gridSize - 1, Math.round(z)));
    return (rz * gridSize * gridSize) + (ry * gridSize) + rx;
  };

  // Initialize Worker
  useEffect(() => {
    // Create worker instance
    workerRef.current = new Worker(new URL('../../../workers/voxelMesher.worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current.onmessage = (e: MessageEvent<VoxelWorkerResponse>) => {
      const { vertices, normals, scatter } = e.data;

      if (meshRef.current) {
        const geo = meshRef.current.geometry;
        geo.setAttribute('position', new BufferAttribute(vertices, 3));
        geo.setAttribute('normal', new BufferAttribute(normals, 3));
        geo.setAttribute('aDisturbance', new BufferAttribute(new Float32Array(vertices.length / 3).fill(0), 1));
        geo.computeBoundingSphere();
      }

      isMeshing.current = false;
      
      if (onGenerated && scatter) {
          onGenerated(scatter);
      }

      // If a modification happened while we were busy, trigger again immediately
      if (pendingUpdate.current) {
        pendingUpdate.current = false;
        triggerWorker();
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const triggerWorker = () => {
    if (!workerRef.current) return;
    if (isMeshing.current) {
      pendingUpdate.current = true;
      return;
    }

    isMeshing.current = true;

    // We must copy the buffer because sending it transfers ownership (making it unusable here)
    // unless we just send a copy. Since we need to keep modifying 'density.current', we send a copy.
    const dataCopy = new Float32Array(density.current);

    const msg: VoxelWorkerRequest = {
      id: Date.now(),
      type: 'generate',
      gridSize,
      isoLevel,
      size,
      data: dataCopy,
      dna // Pass DNA for scatter generation
    };

    workerRef.current.postMessage(msg, [dataCopy.buffer]);
  };
  // Expose Interaction API
  useImperativeHandle(ref, () => ({
    getHeight: (x: number, z: number) => {
        const step = size / resolution;
        const offset = size / 2;
        const gx = (x + offset) / step;
        const gz = (z + offset) / step;

        const ix = Math.floor(gx);
        const iz = Math.floor(gz);

        if (ix < 0 || ix >= resolution || iz < 0 || iz >= resolution) return 0;

        for (let iy = resolution; iy >= 0; iy--) {
            const val = density.current[getSafeIndex(ix, iy, iz)];
            if (val > isoLevel) {
                return (iy * step) - offset;
            }
        }
        return -offset;
    },
    modify: (point: Vector3, radius: number, amount: number) => {
        const step = size / resolution;
        const offset = size / 2;

        const gx = (point.x + offset) / step;
        const gy = (point.y + offset) / step;
        const gz = (point.z + offset) / step;

        const rGrid = radius / step;
        const rSq = rGrid * rGrid;

        const minX = Math.max(0, Math.floor(gx - rGrid));
        const maxX = Math.min(gridSize - 1, Math.ceil(gx + rGrid));
        const minY = Math.max(0, Math.floor(gy - rGrid));
        const maxY = Math.min(gridSize - 1, Math.ceil(gy + rGrid));
        const minZ = Math.max(0, Math.floor(gz - rGrid));
        const maxZ = Math.min(gridSize - 1, Math.ceil(gz + rGrid));

        let modified = false;
        const data = density.current;

        for (let z = minZ; z <= maxZ; z++) {
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const dx = x - gx;
                    const dy = y - gy;
                    const dz = z - gz;
                    const distSq = dx*dx + dy*dy + dz*dz;

                    if (distSq <= rSq) {
                        const falloff = 1.0 - Math.sqrt(distSq) / rGrid;
                        data[getSafeIndex(x,y,z)] += amount * falloff;
                        modified = true;
                    }
                }
            }
        }

        if (modified) triggerWorker();
    }
  }));

  // 1. Initialize Density Field (Base Plane + Noise)
  useEffect(() => {
    const seed = simpleHash(dna.id);
    const noise = new SimplexNoise(seed);
    const step = size / resolution;
    const offset = size / 2;

    const data = density.current;
    data.fill(-10); // Default air

    const freq = 0.03 * (32 / size);
    const amp = 10.0 * dna.roughness;

    for (let z = 0; z < gridSize; z++) {
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          const wx = x * step - offset;
          const wy = y * step - offset;
          const wz = z * step - offset;

          let val = -wy; // Base Plane
          val += noise.noise3D(wx * freq, wy * freq, wz * freq) * amp;

          // Add Caves (3D Worm Noise)
          // We use a different seed/offset for the cave noise
          const caveFreq = freq * 2.5;
          const caveNoise = Math.abs(noise.noise3D(wx * caveFreq + 100, wy * caveFreq + 100, wz * caveFreq + 100));
          
          // If the 3D noise is very close to 0, it creates a "worm" tunnel
          // We only apply this if we are deep enough (y < 2) to avoid floating grass
          if (wy < 2 && caveNoise < 0.12) {
              val = -20; // Hollow it out
          }

          if (y === 0) val = 100; // Floor

          data[(z * gridSize * gridSize) + (y * gridSize) + x] = val;
        }
      }
    }

    triggerWorker();
  }, [dna.id, dna.roughness, resolution, size]);

  const [texTop, texSide] = useTexture([
    `${import.meta.env.BASE_URL || '/'}assets/ez-tree-lab/grass.jpg`,
    `${import.meta.env.BASE_URL || '/'}assets/ez-tree-lab/dirt_color.jpg`
  ]);

  useEffect(() => {
    if (materialRef.current) {
        if (dna) {
            materialRef.current.updatePrimaryColor(dna.primaryColor || '#ffffff');
            materialRef.current.updateSecondaryColor(dna.secondaryColor || '#ffffff');
            materialRef.current.updateRoughness(dna.roughness || 0.5);
        }
        if (texTop && texSide) {
            materialRef.current.updateTextures(texTop, texSide);
        }
    }
  }, [dna, texTop, texSide]);

  return (
    <mesh ref={meshRef} castShadow receiveShadow {...props}>
      <bufferGeometry />
      <biomeShaderMaterial
        ref={materialRef}
        side={DoubleSide}
      />
    </mesh>
  );
});
