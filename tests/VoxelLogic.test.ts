
import { describe, it, expect } from 'vitest';
import { edgeTable, triTable } from '../src/components/ThreeDModal/Experimental/MarchingCubesLogic';
import { Vector3 } from 'three';

// Mock the logic from VoxelTerrain.tsx to reproduce the crash
describe('Marching Cubes Logic', () => {
    it('should not crash for any of the 256 possible cube configurations', () => {
        const isoLevel = 0.0;
        
        // Mock interp function
        const interp = (v1: number, v2: number, val1: number, val2: number) => {
            if (Math.abs(val1 - val2) < 0.00001) return v1;
            const mu = (isoLevel - val1) / (val2 - val1);
            return v1 + mu * (v2 - v1);
        };

        // Iterate all 256 cube indices
        for (let cubeIndex = 0; cubeIndex < 256; cubeIndex++) {
            const edges = edgeTable[cubeIndex];
            if (edges === 0 || edges === 255) continue;

            const vertList: (number[] | null)[] = new Array(12).fill(null);
            
            // Mock values (x,y,z are 0,0,0 for local cube)
            const x=0, y=0, z=0;
            // Mock corner values based on cubeIndex bits
            // If bit is set, value > isoLevel (e.g. 1), else < isoLevel (e.g. -1)
            const f = new Array(8).fill(0).map((_, i) => (cubeIndex & (1 << i)) ? 1 : -1);

            // Populate vertList (copied from VoxelTerrain.tsx)
            if (edges & 1)    vertList[0]  = [interp(x, x+1, f[0], f[1]), y, z];
            if (edges & 2)    vertList[1]  = [x+1, interp(y, y+1, f[1], f[3]), z]; // Note: f1, f3 match VoxelTerrain logic
            if (edges & 4)    vertList[2]  = [interp(x, x+1, f[2], f[3]), y+1, z];
            if (edges & 8)    vertList[3]  = [x, interp(y, y+1, f[0], f[2]), z];
            if (edges & 16)   vertList[4]  = [interp(x, x+1, f[4], f[5]), y, z+1];
            if (edges & 32)   vertList[5]  = [x+1, interp(y, y+1, f[5], f[7]), z+1];
            if (edges & 64)   vertList[6]  = [interp(x, x+1, f[6], f[7]), y+1, z+1];
            if (edges & 128)  vertList[7]  = [x, interp(y, y+1, f[4], f[6]), z+1];
            if (edges & 256)  vertList[8]  = [x, y, interp(z, z+1, f[0], f[4])];
            if (edges & 512)  vertList[9]  = [x+1, y, interp(z, z+1, f[1], f[5])];
            if (edges & 1024) vertList[10] = [x+1, y+1, interp(z, z+1, f[3], f[7])];
            if (edges & 2048) vertList[11] = [x, y+1, interp(z, z+1, f[2], f[6])];

            const triOffset = cubeIndex << 4;
            for (let i = 0; i < 16; i += 3) {
                if (triTable[triOffset + i] === -1) break;

                // THIS IS WHERE THE CRASH IS SUSPECTED
                const idx1 = triTable[triOffset + i];
                const idx2 = triTable[triOffset + i + 1];
                const idx3 = triTable[triOffset + i + 2];

                const p1 = vertList[idx1];
                const p2 = vertList[idx2];
                const p3 = vertList[idx3];

                if (p1 && p2 && p3) {
                    // Access [0]
                    const x1 = p1[0];
                    const x2 = p2[0];
                    const x3 = p3[0];
                    // console.log(`Cube ${cubeIndex} Tri ${i/3}: OK`);
                } else {
                    // console.warn(`Cube ${cubeIndex} Tri ${i/3}: Missing vertices!`, { idx1, idx2, idx3, p1, p2, p3 });
                    // Is this a crash condition in the real code?
                    // Real code: if (p1 && p2 && p3) { ... }
                    // So it shouldn't crash here.
                }
            }
        }
    });
});
