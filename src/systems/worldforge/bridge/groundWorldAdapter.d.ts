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
import type { LocalArtifact } from "../artifacts";
import type { WorldData } from "@/services/worldSim/types";
/** Walking-scale meters per LocalArtifact cell (5 ft). */
export declare const GROUND_METERS_PER_CELL = 1.524;
/**
 * Express a LocalArtifact as WorldData for the world3d pipeline.
 * Deterministic and allocation-light: one pass over the 360k cells.
 */
export declare function localArtifactToWorldData(local: LocalArtifact, seed: number): WorldData;
