// src/components/BattleMap/pixi/__tests__/cameraMath.test.ts
import { describe, it, expect } from 'vitest';
import { clampZoom, zoomAtCursor, panBy, fitView, groundResolutionFor } from '../cameraMath';

describe('clampZoom', () => {
  it('bounds zoom to [0.15, 4]', () => {
    expect(clampZoom(0.01)).toBe(0.15);
    expect(clampZoom(99)).toBe(4);
    expect(clampZoom(1)).toBe(1);
  });
});

describe('zoomAtCursor', () => {
  it('keeps the world point under the cursor stationary', () => {
    const view = { x: 100, y: 50, zoom: 1 };
    const cursor = { x: 200, y: 100 };
    // World point under cursor before: (100 + 200/1, 50 + 100/1) = (300, 150)
    const next = zoomAtCursor(view, 2, cursor);
    expect(next.zoom).toBe(2);
    // Same world point must still sit at cursor: x + 200/2 === 300
    expect(next.x + cursor.x / next.zoom).toBeCloseTo(300);
    expect(next.y + cursor.y / next.zoom).toBeCloseTo(150);
  });
  it('clamps the resulting zoom', () => {
    expect(zoomAtCursor({ x: 0, y: 0, zoom: 3.9 }, 10, { x: 0, y: 0 }).zoom).toBe(4);
  });
});

describe('panBy', () => {
  it('converts viewport pixels to world units at current zoom', () => {
    const next = panBy({ x: 10, y: 10, zoom: 2 }, -30, 8);
    expect(next.x).toBeCloseTo(25);  // 10 - (-30)/2
    expect(next.y).toBeCloseTo(6);   // 10 - 8/2
  });
});

describe('fitView', () => {
  it('centers a small map in a large viewport at zoom ≤ its fit scale', () => {
    const v = fitView(1000, 500, 2000, 2000);
    expect(v.zoom).toBeCloseTo(2000 / 1000 > 2000 / 500 ? 2000 / 500 : 2000 / 1000);
  });
  it('centers exactly', () => {
    const v = fitView(1000, 500, 2000, 1000);
    // fit zoom = min(2000/1000, 1000/500) = 2
    expect(v.zoom).toBe(2);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
  });
});

describe('groundResolutionFor', () => {
  it('never drops below 1', () => {
    expect(groundResolutionFor(0.2, 1, 100_000, 100_000)).toBe(1);
  });
  it('rises with zoom and caps at 4', () => {
    const lo = groundResolutionFor(1, 1, 1000, 1000);
    const hi = groundResolutionFor(3, 1, 1000, 1000);
    expect(hi).toBeGreaterThan(lo);
    expect(groundResolutionFor(10, 3, 100, 100)).toBe(4);
  });
});
