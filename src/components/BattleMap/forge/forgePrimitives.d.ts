/**
 * @file forgePrimitives.ts
 * Shared low-level helpers for the procedural asset forge — the code-drawn,
 * seeded, owned art style for battle-map props. Each asset set (cave, etc.)
 * builds on these.
 */
export declare const TAU: number;
/** Small fast seeded PRNG (mulberry32). Same seed → same asset, every time. */
export declare function mulberry32(a: number): () => number;
export type Pt = {
    x: number;
    y: number;
};
export declare const mid: (p: Pt, q: Pt) => Pt;
/** Fill a closed polygon. */
export declare function poly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string): void;
