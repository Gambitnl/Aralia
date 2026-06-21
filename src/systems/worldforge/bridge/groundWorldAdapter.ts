/**
 * @file groundWorldAdapter.ts — LocalArtifact → WorldData (slice 3 of the
 * Remy 2026-06-11 focus: Azgaar → submap → 3D world mode).
 *
 * World3D's whole pipeline (chunkSampler → chunkGeometry → chunkBundle →
 * streamer) consumes ONE input shape: `WorldData`. This adapter expresses an
 * L2 LocalArtifact (3,000 ft / 600×600 5-ft cells) as a WorldData so the
 * existing machinery can stream Worldforge ground terrain unchanged.
 *
 * ── UNIT CONTRACT (the load-bearing part) ──────────────────────────────────
 * World3D currently runs CONTINENT scale: WORLD3D_CONFIG.METERS_PER_CELL is
 * 1024 m per WorldData cell. Ground mode is WALKING scale: one LocalArtifact
 * cell is 5 ft = 1.524 m (GROUND_METERS_PER_CELL below). The DATA produced
 * here is correct for walking scale; the STREAMER must be parametrized
 * (config → per-world grid scale, coords.ts S/M from the instance) before
 * mounting it on this world — tracked as the slice-3b streamer task. Feeding
 * this WorldData through the streamer at METERS_PER_CELL=1024 would render a
 * 614 km continent out of a village green; do not do that.
 *
 * Heights: WorldData heights are 0..100 mapping linearly to
 * [0, MAX_TERRAIN_HEIGHT_M = 150 m] (world3d/config heightToMeters). We emit
 * ABSOLUTE-relief heights: (elevationFt − artifactMin) in meters → 0..100
 * domain, so 1 height unit = 1.5 m of real ground and the artifact's lowest
 * point sits at y = 0. Typical local relief (~10-60 m) lands in 0..40 —
 * intentionally NOT normalized to full range (that would turn a meadow into
 * the Alps).
 *
 * Biomes: TerrainMaterial → world3d palette ids (terrainColor PALETTE).
 * Rivers/roads/sites: empty in this slice — the artifact's water/paved
 * cells already carry through the material → biome mapping; polyline
 * networks join in slice 3b alongside the streamer work.
 */
import type { LocalArtifact, TerrainMaterial } from "../artifacts";
import type { WorldData } from "@/services/worldSim/types";
import { WORLD3D_CONFIG } from "../../world3d/config";

/** Walking-scale meters per LocalArtifact cell (5 ft). */
export const GROUND_METERS_PER_CELL = 1.524;

/**
 * world3d heightToMeters maps height 100 → MAX_TERRAIN_HEIGHT_M × the
 * continent VERTICAL_EXAGGERATION (12× — legible relief at 1 km cells).
 * Ground mode must render TRUE meters, so the encoding pre-divides by the
 * exaggeration: heightToMeters(encoded) === real ground meters.
 */
const HEIGHT_DOMAIN_M =
  WORLD3D_CONFIG.MAX_TERRAIN_HEIGHT_M * WORLD3D_CONFIG.VERTICAL_EXAGGERATION;

const FEET_TO_METERS = 0.3048;

/** TerrainMaterial → world3d terrainColor palette id. */
const MATERIAL_BIOME: Record<TerrainMaterial, string> = {
  grass: "plains",
  dirt: "plains",
  rock: "mountain",
  sand: "desert",
  wetland: "wetland",
  water: "water",
  paved: "mountain", // stone-grey reads as paving until a real material lands
  floor: "plains",
};

/**
 * Express a LocalArtifact as WorldData for the world3d pipeline.
 * Deterministic and allocation-light: one pass over the 360k cells.
 */
export function localArtifactToWorldData(
  local: LocalArtifact,
  seed: number,
): WorldData {
  const { widthCells, heightCells, elevationFt, materialIndex, materials } = local.terrain;

  // Artifact minimum anchors y = 0 (see unit contract above)
  let minElev = Infinity;
  for (let i = 0; i < elevationFt.length; i++) {
    if (elevationFt[i] < minElev) minElev = elevationFt[i];
  }

  const heights: number[] = new Array(elevationFt.length);
  for (let i = 0; i < elevationFt.length; i++) {
    const meters = (elevationFt[i] - minElev) * FEET_TO_METERS;
    heights[i] = Math.max(0, Math.min(100, (meters / HEIGHT_DOMAIN_M) * 100));
  }

  // No-fallback directive (2026-06-15): an unmapped material or an
  // out-of-range material index surfaces honestly instead of silently
  // collapsing to "plains" — a corrupt artifact must fail loudly, not render
  // a fake meadow over the real terrain.
  const biomeNameByIndex = materials.map((m) => {
    const biome = MATERIAL_BIOME[m];
    if (biome === undefined) {
      throw new Error(
        `[groundWorldAdapter] material '${m}' has no biome mapping`,
      );
    }
    return biome;
  });
  const biomeIds: string[] = new Array(materialIndex.length);
  for (let i = 0; i < materialIndex.length; i++) {
    const biome = biomeNameByIndex[materialIndex[i]];
    if (biome === undefined) {
      throw new Error(
        `[groundWorldAdapter] material index ${materialIndex[i]} at cell ${i} ` +
          `is out of range (materials.length=${materials.length})`,
      );
    }
    biomeIds[i] = biome;
  }

  return {
    version: 2,
    seed,
    templateId: `worldforge-local:${local.seedPath}`,
    gridSize: { rows: heightCells, cols: widthCells },
    heights,
    temperatures: new Array(elevationFt.length).fill(15),
    moisture: new Array(elevationFt.length).fill(50),
    biomeIds,
    rivers: [],
    roads: [],
    sites: [],
    coastlines: [],
    lakes: [],
  } as unknown as WorldData;
}
