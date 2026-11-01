/** A town layout revision chooses its deterministic streets, lots and founding
 * population inputs. It does not freeze life events or grant a save migration.
 * New generation uses revision 2, including the approved eight town-look rules.
 * Revision 1 is an explicit compatibility reader for the retained earlier town.
 * Revision3 is an explicit rural household/field candidate; it does not yet
 * provide playable farm buildings or change the revision2 default.
 * Save/caller admission must be wired and verified separately before adoption. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/11/2026, 04:56:53
 * Dependents: components/Worldforge/townBuildingVisit.ts, hooks/actions/handleWorldEvents.ts, hooks/app/useAppAtlasRuntime.ts, hooks/useTownCrierAnnouncements.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/legacySubmapBridge.ts, systems/worldforge/leaf3d/atlasGroundRestore.ts, systems/worldforge/town/canonicalTown.ts, systems/worldforge/town/historicalTownLayout.ts, systems/worldforge/town/historicalTownLoadContract.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts, systems/worldforge/townsim/townSimRegistration.ts, systems/worldforge/townsim/types.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const CURRENT_TOWN_LAYOUT_REVISION = 2 as const;
/** Explicit candidate only: rural household/field source facts; never the default. */
export const RURAL_HOUSEHOLD_TOWN_LAYOUT_REVISION = 3 as const;
export type TownLayoutRevision = 1 | typeof CURRENT_TOWN_LAYOUT_REVISION | typeof RURAL_HOUSEHOLD_TOWN_LAYOUT_REVISION;

/** Read-only selection projected from the existing TownSim registry. This is
 * not another save store; terrain readers need layout metadata, not people. */
export type TownLayoutStates = Readonly<Record<number, {readonly layoutRevision?: TownLayoutRevision}>>;

/** An unknown saved revision must not silently receive a different town. */
export function requireTownLayoutRevision(value: unknown): TownLayoutRevision {
  if (value === 1 || value === CURRENT_TOWN_LAYOUT_REVISION || value === RURAL_HOUSEHOLD_TOWN_LAYOUT_REVISION) return value;
  throw new Error('This town uses an unsupported layout revision.');
}
