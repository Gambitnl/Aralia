/**
 * @file employment.ts
 * NPC lives (GG-600, 2026-11-02): give the town's working people a workplace.
 *
 * Before this pass only one person per market or workshop plot had a job, so
 * about 2% of a town walked to work and the working day did not show. The town
 * engine already links every home to its work (`population.assignWorkplaces`):
 * the home that RUNS a workplace (`proprietor`), a home whose breadwinner is
 * STAFF at a nearby workplace, or a `labourer` home when the town has more
 * hands than jobs. This pass reads those links and gives each roster person who
 * earns the household's living an `employment` destination.
 *
 * Who works (one rule, from the named household member):
 *   - the head, unless retired, works where the home's link says;
 *   - in a proprietor home, the spouse and adult kin help at the family
 *     business (a family shop is a family's work);
 *   - a lodger, and a surplus roster slot with no named member, is day labour;
 *   - children, servants, retired people, and the spouse and kin of a staff or
 *     labour home ("keeps the household") get no workplace.
 * Day labour goes to a real heavy-work building (storehouse, granary, mill,
 * bakery, workshop, smithy, the keep, then shops and inns as porters), the
 * nearest one with room, the same nearest-with-room rule the town engine uses.
 *
 * What is preserved: `workPlotId` still marks ONLY the business keeper. Merchant
 * ids, the owner's name, stock, shop succession and the sim keeper all join on
 * it, so staff never take it. No new person is made, no id or name changes, and
 * the occupation (which keys the body) is unchanged. A town without population
 * links (unpopulated or authored plans) gets no employment at all.
 *
 * Deferred: the staff are not yet drawn inside their workplace room packet (the
 * interior packet admits only the keeper); field and dock work outside the
 * walls has no plot to walk to yet.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 21:55:43
 * Dependents: systems/worldforge/roster/generateTownRoster.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownPlan } from '../artifacts';
import type { HouseholdMember } from '../town/household';
import type { Occupant } from './types';

export type EmploymentRole = 'proprietor' | 'staff' | 'labourer';

/** A day-labour weight per building type (or plot role when no type). Heavy
 * work first; a shop or inn takes a few porters and hands. */
const LABOUR_WEIGHT: Readonly<Record<string, number>> = {
  storehouse: 4, granary: 4, lumbermill: 4, windmill: 3, keep: 6,
  bakery: 2, workshop: 2, smithy: 2, shop: 1, inn: 1, tavern: 1,
};

type Plot = TownPlan['plots'][number];

/**
 * Does this named member earn the household's living? `familyBusiness` is true
 * for a home that runs its own workplace (a proprietor home).
 */
export function memberEarnsLiving(member: HouseholdMember, familyBusiness: boolean): boolean {
  if (member.ageBand === 'child' || member.role === 'servant' || member.role === 'child') return false;
  if (/^retired\b/i.test(member.occupation ?? '')) return false;
  if (member.role === 'head' || member.role === 'lodger') return true;
  return familyBusiness && (member.role === 'spouse' || member.role === 'kin');
}

function centroid(plot: Plot): [number, number] {
  let x = 0, y = 0;
  for (const [px, py] of plot.footprint) { x += px; y += py; }
  return [x / plot.footprint.length, y / plot.footprint.length];
}

function labourWeight(plot: Plot): number {
  return LABOUR_WEIGHT[plot.pop?.buildingType ?? plot.role] ?? 0;
}

/**
 * Give each earner in `occupants` an `employment` link, in place. `members`
 * maps a roster occupant id to its named household member (absent for a
 * surplus roster slot). Deterministic: homes go in plot-id order and every tie
 * breaks on plot id.
 */
export function assignEmployment(
  plan: TownPlan,
  occupants: Occupant[],
  members: ReadonlyMap<number, HouseholdMember>,
): void {
  const plotById = new Map(plan.plots.map((plot) => [plot.id, plot]));
  const workplaceByHomeId = new Map<string, Plot>();
  for (const plot of plan.plots) {
    if (plot.pop?.homeId && !plot.pop.residential) workplaceByHomeId.set(plot.pop.homeId, plot);
  }
  if (workplaceByHomeId.size === 0) return; // no economy links: an unpopulated or authored town

  // Each earner, grouped by home so one household's labourers share a site.
  const labourByHome = new Map<number, Occupant[]>();
  for (const person of occupants) {
    if (person.workPlotId !== undefined || person.retired || person.ruralHousehold || person.ageBand === 'child') continue;
    const home = plotById.get(person.homePlotId);
    if (!home?.pop?.residential) continue;
    const link = home.pop.workplaceId ? workplaceByHomeId.get(home.pop.workplaceId) : undefined;
    const role = link ? home.pop.workRole : 'labourer';
    const member = members.get(person.id);
    if (member) {
      if (!memberEarnsLiving(member, role === 'proprietor')) continue;
      if (link && role !== 'labourer' && member.role !== 'lodger') {
        person.employment = { plotId: link.id, role: role ?? 'staff' };
        continue;
      }
    } else if (person.ageBand !== 'adult' || person.householdMemberId !== undefined) {
      continue; // a named person without a member record is left as they are
    }
    const group = labourByHome.get(home.id) ?? [];
    group.push(person);
    labourByHome.set(home.id, group);
  }
  if (labourByHome.size === 0) return;

  const sites = plan.plots
    .filter((plot) => labourWeight(plot) > 0)
    .map((plot) => ({ plot, weight: labourWeight(plot), centroid: centroid(plot), load: 0 }))
    .sort((a, b) => a.plot.id - b.plot.id);
  if (sites.length === 0) return;
  const total = [...labourByHome.values()].reduce((sum, group) => sum + group.length, 0);
  const totalWeight = sites.reduce((sum, site) => sum + site.weight, 0);
  const capacity = (site: (typeof sites)[number]) => Math.ceil((total * site.weight) / totalWeight);

  for (const homeId of [...labourByHome.keys()].sort((a, b) => a - b)) {
    const group = labourByHome.get(homeId)!;
    const [hx, hy] = centroid(plotById.get(homeId)!);
    let best: (typeof sites)[number] | undefined, bestD = Infinity;
    let nearest: (typeof sites)[number] | undefined, nearestD = Infinity;
    for (const site of sites) {
      const d = (site.centroid[0] - hx) ** 2 + (site.centroid[1] - hy) ** 2;
      if (d < nearestD) { nearestD = d; nearest = site; }
      if (site.load + group.length <= capacity(site) && d < bestD) { bestD = d; best = site; }
    }
    // Every site full (a large household at the end): the nearest site takes it.
    const site = best ?? nearest!;
    site.load += group.length;
    for (const person of group) person.employment = { plotId: site.plot.id, role: 'labourer' };
  }
}
