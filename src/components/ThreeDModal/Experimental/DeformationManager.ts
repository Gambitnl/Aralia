/**
 * @file DeformationManager.ts
 * Manages dynamic terrain height offsets for the malleable world system.
 */

import { EnvironmentalOverlay } from './types';

export class DeformationManager {
  private grid: Record<string, number> = {};
  private disturbanceGrid: Record<string, number> = {};
  private overlays: EnvironmentalOverlay[] = [];
  private gridSize = 2;

  private getKey(gx: number, gz: number): string {
    return `${gx},${gz}`;
  }

  /**
   * Applies a deformation to the terrain.
   */
  applyDeformation(x: number, z: number, radius: number, amount: number, type: 'raise' | 'lower') {
    const startX = Math.floor((x - radius) / this.gridSize);
    const endX = Math.ceil((x + radius) / this.gridSize);
    const startZ = Math.floor((z - radius) / this.gridSize);
    const endZ = Math.ceil((z + radius) / this.gridSize);

    for (let gx = startX; gx <= endX; gx++) {
      for (let gz = startZ; gz <= endZ; gz++) {
        const cx = gx * this.gridSize;
        const cz = gz * this.gridSize;
        const dist = Math.hypot(x - cx, z - cz);
        
        if (dist < radius) {
          const t = 1 - dist / radius;
          const weight = 3 * t * t - 2 * t * t * t;
          const key = this.getKey(gx, gz);
          const current = this.grid[key] || 0;
          const currentDisturbance = this.disturbanceGrid[key] || 0;
          
          const delta = amount * weight;
          
          if (type === 'raise') {
            this.grid[key] = current + delta;
          } else {
            this.grid[key] = current - delta;
          }
          
          // Accumulate disturbance (absolute change)
          this.disturbanceGrid[key] = currentDisturbance + Math.abs(delta);
        }
      }
    }
  }

  /**
   * Samples the cumulative height offset.
   */
  getHeightOffset(x: number, z: number): number {
    return this.sampleGrid(x, z, this.grid);
  }

  /**
   * Samples the disturbance level (0 = pristine, >0 = altered).
   */
  getDisturbance(x: number, z: number): number {
    return this.sampleGrid(x, z, this.disturbanceGrid);
  }

  private sampleGrid(x: number, z: number, data: Record<string, number>): number {
    const gx = x / this.gridSize;
    const gz = z / this.gridSize;
    
    const x0 = Math.floor(gx);
    const x1 = x0 + 1;
    const z0 = Math.floor(gz);
    const z1 = z0 + 1;

    const tx = gx - x0;
    const tz = gz - z0;

    const h00 = data[this.getKey(x0, z0)] || 0;
    const h10 = data[this.getKey(x1, z0)] || 0;
    const h01 = data[this.getKey(x0, z1)] || 0;
    const h11 = data[this.getKey(x1, z1)] || 0;

    const h0 = h00 * (1 - tx) + h10 * tx;
    const h1 = h01 * (1 - tx) + h11 * tx;

    return h0 * (1 - tz) + h1 * tz;
  }

  addOverlay(overlay: EnvironmentalOverlay) {
    this.overlays.push(overlay);
  }

  getOverlays(): EnvironmentalOverlay[] {
    return this.overlays;
  }

  clear() {
    this.grid = {};
    this.disturbanceGrid = {};
    this.overlays = [];
  }
}