import { DeformationManager } from '../DeformationManager';
import { describe, it, expect } from 'vitest';

describe('DeformationManager', () => {
  it('should apply raise deformation correctly', () => {
    const manager = new DeformationManager();
    // Center point (0,0) with radius 10, amount 5
    manager.applyDeformation(0, 0, 10, 5, 'raise');
    
    // Sample at center should be 5
    expect(manager.getHeightOffset(0, 0)).toBeCloseTo(5, 1);
    
    // Sample at edge (10,0) should be 0
    expect(manager.getHeightOffset(10, 0)).toBeCloseTo(0, 1);
    
    // Sample outside should be 0
    expect(manager.getHeightOffset(20, 0)).toBe(0);
  });

  it('should interpolate between grid points', () => {
    const manager = new DeformationManager();
    manager.applyDeformation(0, 0, 10, 5, 'raise');
    
    const h1 = manager.getHeightOffset(0, 0);
    const h2 = manager.getHeightOffset(2, 0);
    const hInterp = manager.getHeightOffset(1, 0);
    
    expect(hInterp).toBeGreaterThan(h2);
    expect(hInterp).toBeLessThan(h1);
  });
});
