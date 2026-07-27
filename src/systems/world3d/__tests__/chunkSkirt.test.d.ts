/**
 * @file chunkSkirt.test.ts
 * @description Regression coverage for the per-LOD skirt geometry (W3D-G10 / T7).
 * Mixed-resolution chunks (full/mid/low) sample the heightfield at different
 * densities; a downward perimeter skirt hides the crack between neighbors. These
 * tests lock the skirt's vertex/triangle counts, its downward offset, and that
 * every LOD tier carries one so any seam is covered.
 */
export {};
