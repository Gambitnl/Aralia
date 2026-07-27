/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 17:11:03
 * Dependents: components/MapPane.tsx, components/Worldforge/AtlasSvgView.tsx, components/Worldforge/SubmapSvgView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file travelReadout.ts — player-facing formatting for a planned route.
 *
 * Turns a `RoutePlan` (minutes/miles/danger) into the strings the travel-mode UI
 * shows so the player can decide before committing: how long the trip takes, how
 * far it is, and how dangerous it is. Pure: no React/DOM.
 */
import type { RoutePlan } from './routePlanning';
import type { MultiModalRoute } from './multiModalRoute';
import type { ProvisionStatus, ProvisionResource } from './provisioning';
/** Human travel duration: "15 min", "6h 20m", "2d 4h". */
export declare function formatTravelTime(minutes: number): string;
/** Human distance: "0.4 mi", "19 mi". */
export declare function formatDistance(miles: number): string;
export type DangerLevel = 'Safe' | 'Low' | 'Moderate' | 'High' | 'Perilous';
export interface DangerRating {
    level: DangerLevel;
    /** Display color for the rating chip / route tint. */
    color: string;
}
/** Map a 0..1 danger value to a labelled, colored rating. */
export declare function dangerRating(danger: number): DangerRating;
export declare const FERRY_BOARDING_FEE_GP = 2;
export declare const FERRY_PER_SEA_MILE_GP = 0.5;
/**
 * Fare (whole gp, rounded up) a hired ferry charges for a route's sea legs.
 *
 * Pure + deterministic — depends only on `seaMiles`. Returns 0 for an all-land
 * route (no sea miles), so callers can treat 0 as "no ferry needed / no charge".
 */
export declare function ferryFare(route: {
    seaMiles: number;
}): number;
/**
 * One-line summary for a route that includes both land and sea legs.
 *
 * This keeps the total time and danger wording consistent with ordinary travel,
 * while splitting distance so the player can see how much of the trip is over
 * roads/terrain versus water. When a positive `fareGp` is supplied (hired ferry),
 * the fare is appended so the player sees the cost before committing.
 */
export declare function formatMultiModalSummary(route: MultiModalRoute, opts?: {
    fareGp?: number | null;
}): string;
/**
 * One-line route summary for the travel readout, e.g.
 * "≈ 6h 20m · ~19 mi · Danger: Moderate · on foot".
 *
 * `opts.faintPath` appends a warning when the route follows a faint forest
 * path, so the player learns the trail can fade (a get-lost risk on commit)
 * BEFORE clicking — not from a surprise drift afterwards.
 *
 * `opts.passName` appends "via <Name>" when the route crests a named
 * mountain pass (the caller resolves which — first crossed wins, via
 * `passNameOnRoute`); `opts.forestName` appends "through the <Name>" when it
 * crosses a named forest (largest wins, via `namedForestOnRoute`). ONE
 * flavor clause max: when both are present the pass WINS and the forest
 * clause is dropped — this function owns that rule so every caller can
 * thread both values plainly. The faint-path warning always comes first.
 */
export declare function formatRouteSummary(route: RoutePlan, transportLabel?: string, opts?: {
    faintPath?: boolean;
    forestName?: string;
    passName?: string;
}): string;
export interface ProvisionLine {
    text: string;
    ok: boolean;
    /** Color for the chip/line, matching severity. */
    color: string;
}
/**
 * One-line provisions readout: "Food: 6 days" or "Water: 3 days · short 2 days".
 * When the status names a binding resource (water vs food), the line labels the
 * resource that actually runs out first; otherwise it reads "Food".
 */
export declare function formatProvisionLine(status: ProvisionStatus & {
    binding?: ProvisionResource | null;
}): ProvisionLine;
