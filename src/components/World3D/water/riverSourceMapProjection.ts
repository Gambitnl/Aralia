/**
 * Retains the fixed course coordinates of the waterfall's approach texture.
 * Floods still rebuild every hydraulic texel at the original cadence. Only
 * course projection and tangent lookup are reused until their geometry changes.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/10/2026, 03:55:46
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

interface ProjectionCourse {
  project(x: number, z: number): { s: number; n: number };
  at(s: number): { tx: number; tz: number };
}
interface ProjectionGrid { x0: number; z0: number; dx: number; nx: number; nz: number }
interface ProjectionCrest { x: number; z: number; tx: number; tz: number }
const entries = new WeakMap<object, { course: ProjectionCourse; key: string; values: Float64Array }>();

/** Five original double-precision results per cell: s, n, tx, tz, crest-forward. */
export function riverSourceMapProjection(owner: object, course: ProjectionCourse, grid: ProjectionGrid, crest: ProjectionCrest): Float64Array {
  const key = [grid.x0, grid.z0, grid.dx, grid.nx, grid.nz, crest.x, crest.z, crest.tx, crest.tz].join('/');
  const previous = entries.get(owner);
  if (previous?.course === course && previous.key === key) return previous.values;
  const values = new Float64Array(grid.nx * grid.nz * 5);
  for (let c = 0; c < grid.nx * grid.nz; c++) {
    const x = grid.x0 + (c % grid.nx + 0.5) * grid.dx;
    const z = grid.z0 + (Math.floor(c / grid.nx) + 0.5) * grid.dx;
    const pr = course.project(x, z), p = course.at(pr.s), offset = c * 5;
    values[offset] = pr.s; values[offset + 1] = pr.n;
    values[offset + 2] = p.tx; values[offset + 3] = p.tz;
    values[offset + 4] = (x - crest.x) * crest.tx + (z - crest.z) * crest.tz;
  }
  // Courses are immutable instances; a real course edit supplies a new course.
  // Width, depth and discharge do not enter this geometry-only cache.
  entries.set(owner, { course, key, values });
  return values;
}
