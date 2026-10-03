import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('region river drawing', () => {
  it('draws the stored centerline without re-smoothing it', () => {
    // The artifact is now the single source of the course; smoothing at draw
    // would put a different line on the map than the one carved into terrain.
    const src = readFileSync('src/components/Worldforge/regionDraw.ts', 'utf8');
    expect(src).not.toMatch(/smoothRegionRiverCenterline\s*\(/);
  });
});
