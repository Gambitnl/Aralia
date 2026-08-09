/**
 * Shaping the ground: the edits a spell or a shovel makes to the volume.
 *
 * Two families, and the difference between them is the whole design.
 *
 * ABSOLUTE shapes — a sphere, a box — are centered on a point in space and cut
 * or fill exactly that region. A blast crater is a sphere. A cellar is a box.
 * They do not care what the ground was doing.
 *
 * SURFACE-RELATIVE shapes — a ditch, a hill — take a footprint and work from
 * whatever the ground height is under each column. A ditch dug across a slope
 * follows the slope; a ditch cut as a box would surface at one end and bury
 * itself at the other. This is the shape almost every player-facing earthwork
 * actually wants, and it is the one a naive "subtract a cuboid" cannot express.
 *
 * Filled material comes from the layer stack, keyed on depth below the NEW
 * surface. Raised ground therefore grows litter on top and subsoil underneath,
 * instead of being one flat tone that reads as clay dropped on a lawn. That
 * needs two passes: the first finds each column's new top, the second assigns
 * material by depth beneath it.
 */
import { Material, VoxelVolume } from './voxelVolume';
import { GroundBand, DEFAULT_STACK, substanceAtDepth } from './materials';

export type BrushShape = 'sphere' | 'box' | 'ditch' | 'hill';
export type BrushMode = 'dig' | 'raise';

export interface Brush {
  shape: BrushShape;
  mode: BrushMode;
  /** Half-extent in meters: sphere radius, box half-width, ditch half-width. */
  radiusM: number;
  /** How deep a ditch cuts, or how tall a hill rises. Meters. */
  heightM?: number;
  /** Ditch length in meters. Ignored by the other shapes. */
  lengthM?: number;
  /** Which way a ditch runs. */
  axis?: 'x' | 'z';
}

export interface BrushTarget {
  volume: VoxelVolume;
  cellM: number;
  originM: readonly [number, number, number];
}

export interface BrushResult {
  /** Cells whose material changed. Zero means the brush missed. */
  changed: number;
  /** Inclusive cell bounds touched, for a caller that re-meshes a region. */
  min: [number, number, number];
  max: [number, number, number];
}

/** Topmost solid cell in a column, or -1 when the column is empty. */
export function topSolidCell(vol: VoxelVolume, x: number, z: number): number {
  for (let y = vol.cells - 1; y >= 0; y--) {
    if (vol.get(x, y, z) !== Material.Air) return y;
  }
  return -1;
}

/**
 * Apply a brush and report what it touched.
 *
 * `centerM` is a world point — normally where the player pointed, which the ray
 * already returns in meters. Nothing here takes cell indices, because every
 * caller has meters and the conversion is this module's business.
 */
export function applyBrush(
  t: BrushTarget,
  centerM: readonly [number, number, number],
  brush: Brush,
  stack: readonly GroundBand[] = DEFAULT_STACK,
): BrushResult {
  const { volume, cellM, originM } = t;
  const n = volume.cells;

  const toCell = (m: number, o: number) => Math.floor((m - o) / cellM);
  const cx = toCell(centerM[0], originM[0]);
  const cy = toCell(centerM[1], originM[1]);
  const cz = toCell(centerM[2], originM[2]);

  const r = Math.max(1, Math.round(brush.radiusM / cellM));
  const h = Math.max(1, Math.round((brush.heightM ?? brush.radiusM) / cellM));
  const half = Math.max(1, Math.round((brush.lengthM ?? brush.radiusM * 6) / cellM / 2));

  let changed = 0;
  const min: [number, number, number] = [n, n, n];
  const max: [number, number, number] = [-1, -1, -1];
  /** Columns this brush filled, so material can be assigned by depth after. */
  const filled: number[] = [];

  const write = (x: number, y: number, z: number, m: Material): void => {
    if (x < 0 || y < 0 || z < 0 || x >= n || y >= n || z >= n) return;
    if (volume.get(x, y, z) === m) return;
    volume.set(x, y, z, m);
    changed++;
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
    if (m !== Material.Air) filled.push(x, y, z);
  };

  // Placeholder while filling; the second pass replaces it with the real
  // substance for that depth. Writing the final material here is impossible,
  // because a column's new top is not known until its last cell is placed.
  const FILL = Material.Subsoil;

  if (brush.shape === 'sphere' || brush.shape === 'box') {
    const r2 = r * r;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let z = cz - r; z <= cz + r; z++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (brush.shape === 'sphere') {
            const dx = x - cx;
            const dy = y - cy;
            const dz = z - cz;
            if (dx * dx + dy * dy + dz * dz > r2) continue;
          }
          write(x, y, z, brush.mode === 'dig' ? Material.Air : FILL);
        }
      }
    }
  } else {
    /* Surface-relative. The footprint is a rectangle; the vertical extent comes
     * from each column's own ground height.
     *
     * A ditch cut as a box would surface at the uphill end and bury itself at
     * the downhill end. Following the ground is what makes it a ditch. */
    const alongX = (brush.axis ?? 'x') === 'x';
    const halfX = alongX ? half : r;
    const halfZ = alongX ? r : half;

    for (let z = cz - halfZ; z <= cz + halfZ; z++) {
      for (let x = cx - halfX; x <= cx + halfX; x++) {
        if (x < 0 || z < 0 || x >= n || z >= n) continue;

        // Round the ends and the cross-section, so it is a channel and not a
        // slot with square corners a player can see from any angle.
        const u = (x - cx) / (halfX + 0.5);
        const v = (z - cz) / (halfZ + 0.5);
        const fall = 1 - Math.min(1, u * u + v * v);
        if (fall <= 0) continue;

        const top = topSolidCell(volume, x, z);
        if (top < 0) continue;
        const reach = Math.max(1, Math.round(h * fall));

        if (brush.shape === 'ditch') {
          for (let y = top; y > top - reach; y--) write(x, y, z, Material.Air);
        } else {
          for (let y = top + 1; y <= top + reach; y++) write(x, y, z, FILL);
        }
      }
    }
  }

  /* Second pass: give the new ground its layers.
   *
   * Material is a function of depth below the surface, and the surface only
   * exists once every cell of the column has been placed. Assigning during the
   * fill gives one flat tone, which reads as clay dropped on a lawn. */
  for (let i = 0; i < filled.length; i += 3) {
    const x = filled[i];
    const y = filled[i + 1];
    const z = filled[i + 2];
    const top = topSolidCell(volume, x, z);
    if (top < 0) continue;
    const depthM = (top - y) * cellM;
    volume.set(x, y, z, substanceAtDepth(depthM, stack).id);
  }

  if (changed === 0) return { changed: 0, min: [0, 0, 0], max: [-1, -1, -1] };
  return { changed, min, max };
}
