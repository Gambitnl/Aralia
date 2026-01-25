/**
 * @file src/services/cellularAutomataService.ts
 * A service for generating 2D grid maps using a Cellular Automata algorithm.
 * Ideal for creating organic cave-like structures.
 * Includes post-processing to ensure map connectivity.
 */
import { SeededRandom } from '@/utils/random';

export type CaTileType = 'floor' | 'wall';

interface Point {
  x: number;
  y: number;
}

export class CellularAutomataGenerator {
  private random: SeededRandom;
  private width: number;
  private height: number;
  private grid: CaTileType[][];

  constructor(width: number, height: number, seed: number) {
    this.width = width;
    this.height = height;
    this.random = new SeededRandom(seed);
    this.grid = [];
  }
  
  // Step 1: Initialize the grid with random noise
  private initializeGrid(fillProbability: number) {
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      const row: CaTileType[] = [];
      for (let x = 0; x < this.width; x++) {
        // Edges are always walls to ensure enclosure
        if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
           row.push('wall');
        } else {
           row.push(this.random.next() < fillProbability ? 'wall' : 'floor');
        }
      }
      this.grid.push(row);
    }
  }

  // Helper: Count wall neighbors (Moore neighborhood)
  private getNeighborWallCount(grid: CaTileType[][], x: number, y: number): number {
    let wallCount = 0;
    for (let neighbourY = y - 1; neighbourY <= y + 1; neighbourY++) {
      for (let neighbourX = x - 1; neighbourX <= x + 1; neighbourX++) {
        if (neighbourX >= 0 && neighbourX < this.width && neighbourY >= 0 && neighbourY < this.height) {
          if (neighbourX !== x || neighbourY !== y) {
            if (grid[neighbourY][neighbourX] === 'wall') {
              wallCount++;
            }
          }
        } else {
          wallCount++; // Edge/OOB counts as wall
        }
      }
    }
    return wallCount;
  }

  // Step 2: Run the simulation for a number of steps
  private doSimulationStep(wallThreshold: number) {
    const newGrid: CaTileType[][] = [];
    for (let y = 0; y < this.height; y++) {
      const newRow: CaTileType[] = [];
      for (let x = 0; x < this.width; x++) {
        const wallNeighbors = this.getNeighborWallCount(this.grid, x, y);
        if (wallNeighbors > wallThreshold) {
          newRow.push('wall');
        } else if (wallNeighbors < wallThreshold) {
          newRow.push('floor');
        } else {
          newRow.push(this.grid[y][x]);
        }
      }
      newGrid.push(newRow);
    }
    this.grid = newGrid;
  }

  // Step 3: Find all disconnected regions of floors
  private getRegions(tileType: CaTileType): Point[][] {
    const regions: Point[][] = [];
    const visited = new Set<string>();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!visited.has(`${x},${y}`) && this.grid[y][x] === tileType) {
          const newRegion: Point[] = [];
          const queue: Point[] = [{ x, y }];
          visited.add(`${x},${y}`);

          while (queue.length > 0) {
            const tile = queue.shift()!;
            newRegion.push(tile);

            const dirs = [
              { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, 
              { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
            ];

            for (const dir of dirs) {
              const nx = tile.x + dir.dx;
              const ny = tile.y + dir.dy;

              if (
                nx >= 0 && nx < this.width && 
                ny >= 0 && ny < this.height && 
                !visited.has(`${nx},${ny}`) && 
                this.grid[ny][nx] === tileType
              ) {
                visited.add(`${nx},${ny}`);
                queue.push({ x: nx, y: ny });
              }
            }
          }
          regions.push(newRegion);
        }
      }
    }
    return regions;
  }

  // Step 4: Ensure all floor regions are connected
  private ensureConnectivity() {
    const regions = this.getRegions('floor');
    if (regions.length <= 1) return; // Already connected or empty

    // Sort regions by size (largest first)
    regions.sort((a, b) => b.length - a.length);
    
    const mainRegion = regions[0];
    
    // Connect all smaller regions to the main region (or closest connected component)
    // For simplicity, we just connect every small region to the main one.
    for (let i = 1; i < regions.length; i++) {
      this.connectRegions(regions[i], mainRegion);
    }
  }

  private connectRegions(regionA: Point[], regionB: Point[]) {
    let bestDist = Infinity;
    let bestTileA = regionA[0];
    let bestTileB = regionB[0];

    // Find closest tiles between the two regions
    // Optimization: Could use sampled points for very large regions, but ok for submap size
    for (const tileA of regionA) {
      for (const tileB of regionB) {
        const dist = Math.pow(tileA.x - tileB.x, 2) + Math.pow(tileA.y - tileB.y, 2);
        if (dist < bestDist) {
          bestDist = dist;
          bestTileA = tileA;
          bestTileB = tileB;
        }
      }
    }

    this.createPassage(bestTileA, bestTileB);
  }

  private createPassage(tileA: Point, tileB: Point) {
    // Draw a line between the two points
    let x = tileA.x;
    let y = tileA.y;
    const dx = Math.abs(tileB.x - x);
    const dy = Math.abs(tileB.y - y);
    const sx = x < tileB.x ? 1 : -1;
    const sy = y < tileB.y ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.grid[y][x] = 'floor';
      
      // Make corridor slightly wider for better playability
      if (x + 1 < this.width) this.grid[y][x+1] = 'floor';
      if (y + 1 < this.height) this.grid[y+1][x] = 'floor';

      if (x === tileB.x && y === tileB.y) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // Main public method to generate the map
  public generateMap(
    fillProbability: number = 0.45,
    simulationSteps: number = 4,
    wallThreshold: number = 4
  ): CaTileType[][] {
    this.initializeGrid(fillProbability);
    for (let i = 0; i < simulationSteps; i++) {
      this.doSimulationStep(wallThreshold);
    }
    this.ensureConnectivity();
    
    // Safety: If map ends up empty or too small, force a clearing
    const regions = this.getRegions('floor');
    if (regions.length === 0 || regions[0].length < 10) {
         const cx = Math.floor(this.width / 2);
         const cy = Math.floor(this.height / 2);
         for(let y=cy-2; y<=cy+2; y++) {
             for(let x=cx-2; x<=cx+2; x++) {
                 if(x>0 && x<this.width-1 && y>0 && y<this.height-1) {
                     this.grid[y][x] = 'floor';
                 }
             }
         }
    }
    
    return this.grid;
  }
}
