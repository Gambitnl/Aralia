/**
 * @file l0Adapter.ts — SP1 L0→L1 adapter (Milestone 2).
 *
 * Pure bridge: a real Azgaar/FMG atlas cell (`FmgAtlasResult`/`FmgWorldResult`)
 * → a root `SubmapParentContext` for the submap engine. The cell's Voronoi
 * polygon becomes the submap boundary; its biome and burg are inherited at their
 * exact graph-coord positions (identity preserved — the Bomnogorvan contract
 * source), and the seed-path descends `wf:<seed>/cell:<id>` so the submap
 * regenerates deterministically in isolation.
 *
 * Spec: SPEC §11 (2026-06-22) item 2 — Azgaar L0 → WF L1+; WF never generates a
 * competing world, it derives the submap from the parent cell.
 */
import { type SeedPath } from '../seedPath';
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { SubmapParentContext } from './submapEngine';
/**
 * Build a root `SubmapParentContext` for atlas cell `cellId`.
 * @param atlas  the owned FMG atlas/world result (burgs only present on a world result)
 * @param cellId the pack cell id (the clicked Azgaar cell)
 * @param worldSeedPath the world root seed path (e.g. `rootSeedPath(seed)`)
 */
export declare function atlasCellToSubmapContext(atlas: FmgAtlasResult, cellId: number, worldSeedPath: SeedPath): SubmapParentContext;
