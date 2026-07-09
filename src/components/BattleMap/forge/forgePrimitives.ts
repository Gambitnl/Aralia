/**
 * @file forgePrimitives.ts
 * Shared low-level helpers for the procedural asset forge — the code-drawn,
 * seeded, owned art style for battle-map props. Each asset set (cave, etc.)
 * builds on these.
 */

export const TAU = Math.PI * 2;

/** Small fast seeded PRNG (mulberry32). Same seed → same asset, every time. */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Pt = { x: number; y: number };

export const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/** Fill a closed polygon. */
export function poly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
