/**
 * @file householdBrief.ts — town → blueprint household brief bridge.
 *
 * The building generator designs a house for a COARSE family description
 * ({@link HouseholdBrief}: slots + counts, never names). This module coarsens
 * the SAME lazy named household the tooltip shows ({@link generateHousehold})
 * into that brief, so the family the town names and the family the house is
 * designed for are one and the same.
 *
 * Determinism flows entirely from `generateHousehold` (deterministic per
 * `(townSeed, homeId)`); both functions here are pure.
 */
import type { BriefWealth, HouseholdBrief, MemberSlot } from '../interior/blueprintTypes';
import { generateHousehold, type Household } from './household';
import type { TownPlotPopulation } from './townEngine';
import type { SeedPath } from '../seedPath';

/** Servant count by wealth — wealthy homes staff up, others never. */
const SERVANTS: Record<BriefWealth, number> = { poor: 0, common: 0, wealthy: 2 };

/**
 * The single member-slot tag scheme: 'head'/'spouse' stay bare (unique
 * singletons), every other role is `<role>:<n>` with `n` the 0-based index
 * among members of that role. SINGLE SOURCE OF TRUTH — {@link briefFromHousehold}
 * stamps tags with this, and occupancy.ts's `tagToMember` inverts the same
 * scheme, so brief slots and station lookups can never drift apart.
 */
export const memberTag = (role: string, n: number): string =>
  role === 'head' || role === 'spouse' ? role : `${role}:${n}`;

/**
 * Coarsen a named household into the slots-and-counts brief the generator
 * designs for. Slot tags are stable and unique ('head', 'spouse', 'child:0'…);
 * servants are appended by wealth and exist only as brief slots (never as
 * named {@link Household} members).
 */
export function briefFromHousehold(
  hh: Household,
  opts: { wealth: BriefWealth; worksAtHome: boolean },
): HouseholdBrief {
  const counters = new Map<string, number>();
  const slots: MemberSlot[] = hh.members.map((m) => {
    const role = m.role; // 'head'|'spouse'|'child'|'elder'|'kin'|'lodger'
    const n = counters.get(role) ?? 0;
    counters.set(role, n + 1);
    const tag = memberTag(role, n);
    return { tag, role, ageBand: m.ageBand };
  });
  for (let i = 0; i < SERVANTS[opts.wealth]; i++) {
    slots.push({ tag: `servant:${i}`, role: 'servant', ageBand: 'adult' });
  }
  return {
    homeId: hh.homeId,
    slots,
    trade: hh.occupation,
    worksAtHome: opts.worksAtHome,
    wealth: opts.wealth,
  };
}

/**
 * The named household + brief context for a plot, or `undefined` when the plot
 * has no household (storehouse, civic, temple, keep, unpopulated towns) — a
 * legitimate absence, not a fallback.
 *
 * SINGLE SOURCE OF TRUTH for "who lives here": both {@link briefForPlot} (the
 * blueprint's household brief) and the living-overlay bridge
 * ({@link import('../bridge/buildingOccupancy').occupancyForPlot}) derive from
 * this, so the family the house is DESIGNED for and the family whose members
 * STAND at stations can never drift. Residential plot → its family. Workplace
 * plot (smithy/shop/inn/tavern) run by a family → the PROPRIETOR family with
 * `worksAtHome: true` (they live over the shop).
 */
export function householdForPlot(
  plot: TownPlotPopulation,
  allPlots: readonly TownPlotPopulation[],
  townSeed: SeedPath,
): { household: Household; wealth: BriefWealth; worksAtHome: boolean } | undefined {
  // Workplace run by a family: the proprietor's household lives over the shop.
  if (!plot.residential && plot.proprietorHomeId) {
    const home = allPlots.find((p) => p.homeId === plot.proprietorHomeId);
    if (!home?.homeId || !home.occupants) return undefined;
    const household = generateHousehold(townSeed, home.homeId, home.occupants, home.buildingType, {
      role: 'proprietor',
      workplaceType: plot.buildingType,
    });
    return { household, wealth: plot.district ?? 'common', worksAtHome: true };
  }
  if (!plot.residential || !plot.homeId || !plot.occupants) return undefined;
  // A staff household works at a workplace ELSEWHERE: resolve that workplace's
  // type (via workplaceId) so the head gets the right trade noun.
  const workplace = plot.workplaceId
    ? allPlots.find((p) => p.homeId === plot.workplaceId)
    : undefined;
  const household = generateHousehold(townSeed, plot.homeId, plot.occupants, plot.buildingType, {
    role: plot.workRole,
    workplaceType: workplace?.buildingType,
  });
  // Workers at a workplace elsewhere do NOT work at home.
  return { household, wealth: plot.district ?? 'common', worksAtHome: false };
}

/**
 * Brief for a plot. Residential plot → its household's brief. Workplace plot
 * (smithy/shop/inn/tavern) run by a family → the PROPRIETOR family's brief with
 * `worksAtHome: true` (they live over the shop). Returns `undefined` for plots
 * with no household (storehouse, civic, temple, keep, unpopulated towns) — a
 * legitimate absence, not a fallback. Thin wrapper over
 * {@link householdForPlot}, coarsening its named family into the brief.
 */
export function briefForPlot(
  plot: TownPlotPopulation,
  allPlots: readonly TownPlotPopulation[],
  townSeed: SeedPath,
): HouseholdBrief | undefined {
  const resolved = householdForPlot(plot, allPlots, townSeed);
  if (!resolved) return undefined;
  return briefFromHousehold(resolved.household, {
    wealth: resolved.wealth,
    worksAtHome: resolved.worksAtHome,
  });
}
