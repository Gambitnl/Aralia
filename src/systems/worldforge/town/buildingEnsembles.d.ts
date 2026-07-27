/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 22:28:37
 * Dependents: systems/worldforge/town/townEngine.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file composes individual town plots into recognizable street ensembles.
 *
 * The town generator already knows which plots share a ward edge, which wards
 * surround the market, and whether a plot sits inside a courtyard. This module
 * turns that context into durable row, court, detached, and arcade instructions
 * before any building interior generates. Per-building code stays pure and only
 * consumes the stamped instruction.
 *
 * Called by: townEngine.ts after population and collision filtering
 * Depends on: canonical town plot geometry, typology, and stable seed hashing
 */
import type { BuildingEnsemble } from '../interior/blueprintTypes';
import { type SeedPath } from '../seedPath';
import type { BuildingPlot, CivicStructure, TownTypology, TownWard } from './townEngine';
/** Resolve every canonical plot to one block-level ensemble instruction. */
export declare function resolveBuildingEnsembles(wards: readonly TownWard[], civic: readonly CivicStructure[], typology: TownTypology | undefined, seedPath: SeedPath): Map<BuildingPlot, BuildingEnsemble>;
