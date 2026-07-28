/**
 * @file waterRegions.ts
 * @description Group a ground grid's water cells into BODIES, and give each body
 * one flat surface level.
 *
 * Why this exists: the open world marks water only as a biome tint on the
 * terrain, so a lake is blue ground rather than a surface. An in-game look at
 * burg Hajdured photographed a sea-sized expanse that raycasts proved was
 * terrain — no water mesh anywhere in the frame. Laying real sheets needs two
 * things this file provides: which cells belong to the same body, and what one
 * height that body sits at.
 *
 * Levels are resolved HERE, over the whole grid, rather than per chunk. A body
 * that spans several chunks must get the same level in each of them or the
 * surface steps at every chunk seam.
 *
 * Pure and deterministic: same grid in, identical regions out, in a stable order.
 */

/** One connected body of water and the flat height its surface sits at. */
export interface WaterRegion {
  /** Cell indices (row * cols + col) that belong to this body. */
  cells: number[];
  /** Flat surface height for the whole body, in ENCODED grid units (0..100). */
  surfaceEnc: number;
  /** Lowest surrounding land height in encoded units — the body's rim. */
  shoreEnc: number;
}

export interface FindWaterRegionsInput {
  cols: number;
  rows: number;
  /** Per-cell biome id; 'water' and 'ocean' are the wet ones. */
  biomeIds: readonly string[];
  /** Per-cell encoded terrain height (0..100). */
  heights: readonly number[];
  /** How far below its rim a surface sits, in encoded units. */
  surfaceDropEnc: number;
}

const isWet = (biome: string | undefined): boolean => biome === 'water' || biome === 'ocean';

/**
 * Find every connected body of water and the level its surface sits at.
 *
 * Connectivity is 4-way on purpose: two ponds touching only at a corner are two
 * ponds, and joining them would force one flat level across a diagonal ridge.
 *
 * A body's level comes from the LOWEST land cell around its rim, minus the
 * surface drop — the point where it would spill. Taking the water cells' own
 * heights instead would put the surface at the bed, and taking the highest rim
 * cell would let it flood over the low side.
 */
export function findWaterRegions(input: FindWaterRegionsInput): WaterRegion[] {
  const { cols, rows, biomeIds, heights, surfaceDropEnc } = input;
  const total = cols * rows;
  const seen = new Uint8Array(total);
  const regions: WaterRegion[] = [];

  for (let start = 0; start < total; start++) {
    if (seen[start] || !isWet(biomeIds[start])) continue;

    // Flood fill this body. An explicit stack keeps a lake the size of a chunk
    // grid from blowing the call stack.
    const cells: number[] = [];
    let shoreEnc = Infinity;
    let highestWaterEnc = 0;
    const stack = [start];
    seen[start] = 1;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      cells.push(idx);
      highestWaterEnc = Math.max(highestWaterEnc, heights[idx] ?? 0);

      const col = idx % cols;
      const row = (idx - col) / cols;
      const neighbours = [
        col > 0 ? idx - 1 : -1,
        col < cols - 1 ? idx + 1 : -1,
        row > 0 ? idx - cols : -1,
        row < rows - 1 ? idx + cols : -1,
      ];
      for (const n of neighbours) {
        if (n < 0) continue;
        if (isWet(biomeIds[n])) {
          if (!seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        } else {
          // Land neighbour — part of this body's rim.
          shoreEnc = Math.min(shoreEnc, heights[n] ?? 0);
        }
      }
    }

    // A body with no land around it (it reaches every edge of the grid) has no
    // rim to read, so fall back to its own highest cell.
    const rim = Number.isFinite(shoreEnc) ? shoreEnc : highestWaterEnc;
    cells.sort((a, b) => a - b); // stable output regardless of fill order
    regions.push({
      cells,
      shoreEnc: rim,
      surfaceEnc: Math.max(0, rim - surfaceDropEnc),
    });
  }

  return regions;
}
