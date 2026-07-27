/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 08:43:22
 * Dependents: components/World3D/dungeonEntryRuntime.ts, systems/worldforge/bridge/dungeonEntrances.ts, systems/worldforge/dungeon/world/rumors.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import type { DungeonParams, DungeonPlan, WorldIdentity } from '../types';
import { type DungeonSite } from './dungeonSites';
import { type DungeonIdentity } from './dungeonIdentity';
export { canonicalDungeonId, type DungeonIdentity } from './dungeonIdentity';
/** Build the identity receipt attached to a known canonical world site. */
export declare function dungeonIdentityForSite(site: DungeonSite): DungeonIdentity;
/**
 * Resolve a serialized identity back to its authoritative world attachment.
 *
 * Every failure is explicit: absent fields, an id/path mismatch, a wrong world,
 * or a path that no longer names a site all throw before generation begins.
 */
export declare function resolveDungeonIdentity(identity: DungeonIdentity, expectedWorldSeed?: number): {
    worldSeed: number;
    site: DungeonSite;
};
/**
 * Room count for a site, a deterministic closed form of DANGER and REMOTENESS:
 *
 *   remoteness = clamp01( sqrt(dist²ToNearestBurg) / REMOTE_SATURATION_PX )
 *   combined   = clamp01( DANGER_WEIGHT·danger + REMOTE_WEIGHT·remoteness )
 *   roomCount  = round( ROOM_BASE + ROOM_SPAN · combined )
 *
 * → 24 at a calm town-adjacent cell, up to ~54 at a max-danger, quarter-map-
 * remote cell. Monotone non-decreasing in danger AND in remoteness by
 * construction (both terms have non-negative weights and enter linearly).
 */
export declare function scaleRoomCount(danger: number, dist2ToBurg: number): number;
/** Party level from danger: 1 at calm, up to PARTY_LEVEL_MAX at max danger. */
export declare function scalePartyLevel(danger: number): number;
/**
 * Derive a site's full generation parameters + world naming context.
 *
 * Determinism: the builder stem is drawn on a NEW `s:builder` stream off the
 * site's own frozen `sitePath`, so the same site always names the same builder
 * and nothing existing shifts. The danger field is cached per world seed.
 */
export declare function deriveDungeonIdentity(worldSeed: number, site: DungeonSite): {
    params: DungeonParams;
    world: WorldIdentity;
};
/**
 * One-call convenience: derive a site's identity, then generate its full plan.
 *
 * Seeding choice (the honest one): the dungeon seeds from the site's FROZEN
 * `sitePath` via `DungeonInput.seedPath`. The generator consumes that path
 * VERBATIM because the frozen site grammar already ends in `dungeon:<site>`;
 * it must not append a second dungeon segment. This ties the plan's determinism
 * to the site's world identity without hashing the path down to a lossy numeric
 * seed. `input.seed` is still stamped on the plan for provenance.
 */
export declare function generateDungeonForSite(worldSeed: number, site: DungeonSite): DungeonPlan;
/**
 * Existing runtime generation boundary, addressed only by canonical identity.
 *
 * This is the handoff future entry/save/revisit work should call. It resolves
 * the saved receipt back to the real world site, then reuses the established
 * world-derived identity and generator path instead of reconstructing params.
 */
export declare function generateDungeonForIdentity(identity: DungeonIdentity, expectedWorldSeed?: number): DungeonPlan;
