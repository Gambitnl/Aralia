import { describe, it, expect } from 'vitest';
import { terrainToGround } from '../groundPainter';

describe('terrainToGround', () => {
  it('maps every mechanical terrain to a paint ground', () => {
    expect(terrainToGround('grass')).toBe('grass');
    expect(terrainToGround('mud')).toBe('grass');
    expect(terrainToGround('difficult')).toBe('grass');
    expect(terrainToGround('water')).toBe('water');
    expect(terrainToGround('wall')).toBe('stone');
    expect(terrainToGround('rock')).toBe('dirt');
    expect(terrainToGround('stone')).toBe('dirt');
    expect(terrainToGround('floor')).toBe('dirt');
    expect(terrainToGround('sand')).toBe('sand');
  });
  it('defaults unknown terrain to grass', () => {
    expect(terrainToGround('???')).toBe('grass');
  });
});
