/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 06:00:22
 * Dependents: components/World3D/World3DWrapper.tsx, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file dungeonEntrances.ts — Pillar 2, Task 6: surface a world's dungeon SITES
 * as sealed-door ENTRANCES inside a ground window.
 *
 * A {@link DungeonSite} (dungeon/world/dungeonSites.ts) knows WHERE every dungeon
 * opportunity in a world is, in ATLAS FEET (`posFt` = cell center ×
 * FEET_PER_FMG_PIXEL). A ground window (`LocalArtifact.bounds`) is a rectangle in
 * that SAME feet frame (generateRegion is fed `feetPerPixel: FEET_PER_FMG_PIXEL`).
 * So surfacing is a pure clip-and-rebase: keep every site whose mouth lands in
 * the window (with a small margin, matching the hidden-site convention), convert
 * its feet position to window-local meters, and emit a {@link GroundDungeonEntrance}.
 *
 * The seam this closes (recon §Traps 6): dungeon-flavored FMG markers
 * (caves/dungeons/necropolises/disturbed-burials) used to feed
 * `generateGroundHostiles` as SURFACE swarms. Those types are now removed from
 * the hostile set (groundHostiles.ts `DUNGEON_ENTRANCE_MARKER_TYPES`) and surface
 * HERE as doors instead — no double spawn. `enumerateDungeonSites` is the single
 * source, so temple-stair / sewer-grate / civ-origin sites surface the same way.
 *
 * TOWN-SITE PLACEMENT (documented simplification): a temple-stair site anchors to
 * its burg's SEAT CELL center (`posFt` = burg cell center), which is the town
 * center — the temple plot sits there in the canonical town. A sewer-grate anchors
 * to the same burg cell center (a plaza-adjacent spot near the town center). Both
 * are deterministic and readable; a finer per-plot anchor is a later refinement.
 *
 * Determinism: no draws here — positions come straight from the frozen site list;
 * the discovery radius is a fixed constant. Output preserves the site list's
 * stable order. Zero THREE imports.
 */
import type { LocalArtifact } from '../artifacts';
import type { GroundDungeonEntrance } from './groundChunkLoader';
/**
 * Clip a world's dungeon sites to a ground window and rebase them to
 * window-local meters. Pure + deterministic.
 *
 * @param seed   World seed (drives `enumerateDungeonSites`, cached per seed).
 * @param local  The ground window whose feet `bounds` define the clip rectangle.
 */
export declare function dungeonEntrancesForWindow(seed: number, local: LocalArtifact): GroundDungeonEntrance[];
/**
 * The dungeon's REAL derived name for an entrance (e.g. "The Wrenfield Crypt").
 * The name comes from the Pillar-1 lore pass INSIDE `generateDungeonForSite`, so
 * we generate (once, cached) the site's plan and read `plan.name`. Returns
 * undefined only if the sitePath no longer resolves to a site in this world
 * (never expected — the entrance came FROM the site list).
 *
 * @param seed     World seed.
 * @param sitePath The entrance's frozen `sitePath` (serialized).
 */
export declare function dungeonNameForEntrance(seed: number, sitePath: string): string | undefined;
