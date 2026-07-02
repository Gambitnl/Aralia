/**
 * @file stitchLocalArtifacts.ts — join two L2 LocalArtifacts into one wider
 * artifact (open-region seam-first slice, 2026-07-01).
 *
 * The open-region design (docs/superpowers/specs/2026-06-29-open-region-
 * wilderness-design.md) needs neighbouring locales rendered as ONE ground
 * surface so a region→region boundary is walkable. The ground pipeline
 * consumes a single LocalArtifact, so the smallest honest step is stitching
 * two exactly-adjacent locales into one before the ground adapter re-anchors
 * heights — the join then sits mid-array where no edge fall-off applies, and
 * any height cliff at the boundary comes from the GENERATORS, not the view.
 *
 * Pure array surgery: elevations and world-feet feature positions ride
 * through untouched (both locales' elevationFt share the region-normalized
 * ×2000 datum, so values are directly comparable). Material palettes are
 * merged by name with B's indices remapped. No-fallback directive: locales
 * that are not exactly adjacent throw instead of snapping.
 */
import type { LocalArtifact, TerrainMaterial } from '../artifacts';
import { childSeedPath } from '../seedPath';

/** Max bounds mismatch (ft) still considered "exactly adjacent". */
const ADJACENCY_EPSILON_FT = 1e-3;

/**
 * Stitch locale `b` onto the east edge of locale `a`.
 * Requires: a.bounds.x + a.bounds.width === b.bounds.x, identical y/height
 * rows, identical cell size. Returns a new artifact; inputs are not mutated.
 */
export function stitchLocalsEastWest(a: LocalArtifact, b: LocalArtifact): LocalArtifact {
  const ta = a.terrain;
  const tb = b.terrain;
  if (Math.abs(a.bounds.x + a.bounds.width - b.bounds.x) > ADJACENCY_EPSILON_FT) {
    throw new Error(
      `[stitchLocals] locales are not adjacent east-west: A ends at x=` +
        `${a.bounds.x + a.bounds.width}, B starts at x=${b.bounds.x}`,
    );
  }
  if (
    Math.abs(a.bounds.y - b.bounds.y) > ADJACENCY_EPSILON_FT ||
    Math.abs(a.bounds.height - b.bounds.height) > ADJACENCY_EPSILON_FT ||
    ta.heightCells !== tb.heightCells
  ) {
    throw new Error(
      `[stitchLocals] locales are not row-aligned (adjacent stitch needs ` +
        `identical y extents): A y=${a.bounds.y}×${a.bounds.height}/${ta.heightCells} ` +
        `vs B y=${b.bounds.y}×${b.bounds.height}/${tb.heightCells}`,
    );
  }

  // Merge material palettes by name; remap B's per-cell indices.
  const materials: TerrainMaterial[] = [...ta.materials];
  const bIndexMap = tb.materials.map((m) => {
    const existing = materials.indexOf(m);
    if (existing >= 0) return existing;
    materials.push(m);
    return materials.length - 1;
  });

  const widthCells = ta.widthCells + tb.widthCells;
  const heightCells = ta.heightCells;
  const elevationFt = new Float32Array(widthCells * heightCells);
  const materialIndex = new Uint8Array(widthCells * heightCells);
  for (let cy = 0; cy < heightCells; cy++) {
    const rowOut = cy * widthCells;
    elevationFt.set(ta.elevationFt.subarray(cy * ta.widthCells, (cy + 1) * ta.widthCells), rowOut);
    materialIndex.set(
      ta.materialIndex.subarray(cy * ta.widthCells, (cy + 1) * ta.widthCells),
      rowOut,
    );
    for (let cx = 0; cx < tb.widthCells; cx++) {
      const iB = cy * tb.widthCells + cx;
      elevationFt[rowOut + ta.widthCells + cx] = tb.elevationFt[iB];
      materialIndex[rowOut + ta.widthCells + cx] = bIndexMap[tb.materialIndex[iB]];
    }
  }

  // Features keep world-feet positions; B's ids shift past A's to stay unique
  // (delta layer keys off feature id, so collisions would cross-wire edits).
  const idBase = a.features.reduce((m, f) => Math.max(m, f.id), -1) + 1;
  const features = [
    ...a.features,
    ...b.features.map((f) => ({ ...f, id: idBase + f.id })),
  ];

  return {
    layer: 'local',
    schemaVersion: a.schemaVersion,
    seedPath: childSeedPath(a.seedPath, 'stitched:east'),
    bounds: {
      x: a.bounds.x,
      y: a.bounds.y,
      width: a.bounds.width + b.bounds.width,
      height: a.bounds.height,
    },
    terrain: { widthCells, heightCells, elevationFt, materialIndex, materials },
    features,
    // Bare-ground slice: town plans stay per-locale; the stitched artifact is
    // wilderness-only (the seam proof renders no towns).
  };
}
