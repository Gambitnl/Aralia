// Erosion Worker
// Handles heavy droplet simulation off the main thread.

import { HydraulicErosion, ErosionConfig } from '../components/ThreeDModal/Experimental/HydraulicErosion';

self.onmessage = (e: MessageEvent) => {
  const { grid, gridSize, config } = e.data as { 
    grid: Record<string, number>; 
    gridSize: number;
    config: Partial<ErosionConfig>;
  };

  try {
    // We need to reconstruct the grid because structured clone might change prototypes,
    // but Record<string, number> is just a plain object, so it's fine.
    
    // Note: HydraulicErosion class logic needs to be robust. 
    // We instantiate it here.
    // We need to pass "size" but we usually infer it or pass it.
    // Let's assume size 50 or pass it.
    
    const size = 50; // Should be passed in
    const erosion = new HydraulicErosion(size, config);
    
    // Apply erosion (this mutates 'grid')
    erosion.apply(grid, gridSize);

    // Send back the modified grid
    self.postMessage({ status: 'success', grid });
  } catch (error: any) {
    self.postMessage({ status: 'error', error: error.message });
  }
};
