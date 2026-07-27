/**
 * @file voronoiTownAdapter.ts — Voronoi-ward town → roster/motion plan.
 *
 * `townEngine.generateTownPlan` produces the owned Voronoi-ward town (wards with
 * packed building plots, civic structures, walls, outskirts). The roster + agent
 * motion pipeline (`generateTownRoster`, `buildStreetGraph`, `townMotionSnapshotAt`)
 * speak the flatter `artifacts.TownPlan` (a flat `plots[]` with roles + street
 * centerlines). This adapter bridges them so the behaviour sim can run on a real
 * ward town instead of the radial demo burg:
 *
 *  • Ward building plots → `house` plots, with ~1 in 6 promoted to a `workshop`
 *    (a job) so the roster has somewhere to send workers.
 *  • Civic structures → roles the roster understands: plaza → `market` (shops +
 *    a gathering place), dock → `workshop`, temple/keep/citadel → civic buildings.
 *  • Streets: a ward town's walkable network IS the gaps between blocks, i.e. the
 *    ward (Voronoi) edges — so every ward polygon edge becomes a street centerline
 *    (deduped; shared edges merge into intersections in `buildStreetGraph`). Any
 *    inherited road continuations are appended.
 *
 * Pure + deterministic: geometry in → plan out, no RNG.
 */
import type { TownPlan as ArtifactTownPlan } from '../artifacts';
import type { TownPlan as VoronoiTownPlan } from './townEngine';
import { type StyleFamily } from './architectureStyle';
/**
 * Convert a Voronoi-ward town into the flat artifact plan the roster + motion
 * pipeline consume. Plot ids are assigned in a stable ward→civic order.
 *
 * When `family` is given, each plot is stamped with deterministic architecture
 * style fields (wall/roof color, roof form) hashed frame-invariantly against
 * the town footprint bbox — styling never touches ids or footprints.
 */
export declare function voronoiTownToArtifactPlan(v: VoronoiTownPlan, burgId: number, family?: StyleFamily): ArtifactTownPlan;
