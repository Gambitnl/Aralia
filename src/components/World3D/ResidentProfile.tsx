/**
 * Shows the person reached in the 3D world using the same current family facts
 * as conversation. Original household records remain visible when the town's
 * life history cannot identify them; reading this panel never changes a save.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 02:40:22
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import type { Household } from '../../systems/worldforge/town/household';
import { householdMemberIdentity } from '../../systems/worldforge/town/householdBrief';
import { householdResidentLifeStatusAt, type TownLifeState } from '../../systems/worldforge/roster/agentLife';
import { householdFamilyAt, householdLifeAge, householdInstitutionRole } from '../../systems/worldforge/townsim/householdNpc';
import { getGameDay } from '../../utils/core';

interface ResidentProfileProps {
  household: Household;
  memberIndex: number;
  life?: TownLifeState;
  gameTime?: Date;
}

export default function ResidentProfile({ household, memberIndex, life, gameTime }: ResidentProfileProps) {
  const member = household.members[memberIndex];
  if (!member) return null;
  const hasClock = gameTime instanceof Date && Number.isFinite(gameTime.getTime());
  const day = hasClock ? getGameDay(gameTime) : 0;
  const familyFor = (index: number) => hasClock ? householdFamilyAt(life,
    householdMemberIdentity(household, index), household.members[index].name, day,
    household.members.filter(other => other.name === household.members[index].name).length === 1) : undefined;
  const family = familyFor(memberIndex);
  const office = householdInstitutionRole(family?.person,day);
  const entries = household.members.map((person, index) => ({ person, index, source: familyFor(index) }));
  const statusLabel = (index: number) => {
    if (!hasClock) return '';
    const person = household.members[index];
    const status = householdResidentLifeStatusAt(life, householdMemberIdentity(household, index), person.name, day,
      household.members.filter(other => other.name === person.name).length === 1);
    return status === 'deceased' ? ' · deceased' : status === 'not-born' ? ' · not present'
      : status === 'unresolved' ? ' · identity unverified' : '';
  };
  const records = (list: typeof entries) => <ul className="mt-3 list-inside list-disc space-y-2 leading-relaxed">{list.map(({ person, index, source }) =>
    <li key={index}>{person.name} — {person.role}{person.occupation ? ', ' + person.occupation : ''}
      {family ? ' · ' + (source ? householdLifeAge(source.person, day) : person.age) + ' years' : ''}{statusLabel(index)}</li>)}</ul>;

  // A shared address is not a family link. Use only admitted, reciprocal life
  // records, and leave the existing biography and physical resident untouched.
  const familyIds = new Set(family ? [family.person.occupantId, ...family.relatives.map(relative => relative.person.occupantId)] : []);
  const otherRecords = entries.filter(entry => entry.index !== memberIndex && (!entry.source || !familyIds.has(entry.source.person.occupantId)));
  return <>
    <p>{member.occupation || 'Resident'} · Age {family ? householdLifeAge(family.person, day) : member.age}</p>
    {office && <p>Town role: {office}</p>}
    {/* Family and shared-address records use separate desktop columns; their factual distinction stays unchanged. */}
    {family ? <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
      <section><h4 className="font-semibold text-amber-100">Family</h4>
      {family.relatives.length > 0 ? <ul data-testid="resident-current-family" className="mt-3 list-inside list-disc space-y-2 leading-relaxed">{family.relatives.map(relative => {
        const original = entries.find(entry => entry.source?.person.occupantId === relative.person.occupantId)?.person;
        return <li key={relative.person.occupantId}>{relative.person.name} — {relative.relation} · {householdLifeAge(relative.person, day)} years
          {relative.person.diedDay !== undefined && relative.person.diedDay <= day ? ' · deceased' : ''}
          {original?.occupation ? ' · ' + original.occupation : ''}
          {householdInstitutionRole(relative.person,day) ? ' · Town role: '+householdInstitutionRole(relative.person,day) : ''}
          {relative.partner ? ' · married to ' + relative.partner.name : ''}
          {relative.homeElsewhere ? ' · home elsewhere in town' : ''}</li>;
      })}</ul> : <p className="mt-1">No confirmed family details are available.</p>}
      </section>
      {/* A partial life roster cannot erase untracked children or staff. */}
      {otherRecords.length > 0 && <section><h4 className="font-semibold text-amber-100">Other household records</h4>{records(otherRecords)}</section>}
    </div> : <>
      <p className="mt-1">{household.summary}</p>
      <h4 className="mt-3 font-semibold">Household</h4>
      {records(entries.filter(entry => entry.index !== memberIndex))}
    </>}
  </>;
}
