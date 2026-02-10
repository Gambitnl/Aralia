import { edgeTable, triTable } from '../ThreeDModal/Experimental/MarchingCubesLogic';
import { Vector3 } from 'three';
import { SimplexNoise } from '../utils/random/simplexNoise'; // We'll need a standalone noise impl or pass it in

// Standalone Simplex Noise for Worker (stripped down)
class FastNoise {
    perm: Uint8Array;
    constructor(seed = 0) {
        this.perm = new Uint8Array(512);
        for(let i=0; i<512; i++) this.perm[i] = i & 255;
        // Shuffle based on seed (simple LCG)
        let t, j;
        for(let i=0; i<256; i++) {
            j = (seed + i) & 255; // Placeholder shuffle
            t = this.perm[i]; this.perm[i] = this.perm[j]; this.perm[j] = t;
            this.perm[i+256] = this.perm[i];
        }
    }
    // Very basic 3D noise placeholder - in real prod use a library
    // For now, we will assume the main thread passes valid density data
    // so we don't need to re-calculate noise here for the mesh.
    // BUT for Caves, we need to modify density.
}

export interface VoxelWorkerRequest {
  id: number;
  type: 'generate';
  gridSize: number;
  isoLevel: number;
  size: number;
  data: Float32Array; // Base density from main thread (or we generate it here?)
  // If we want caves, we should probably generate ALL density here to be consistent.
  // But VoxelTerrain currently sends 'data'.
  // Let's stick to receiving data for now, but we can apply a "cave mask" if we want.
  
  dna: any; // BiomeDNA
}

export interface ScatterPoint {
    type: 'tree' | 'rock' | 'grass';
    position: [number, number, number];
    scale: number;
    rotation: [number, number, number];
    variantIdx: number;
}

export interface VoxelWorkerResponse {
  id: number;
  vertices: Float32Array;
  normals: Float32Array;
  scatter: ScatterPoint[];
}

self.onmessage = (e: MessageEvent<VoxelWorkerRequest>) => {
  const { id, type, gridSize, isoLevel, size, data, dna } = e.data;

  if (type === 'generate') {
    // 1. (Optional) Apply Cave Noise here if we want worker-side generation
    // For now, we assume 'data' contains the field.
    
    // 2. Generate Mesh
    const meshResult = generateMesh(data, gridSize, isoLevel, size);
    
    // 3. Generate Scatter (using the surface data)
    // We can use the vertices directly to find surface points!
    const scatter = generateScatter(meshResult.vertices, dna, size);

    self.postMessage(
      { 
          id, 
          vertices: meshResult.vertices, 
          normals: meshResult.normals,
          scatter
      } as VoxelWorkerResponse, 
      [meshResult.vertices.buffer, meshResult.normals.buffer]
    );
  }
};

const generateScatter = (vertices: Float32Array, dna: any, size: number): ScatterPoint[] => {
    const points: ScatterPoint[] = [];
    if (!dna.scatter) return points;

    // Simple strategy: Pick random vertices from the generated mesh
    // This ensures items are always on the surface.
    const vertexCount = vertices.length / 3;
    if (vertexCount === 0) return points;

    dna.scatter.forEach((rule: any) => {
        // Density is per unit area approx
        const count = Math.floor(vertexCount * (rule.density * 0.05)); // Tuned factor
        
        for(let i=0; i<count; i++) {
            // Pick a random vertex index
            const idx = Math.floor(Math.random() * vertexCount) * 3;
            const x = vertices[idx];
            const y = vertices[idx+1];
            const z = vertices[idx+2];

            // Filter logic (slope, height) would go here
            // We need normals to check slope (passed separately or re-calc)
            // For MVP, just random placement on surface
            
            const s = rule.scaleMean + (Math.random() - 0.5) * rule.scaleVar;
            
            points.push({
                type: rule.assetType,
                position: [x, y, z],
                scale: Math.max(0.1, s),
                rotation: [0, Math.random() * Math.PI * 2, 0],
                variantIdx: Math.floor(Math.random() * 5)
            });
        }
    });

    return points;
};

const generateMesh = (data: Float32Array, gridSize: number, isoLevel: number, size: number) => {
  const vertices: number[] = [];
  const normals: number[] = [];
  
  const resolution = gridSize - 1;
  const step = size / resolution;
  const offset = size / 2;

  const getSafeIndex = (x: number, y: number, z: number) => {
    return (z * gridSize * gridSize) + (y * gridSize) + x;
  };

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

  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals)
  };
};