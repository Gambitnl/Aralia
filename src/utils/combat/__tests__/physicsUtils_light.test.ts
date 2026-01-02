
import { describe, it, expect } from 'vitest';
import { calculateLightLevel, getCombinedLightLevel, calculateChebyshevDistance } from '../physicsUtils';
import { Position } from '../../../types/combat';

describe('physicsUtils - Light Mechanics', () => {
  describe('calculateChebyshevDistance', () => {
    it('calculates cardinal distance correctly', () => {
      const p1: Position = { x: 0, y: 0 };
      const p2: Position = { x: 0, y: 4 }; // 4 tiles away
      expect(calculateChebyshevDistance(p1, p2)).toBe(20);
    });

    it('calculates diagonal distance correctly (5-5-5 rule)', () => {
      const p1: Position = { x: 0, y: 0 };
      const p2: Position = { x: 3, y: 3 }; // 3 tiles diagonal
      // max(3, 3) * 5 = 15
      expect(calculateChebyshevDistance(p1, p2)).toBe(15);
    });

    it('calculates mixed distance correctly', () => {
      const p1: Position = { x: 0, y: 0 };
      const p2: Position = { x: 2, y: 5 }; // 2 over, 5 down
      // max(2, 5) * 5 = 25
      expect(calculateChebyshevDistance(p1, p2)).toBe(25);
    });
  });

  describe('calculateLightLevel', () => {
    // Standard Torch: 20ft bright, 20ft dim
    const TORCH_BRIGHT = 20;
    const TORCH_DIM = 20;
    const origin: Position = { x: 10, y: 10 };

    it('returns bright light within bright radius', () => {
      const target: Position = { x: 12, y: 10 }; // 10ft away
      expect(calculateLightLevel(target, origin, TORCH_BRIGHT, TORCH_DIM)).toBe('bright');
    });

    it('returns bright light at the edge of bright radius', () => {
      const target: Position = { x: 14, y: 10 }; // 20ft away (4 tiles)
      expect(calculateLightLevel(target, origin, TORCH_BRIGHT, TORCH_DIM)).toBe('bright');
    });

    it('returns dim light just outside bright radius', () => {
      const target: Position = { x: 15, y: 10 }; // 25ft away
      expect(calculateLightLevel(target, origin, TORCH_BRIGHT, TORCH_DIM)).toBe('dim');
    });

    it('returns dim light at the edge of dim radius', () => {
      // Total radius = 20 + 20 = 40ft (8 tiles)
      const target: Position = { x: 18, y: 10 }; // 40ft away
      expect(calculateLightLevel(target, origin, TORCH_BRIGHT, TORCH_DIM)).toBe('dim');
    });

    it('returns darkness outside total radius', () => {
      const target: Position = { x: 19, y: 10 }; // 45ft away
      expect(calculateLightLevel(target, origin, TORCH_BRIGHT, TORCH_DIM)).toBe('darkness');
    });

    it('handles diagonals correctly for light', () => {
      // 4 tiles diagonal = 20ft (Bright limit)
      const targetBright: Position = { x: 14, y: 14 };
      expect(calculateLightLevel(targetBright, origin, TORCH_BRIGHT, TORCH_DIM)).toBe('bright');

      // 5 tiles diagonal = 25ft (Dim start)
      const targetDim: Position = { x: 15, y: 15 };
      expect(calculateLightLevel(targetDim, origin, TORCH_BRIGHT, TORCH_DIM)).toBe('dim');
    });
  });

  describe('getCombinedLightLevel', () => {
    const origin1: Position = { x: 0, y: 0 };
    const origin2: Position = { x: 10, y: 0 }; // 50ft away

    const source1 = { position: origin1, brightRadius: 20, dimRadius: 20 };
    const source2 = { position: origin2, brightRadius: 20, dimRadius: 20 };
    const sources = [source1, source2];

    it('returns bright if covered by any bright source', () => {
      // Close to source 1 (10ft)
      const target: Position = { x: 2, y: 0 };
      expect(getCombinedLightLevel(target, sources)).toBe('bright');
    });

    it('returns dim if covered only by dim sources', () => {
      // Between sources (25ft from both if they were closer, here 25ft from source 1)
      const target: Position = { x: 5, y: 0 }; // 25ft from source 1, 25ft from source 2
      // Source 1: Dim (25 > 20)
      // Source 2: Dim (25 > 20)
      expect(getCombinedLightLevel(target, sources)).toBe('dim');
    });

    it('returns bright if in dim of one but bright of another', () => {
       // Move source 2 closer so they overlap
       const closeSource2 = { position: { x: 6, y: 0 }, brightRadius: 20, dimRadius: 20 }; // 30ft away from origin1

       // Target at x=5 (25ft from source 1 [Dim], 5ft from source 2 [Bright])
       const target: Position = { x: 5, y: 0 };
       expect(getCombinedLightLevel(target, [source1, closeSource2])).toBe('bright');
    });

    it('returns darkness if covered by no sources', () => {
      const target: Position = { x: 0, y: 100 }; // Far away
      expect(getCombinedLightLevel(target, sources)).toBe('darkness');
    });
  });
});
