/**
 * Projects a saved office holder or authored librarian onto a qualified workplace without
 * changing their household, merchant identity, biography or meeting memory.
 * The bridge must first prove that the real institution has a usable station.
 * Succession chooses a priest; reciprocal home/library ownership chooses its
 * existing librarian. Neither assignment comes from proximity or a new person.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 06:27:07
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownPlan } from '../artifacts';
import type { Occupant, TownRoster } from './types';
import { residentAliveAt, villagerForResident, type TownLifeState } from './agentLife';
import { institutionPlotForRole } from '../townsim/keyNpcs';

export function institutionWorkplaceRoster(
  plan: TownPlan,
  roster: TownRoster,
  life: TownLifeState | undefined,
  day: number,
  supportedPlotIds: ReadonlySet<number>,
): TownRoster {
  const holders = life && Number.isFinite(day)
    ? Object.values(life.villagers).filter(person => person.role === 'priest'
      && person.bornDay <= day && (person.diedDay === undefined || person.diedDay > day))
    : [];
  const holder = holders.length === 1 ? holders[0] : undefined;
  const temple = institutionPlotForRole(plan, 'priest');
  const eligible = holder && temple && supportedPlotIds.has(temple.id)
    ? roster.occupants.filter(person => {
        if (!person.householdMemberId || person.workPlotId !== undefined
          || person.occupation !== 'resident' || person.retired || person.ageBand === 'child') return false;
        const uniqueName = roster.occupants.filter(other =>
          other.homePlotId === person.homePlotId && other.name === person.name).length === 1;
        return villagerForResident(life!, person, uniqueName) === holder;
      })
    : [];
  const chosen = eligible.length === 1 ? eligible[0] : undefined;

  const duties = new Map<Occupant, NonNullable<Occupant['civicWorkplace']>>();
  if (chosen && temple) duties.set(chosen, {role: 'priest', plotId: temple.id});

  // A library's authored proprietor already has a home and an interior work
  // packet. Join that same responsibility to street travel instead of sending
  // the person straight home when the interior owner releases them at closing.
  // Reciprocal source links and a qualified study desk are required; a nearby
  // adult, a child or a retired owner cannot be recruited to fill an empty job.
  const librariesByPerson = new Map<Occupant, number[]>();
  for (const library of plan.plots) {
    const pop = library.pop;
    if (library.role !== 'civic' || pop?.buildingType !== 'library'
      || !pop.proprietorHomeId || !supportedPlotIds.has(library.id)) continue;
    const homes = plan.plots.filter(home => home.pop?.residential
      && home.pop.homeId === pop.proprietorHomeId
      && home.pop.workplaceId === pop.homeId && home.pop.workRole === 'proprietor');
    if (homes.length !== 1) continue;
    const home = homes[0], memberId = home.pop!.homeId + ':head';
    const owners = roster.occupants.filter(person => person.householdMemberId === memberId);
    if (owners.length !== 1) continue;
    const owner = owners[0];
    if (owner === chosen || owner.homePlotId !== home.id || owner.workPlotId !== undefined
      || owner.occupation !== 'resident' || owner.retired || owner.ageBand === 'child') continue;
    const uniqueName = roster.occupants.filter(person => person.homePlotId === owner.homePlotId
      && person.name === owner.name).length === 1;
    if (!residentAliveAt(life, owner, day, uniqueName)) continue;
    const plots = librariesByPerson.get(owner) ?? [];
    plots.push(library.id); librariesByPerson.set(owner, plots);
  }
  for (const [person, plots] of librariesByPerson) {
    if (plots.length === 1) duties.set(person, {role: 'librarian', plotId: plots[0]});
  }

  // This is a derived projection. A successor, missing station or ambiguous
  // identity withdraws only the old projected duty, never a saved person/job.
  const occupants = roster.occupants.map(person => {
    const duty = duties.get(person);
    if (duty) {
      if (person.civicWorkplace?.role === duty.role
        && person.civicWorkplace.plotId === duty.plotId) return person;
      return {...person, civicWorkplace: duty};
    }
    if (!person.civicWorkplace) return person;
    const {civicWorkplace: _previousDuty, ...unchangedPerson} = person;
    return unchangedPerson;
  });
  return occupants.every((person, index) => person === roster.occupants[index])
    ? roster : {...roster, occupants};
}
