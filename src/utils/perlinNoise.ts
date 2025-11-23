/**
 * @file perlinNoise.ts
 * A simple implementation of Perlin noise for procedural generation.
 */
import { SeededRandom } from './seededRandom';

export class PerlinNoise {
  private permutation: number[] = [];

  constructor(seed: number) {
    const random = new SeededRandom(seed);
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle p
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(random.next() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    this.permutation = p.concat(p);
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public get(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = this.fade(x);
    const v = this.fade(y);

    const p = this.permutation;
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    
    return this.lerp(v,
      this.lerp(u, this.grad(p[A], x, y, 0), this.grad(p[B], x - 1, y, 0)),
      this.lerp(u, this.grad(p[A + 1], x, y - 1, 0), this.grad(p[B + 1], x - 1, y - 1, 0))
    );
  }
}
