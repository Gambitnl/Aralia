/**
 * @file streamedSurface.ts — the height the streamed world actually DRAWS.
 *
 * `groundSurfaceY` answers "how high is the ground here" from the artifact's
 * 1.524 m cell grid. That is the right answer for planting a prop or a player,
 * and the WRONG one for joining a mesh: the streamed terrain does not draw that
 * surface. `sampleGroundChunk` samples it on a coarse lattice — one vertex
 * every `CHUNK_WORLD_SIZE / (HEIGHTFIELD_RESOLUTION - 1)` meters, 8 m at full
 * detail — and draws straight quads between those vertices. Every ripple
 * finer than 8 m is absent from the picture.
 *
 * A volume bubble filled from `groundSurfaceY` therefore carries detail the
 * terrain around it does not have, and the two disagree by however much relief
 * lives inside one 8 m quad. On a forested hillside that is a metre. It reads
 * as a torn edge where the bubble meets the world, which is exactly the seam
 * this campaign exists to remove.
 *
 * So the bubble is filled from THIS function: the same lattice, bilinear
 * between the same vertices. What the bubble adds is not horizontal detail, it
 * is DEPTH — the inside of the ground, which no heightfield has at any
 * resolution.
 *
 * AND THE TRIANGULATION IS PART OF THE ANSWER, not a rounding detail.
 *
 * The first cut of this file interpolated the four corners bilinearly and said
 * so in a comment: a triangle pair differs from the bilinear patch by at most a
 * quarter of the quad's twist, which is "far below the volume's own 25 cm
 * quantization". That is true on a hillside and false on a mountain. Cell 1240
 * has eight metres of relief inside one 8 m quad, so the twist is metres, and
 * the bubble came out perforated — the terrain poked up through it in holes
 * across the middle of a bubble that was supposed to be covering it.
 *
 * `chunkGeometry` splits every quad on the ANTI-diagonal, emitting
 * (a, c, b) then (b, c, d) for corners a=(i,j) b=(i+1,j) c=(i,j+1)
 * d=(i+1,j+1). So the sampler picks its triangle by `fx + fz` and evaluates
 * that plane. It is the same arithmetic cost as the bilinear form and it is
 * exact instead of nearly right.
 *
 * One case it does not cover: at an LOD boundary `chunkGeometry` replaces the
 * border row with a stitch band. That is 100 m or more from the player, well
 * outside any bubble.
 */
import { groundSurfaceY, type GroundWorld } from './groundChunkLoader';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';

/** Meters between terrain lattice vertices at full detail. 8 m today. */
export const TERRAIN_LATTICE_M =
  WORLD3D_CONFIG.CHUNK_WORLD_SIZE / (WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION - 1);

/**
 * The drawn terrain height at a world point, meters.
 *
 * The lattice is global and anchored at the world origin, because chunk `cx`
 * puts its vertices at `cx * CHUNK_WORLD_SIZE + i * TERRAIN_LATTICE_M` and
 * `CHUNK_WORLD_SIZE` is a whole multiple of the step. Neighboring chunks
 * therefore share their border vertices exactly, and so does this sampler.
 */
export function streamedTerrainSurfaceY(ground: GroundWorld, xM: number, zM: number): number {
  const s = TERRAIN_LATTICE_M;
  const gx = xM / s;
  const gz = zM / s;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const fx = gx - x0;
  const fz = gz - z0;
  const h00 = groundSurfaceY(ground, x0 * s, z0 * s);
  const h10 = groundSurfaceY(ground, (x0 + 1) * s, z0 * s);
  const h01 = groundSurfaceY(ground, x0 * s, (z0 + 1) * s);
  const h11 = groundSurfaceY(ground, (x0 + 1) * s, (z0 + 1) * s);
  // The quad is split on the anti-diagonal, so `fx + fz` names the triangle.
  return fx + fz <= 1
    ? h00 + (h10 - h00) * fx + (h01 - h00) * fz
    : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
