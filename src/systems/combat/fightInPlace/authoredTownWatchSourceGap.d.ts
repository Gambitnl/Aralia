/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 13:28:35
 * Dependents: App.tsx, hooks/actions/handleNpcInteraction.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file authoredTownWatchSourceGap.ts
 * Describes why an authored-town wanted-watch confrontation cannot yet enter
 * tactical combat without inventing a WorldForge location or enemy roster.
 *
 * The NPC interaction handler and deterministic production-shell fixture both
 * call this small builder. Keeping one description prevents visual proof from
 * drifting away from the real unsupported launcher while authored towns still
 * lack canonical WorldForge cells and settlement sites.
 */
import type { BattlefieldSourceGapReason } from '../../../types/actions';
/** Stable reason code used by tests, diagnostics, and the World Battle Lab. */
export declare const AUTHORED_TOWN_WATCH_SOURCE_GAP = "authored-town-watch-no-worldforge-location";
/**
 * Build the explicit fail-closed record for a wanted-watch interaction.
 * This function records missing source facts only; it never selects substitute
 * terrain or manufactures generic guards.
 */
export declare function createAuthoredTownWatchSourceGap(locationId: string | null | undefined, npcName: string): BattlefieldSourceGapReason;
