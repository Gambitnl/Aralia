// @dependencies-start
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
// @dependencies-end

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
export function formatTravelTime(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const totalHours = Math.floor(m / 60);
  const mins = m % 60;
  if (totalHours < 24) return mins ? `${totalHours}h ${mins}m` : `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

/** Human distance: "0.4 mi", "19 mi". */
export function formatDistance(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export type DangerLevel = 'Safe' | 'Low' | 'Moderate' | 'High' | 'Perilous';

export interface DangerRating {
  level: DangerLevel;
  /** Display color for the rating chip / route tint. */
  color: string;
}

/** Map a 0..1 danger value to a labelled, colored rating. */
export function dangerRating(danger: number): DangerRating {
  const d = Math.max(0, Math.min(1, danger));
  if (d < 0.12) return { level: 'Safe', color: '#22c55e' };
  if (d < 0.3) return { level: 'Low', color: '#84cc16' };
  if (d < 0.5) return { level: 'Moderate', color: '#eab308' };
  if (d < 0.7) return { level: 'High', color: '#f97316' };
  return { level: 'Perilous', color: '#ef4444' };
}

// ── Ferry fares (travel G15) ────────────────────────────────────────────────
// A hired ferry charges a fare for its sea legs, so crossing water is an
// economic choice rather than a free teleport. The fare is a flat boarding fee
// plus a per-sea-mile rate, computed ONLY from the route's open-water distance
// (land legs are walked for free). Owned-ship voyages pay no fare — that's a
// separate commit path — so callers only apply this to hired ferries.
//
// TUNABLE — flagged for design review. Low, D&D-appropriate defaults: a short
// river/strait hop costs a couple of gold, a long sea passage a handful more.
export const FERRY_BOARDING_FEE_GP = 2; // TUNABLE — flat fee to board, any crossing
export const FERRY_PER_SEA_MILE_GP = 0.5; // TUNABLE — per mile of open-water passage

/**
 * Fare (whole gp, rounded up) a hired ferry charges for a route's sea legs.
 *
 * Pure + deterministic — depends only on `seaMiles`. Returns 0 for an all-land
 * route (no sea miles), so callers can treat 0 as "no ferry needed / no charge".
 */
export function ferryFare(route: { seaMiles: number }): number {
  if (!(route.seaMiles > 0)) return 0;
  return Math.ceil(FERRY_BOARDING_FEE_GP + route.seaMiles * FERRY_PER_SEA_MILE_GP);
}

/**
 * One-line summary for a route that includes both land and sea legs.
 *
 * This keeps the total time and danger wording consistent with ordinary travel,
 * while splitting distance so the player can see how much of the trip is over
 * roads/terrain versus water. When a positive `fareGp` is supplied (hired ferry),
 * the fare is appended so the player sees the cost before committing.
 */
export function formatMultiModalSummary(route: MultiModalRoute, opts?: { fareGp?: number | null }): string {
  const rating = dangerRating(route.danger);
  // Distance breakdown: land + sea, plus a short "rowed ashore" tender leg when
  // the route has one (optional field — guard for undefined/0).
  const tender = route.tenderMiles;
  const tenderPiece = tender != null && tender > 0 ? ` + ${formatDistance(tender)} tender` : '';
  const base = `≈ ${formatTravelTime(route.minutes)} · ${formatDistance(route.landMiles)} land + ${formatDistance(route.seaMiles)} sea${tenderPiece} · Danger: ${rating.level}`;
  const fare = opts?.fareGp;
  return fare != null && fare > 0 ? `${base} · Fare: ${fare} gp` : base;
}

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
export function formatRouteSummary(
  route: RoutePlan,
  transportLabel = 'on foot',
  opts?: { faintPath?: boolean; forestName?: string; passName?: string },
): string {
  const rating = dangerRating(route.danger);
  const base = `≈ ${formatTravelTime(route.minutes)} · ~${formatDistance(route.miles)} · Danger: ${rating.level} · ${transportLabel}`;
  const faint = opts?.faintPath ? ' · follows a faint forest path' : '';
  const flavor = opts?.passName
    ? ` · via ${opts.passName}`
    : opts?.forestName
      ? ` · through the ${opts.forestName}`
      : '';
  return `${base}${faint}${flavor}`;
}

export interface ProvisionLine {
  text: string;
  ok: boolean;
  /** Color for the chip/line, matching severity. */
  color: string;
}

/** Display label for the binding consumable resource (E1). */
const RESOURCE_LABEL: Record<ProvisionResource, string> = { food: 'Food', water: 'Water' };

/**
 * One-line provisions readout: "Food: 6 days" or "Water: 3 days · short 2 days".
 * When the status names a binding resource (water vs food), the line labels the
 * resource that actually runs out first; otherwise it reads "Food".
 */
export function formatProvisionLine(status: ProvisionStatus & { binding?: ProvisionResource | null }): ProvisionLine {
  const label = status.binding ? RESOURCE_LABEL[status.binding] : 'Food';
  const base = `${label}: ${status.foodRangeDays} day${status.foodRangeDays === 1 ? '' : 's'}`;
  if (status.inRange) return { text: base, ok: true, color: '#22c55e' };
  const color = status.severity === 'major' ? '#ef4444' : '#eab308';
  return {
    text: `${base} · short ${status.shortfallDays} day${status.shortfallDays === 1 ? '' : 's'}`,
    ok: false,
    color,
  };
}
