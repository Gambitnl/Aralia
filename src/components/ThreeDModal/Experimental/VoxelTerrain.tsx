import React, { useRef, useEffect, useMemo, useState, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, BufferAttribute, Mesh, Vector3, Color, DoubleSide } from 'three';
import { useTexture } from '@react-three/drei';
import { BiomeDNA } from '@/components/DesignPreview/steps/PreviewBiome';
import { SimplexNoise } from '@/utils/random/simplexNoise';
import { simpleHash } from '@/utils/core/hashUtils';
import { edgeTable, triTable } from './MarchingCubesLogic';
import { BiomeShaderMaterial } from './BiomeShaderMaterial';

interface VoxelTerrainProps extends React.ComponentProps<'mesh'> {
  dna: BiomeDNA;
  resolution?: number; // Grid cells per axis
  size?: number; // World size
  isoLevel?: number;
}

export interface VoxelTerrainRef {
  modify: (point: Vector3, radius: number, amount: number) => void;
}

export const VoxelTerrain = forwardRef<VoxelTerrainRef, VoxelTerrainProps>(({ 
  dna, 
  resolution = 32, 
  size = 50,
  isoLevel = 0.0,
  ...props
}, ref) => {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<any>(null);
  
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

  // Expose Interaction API
  useImperativeHandle(ref, () => ({
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

        if (modified) regenerateMesh();
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
          
          if (y === 0) val = 100; // Floor

          data[(z * gridSize * gridSize) + (y * gridSize) + x] = val;
        }
      }
    }
    
    regenerateMesh();
  }, [dna.id, dna.roughness, resolution, size]);

        // 2. Meshing (Marching Cubes)
        const regenerateMesh = () => {
          if (!meshRef.current) return;
    
          // Safety check for lookup tables to prevent "undefined reading 0" crashes
          if (!edgeTable || !triTable) {
              console.error('[VoxelTerrain] Marching Cubes tables not loaded', { edgeTable: !!edgeTable, triTable: !!triTable });
              return;
          }
    
          const vertices: number[] = [];
          const normals: number[] = [];
          const data = density.current;      const step = size / resolution;
      const offset = size / 2;
  
      const interp = (v1: number, v2: number, val1: number, val2: number) => {
          if (Math.abs(val1 - val2) < 0.00001) return v1;
          const mu = (isoLevel - val1) / (val2 - val1);
          return v1 + mu * (v2 - v1);
      };
  
      const getGradient = (x: number, y: number, z: number) => {
          const x0 = Math.max(0, x-1); const x1 = Math.min(gridSize-1, x+1);
          const y0 = Math.max(0, y-1); const y1 = Math.min(gridSize-1, y+1);
          const z0 = Math.max(0, z-1); const z1 = Math.min(gridSize-1, z+1);
  
          const dx = data[getSafeIndex(x1,y,z)] - data[getSafeIndex(x0,y,z)];
          const dy = data[getSafeIndex(x,y1,z)] - data[getSafeIndex(x,y0,z)];
          const dz = data[getSafeIndex(x,y,z1)] - data[getSafeIndex(x,y,z0)];
  
          const v = new Vector3(-dx, -dy, -dz);
          if (v.lengthSq() < 0.000001) {
              v.set(0, 1, 0); 
          } else {
              v.normalize();
          }
          return v;
      };
  
      for (let z = 0; z < resolution; z++) {
        for (let y = 0; y < resolution; y++) {
          for (let x = 0; x < resolution; x++) {
              // Three.js vertex ordering:
              // v0: (x,y,z), v1: (x+1,y,z), v2: (x,y+1,z), v3: (x+1,y+1,z)
              // v4: (x,y,z+1), v5: (x+1,y,z+1), v6: (x,y+1,z+1), v7: (x+1,y+1,z+1)
              const f0 = data[getSafeIndex(x,   y,   z)];
              const f1 = data[getSafeIndex(x+1, y,   z)];
              const f2 = data[getSafeIndex(x,   y+1, z)];
              const f3 = data[getSafeIndex(x+1, y+1, z)];
              const f4 = data[getSafeIndex(x,   y,   z+1)];
              const f5 = data[getSafeIndex(x+1, y,   z+1)];
              const f6 = data[getSafeIndex(x,   y+1, z+1)];
              const f7 = data[getSafeIndex(x+1, y+1, z+1)];
  
              let cubeIndex = 0;
              if (f0 > isoLevel) cubeIndex |= 1;
              if (f1 > isoLevel) cubeIndex |= 2;
              if (f2 > isoLevel) cubeIndex |= 8;
              if (f3 > isoLevel) cubeIndex |= 4;
              if (f4 > isoLevel) cubeIndex |= 16;
              if (f5 > isoLevel) cubeIndex |= 32;
              if (f6 > isoLevel) cubeIndex |= 128;
              if (f7 > isoLevel) cubeIndex |= 64;
  
              const edges = edgeTable[cubeIndex];
              if (edges === 0 || edges === 255) continue;
  
              const vertList: (number[] | null)[] = new Array(12).fill(null);
              // Edges mapping to match Three.js logic
              if (edges & 1)    vertList[0]  = [interp(x, x+1, f0, f1), y, z];
              if (edges & 2)    vertList[1]  = [x+1, interp(y, y+1, f1, f3), z];
              if (edges & 4)    vertList[2]  = [interp(x, x+1, f2, f3), y+1, z];
              if (edges & 8)    vertList[3]  = [x, interp(y, y+1, f0, f2), z];
              if (edges & 16)   vertList[4]  = [interp(x, x+1, f4, f5), y, z+1];
              if (edges & 32)   vertList[5]  = [x+1, interp(y, y+1, f5, f7), z+1];
              if (edges & 64)   vertList[6]  = [interp(x, x+1, f6, f7), y+1, z+1];
              if (edges & 128)  vertList[7]  = [x, interp(y, y+1, f4, f6), z+1];
              if (edges & 256)  vertList[8]  = [x, y, interp(z, z+1, f0, f4)];
              if (edges & 512)  vertList[9]  = [x+1, y, interp(z, z+1, f1, f5)];
              if (edges & 1024) vertList[10] = [x+1, y+1, interp(z, z+1, f3, f7)];
              if (edges & 2048) vertList[11] = [x, y+1, interp(z, z+1, f2, f6)];
  
              const triOffset = cubeIndex << 4;
              for (let i = 0; i < 16; i += 3) {
                  if (triTable[triOffset + i] === -1) break;
                  
                  const p1 = vertList[triTable[triOffset + i]];
                  const p2 = vertList[triTable[triOffset + i + 1]];
                  const p3 = vertList[triTable[triOffset + i + 2]];
  
                  if (p1 && p2 && p3) {
                      vertices.push(
                          p1[0] * step - offset, p1[1] * step - offset, p1[2] * step - offset,
                          p2[0] * step - offset, p2[1] * step - offset, p2[2] * step - offset,
                          p3[0] * step - offset, p3[1] * step - offset, p3[2] * step - offset
                      );
  
                      const n1 = getGradient(p1[0], p1[1], p1[2]);
                      const n2 = getGradient(p2[0], p2[1], p2[2]);
                      const n3 = getGradient(p3[0], p3[1], p3[2]);
                      normals.push(n1.x, n1.y, n1.z, n2.x, n2.y, n2.z, n3.x, n3.y, n3.z);
                  }
              }
          }
        }
      }
  
      const geo = meshRef.current.geometry;
      geo.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
      geo.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
      geo.setAttribute('aDisturbance', new BufferAttribute(new Float32Array(vertices.length / 3).fill(0), 1));
      geo.computeBoundingSphere();
    };
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