/**
 * Lets players inspect a town building's real rooms, family, furnishings, and
 * owned goods. Keeper conversation and shopping use the existing game actions.
 * Examining belongings does not transfer them or bypass ownership rules.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 15:48:08
 * Dependents: components/MapPane.tsx
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import { ALL_ITEMS } from '../../data/items';
import { renderBlueprintSvg } from '../../systems/worldforge/interior/renderBlueprintSvg';
import type { ObservedBuildingSource } from '../../systems/worldforge/interior/buildingSource';
import type { BuildingEventHistory } from '../../systems/worldforge/interior/blueprintTypes';
import { townBuildingVisit } from './townBuildingVisit';
import { guestBedsForVisit, guestBedsWithStairAccess, guestBedStairIssue, guestBedDescription, lodgingKeeperOnDuty, LODGING_COST_PER_MEMBER_GP } from '../../systems/gameplay/lodging';
import type { LodgingReservation } from '../../types/rest';
import { formatGameDateTime } from '../../utils/core/timeUtils';
import { getGameDay } from '../../utils/core';
import { householdResidentAliveAt, householdResidentLifeStatusAt, type TownLifeState } from '../../systems/worldforge/roster/agentLife';
import { householdMemberIdentity } from '../../systems/worldforge/town/householdBrief';
import { attendanceForVisit } from '../../systems/economy/businessAttendance';
import { householdFamilyAt, householdLifeAge, householdInstitutionRole } from '../../systems/worldforge/townsim/householdNpc';

export interface TownBuildingInspectorProps {
  worldSeed: number;
  burgId: number;
  plotId: number;
  hour: number;
  businessName?: string;
  reservation?: LodgingReservation;
  gameTime?: Date;
  eventLog?: BuildingEventHistory;
  retainedSource?: ObservedBuildingSource;
  life?: TownLifeState;
  onClose: () => void;
  onKeeperAction?: (kind: 'talk' | 'shop' | 'lodging') => void;
}

const words = (value: string) => value.replace(/[-_]/g, ' ');

export default function TownBuildingInspector({ worldSeed, burgId, plotId, hour, businessName, reservation, gameTime, eventLog, retainedSource, life, onClose, onKeeperAction }: TownBuildingInspectorProps) {
  const result = useMemo(() => {
    try { return { visit: townBuildingVisit(worldSeed, burgId, plotId, eventLog, retainedSource, life?.layoutRevision), error: null }; }
    catch (error) { return { visit: null, error: error instanceof Error ? error.message : String(error) }; }
  }, [worldSeed, burgId, plotId, eventLog, retainedSource, life?.layoutRevision]);
  const [level, setLevel] = useState(0);
  const [examined, setExamined] = useState<number | null>(null);
  const visit = result.visit;
  // A furnishing index belongs to one exact blueprint. After a building or
  // source change, require a fresh choice instead of presenting another bed,
  // chest or desk as the object the player previously examined.
  useEffect(() => {setLevel(0); setExamined(null);}, [worldSeed, burgId, plotId, life?.layoutRevision, visit?.plan]);
  const currentHour = ((Math.floor(hour) % 24) + 24) % 24;
  const day = gameTime ? getGameDay(gameTime) : 0;
  const memberAlive = (index: number) => !visit?.household || householdResidentAliveAt(life,
    householdMemberIdentity(visit.household, index), visit.household.members[index].name, day,
    visit.household.members.filter(m => m.name === visit.household!.members[index].name).length === 1);
  const memberStatus = (index: number) => !visit?.household ? 'untracked' : householdResidentLifeStatusAt(life,
    householdMemberIdentity(visit.household, index), visit.household.members[index].name, day,
    visit.household.members.filter(m => m.name === visit.household!.members[index].name).length === 1);
  // Current family facts share dialogue's admission rules. This view does not
  // move the founding household's bodies or rewrite its interior design brief.
  const head = visit?.household?.members[0];
  const currentFamily = gameTime instanceof Date && Number.isFinite(gameTime.getTime()) && head && visit?.household ? householdFamilyAt(life,
    householdMemberIdentity(visit.household,0),head.name,day,
    visit.household.members.filter(member => member.name === head.name).length === 1) : undefined;
  const householdEntries = currentFamily && visit?.household ? visit.household.members.map((member,index) => ({
    member,index,source:householdFamilyAt(life,householdMemberIdentity(visit.household!,index),member.name,day,
      visit.household!.members.filter(other => other.name === member.name).length === 1),
  })) : [];
  // A bounded town life roster does not cover every named household member.
  // Keep unmatched children, staff and lodgers rather than treating absence as
  // proof they disappeared, or merging two same-name people into one record.
  const familyIds = new Set(currentFamily ? [currentFamily.person.occupantId,...currentFamily.relatives.map(relative => relative.person.occupantId)] : []);
  const otherHouseholdEntries = householdEntries.filter(entry => !entry.source || !familyIds.has(entry.source.person.occupantId));
  const keeperStatus = memberStatus(0);
  const keeperAlive = !['deceased', 'not-born', 'unresolved'].includes(keeperStatus);
  // The floor plan is a current occupancy view, not the town's historical diary.
  // Keep original member indexes so hiding a death cannot rename another marker.
  const occupancy = useMemo(() => visit?.occupancy && ({...visit.occupancy,
    stationsByHour: visit.occupancy.stationsByHour.map(stations => stations.filter(s => memberAlive(s.memberIndex))),
  }), [visit, life, day]);
  // The proprietor record survives closing time and retirement, but it must
  // not summon an absent person for remote conversation or shopping. Businesses
  // without a source household retain their existing fallback until staff exist.
  const keeperOnDuty = keeperAlive && (!visit?.workplaceOnly || !visit.household || Boolean(
    visit.occupancy?.stationsByHour[currentHour]?.some(station =>
      station.memberIndex === 0 && station.where === 'home' && station.activity === 'work'),
  ));
  // Explain the existing refusal so players can distinguish retirement from
  // closing time. Relatives are still not replacement staff, and the buttons
  // retain the same attendance and life-status checks above.
  const keeperAttendance = visit ? attendanceForVisit(visit, currentHour, life, day) : undefined;
  const retiredFromTrade = head?.occupation === 'retired' || head?.occupation.startsWith('retired ');
  const keeperUnavailableReason = `${keeperAlive && retiredFromTrade ? 'The proprietor is retired from this trade. ' : ''}${keeperAttendance?.reason ?? 'No keeper is on duty here.'}`;
  const floor = visit?.plan.floors.find((candidate) => candidate.level === level) ?? visit?.plan.floors[0];
  const guestBeds = visit ? guestBedsForVisit(visit) : [];
  const offeredBeds = visit ? guestBedsWithStairAccess(visit) : [];
  const reservedStairIssue = visit && reservation?.beds.map(bed => guestBedStairIssue(visit, bed)).find(Boolean);
  const svg = useMemo(() => visit && floor ? renderBlueprintSvg(visit.plan, floor.level, {
    occupancy,
    manifests: visit.manifests,
    members: visit.household?.members,
    claimLabels: 'name',
    hour,
  }) : '', [visit, floor, hour, occupancy]);
  const furniture = examined == null ? null : floor?.furnishings[examined];
  const container = visit?.manifests.find((entry) => entry.level === floor?.level && entry.furnishingIndex === examined);

  return (
    <aside aria-label="Building details" data-testid="town-building-inspector" className="absolute inset-y-0 right-0 z-30 flex w-full max-w-lg flex-col overflow-y-auto border-l border-amber-300/40 bg-slate-950 p-4 text-slate-100 shadow-2xl [&>*]:shrink-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><h3 className="text-lg font-semibold text-amber-200">{businessName ?? (visit ? words(visit.plan.type) : 'Building details')}</h3><p className="text-sm text-slate-300">{visit ? `${words(visit.plan.type)} · ${visit.townName}` : ''}</p></div>
        <Button variant="secondary" size="sm" onClick={onClose}>Back to town</Button>
      </div>
      {result.error ? <p role="alert">{result.error}</p> : visit && floor ? <>
        {reservation && <section aria-label="Paid lodging" className="mb-4 rounded border border-amber-300/40 bg-slate-900 p-3 text-sm">
          <h4 className="font-semibold text-amber-200">{reservation.usedAt ? 'Paid night used' : gameTime && Date.parse(reservation.expiresAt) <= new Date(gameTime).getTime() ? 'Reservation expired' : 'Guest beds reserved'}</h4>
          <p>{reservation.beds.map(bed => guestBedDescription(visit, bed)).join('; ')}.</p>
          <p>Paid {reservation.costGp} GP. Valid until {formatGameDateTime(new Date(reservation.expiresAt))}. Food and water are separate.</p>
          {!reservation.usedAt && <p>Reach a reserved bed through the inn and select Use reserved guest bed. A reservation does not relocate the party.</p>}
            {!reservation.usedAt && reservedStairIssue && <p className="mt-2 text-amber-200">{reservedStairIssue} Your paid reservation remains recorded and unused.</p>}
        </section>}
        {visit.household && <section aria-label="Household" className="mb-4">
          <h4 className="font-semibold">{currentFamily ? currentFamily.person.name + "’s family" : visit.household.summary}</h4>
          {visit.workplaceOnly && <p className="mt-1 text-sm text-slate-300">Proprietor's household · lives elsewhere. Family membership does not imply employment here.</p>}
          {currentFamily ? <>
            <p className="mt-2 text-sm"><strong>{currentFamily.person.name}</strong> · {householdLifeAge(currentFamily.person,day)} years{head?.occupation ? ' · '+head.occupation : ''}{householdInstitutionRole(currentFamily.person,day) ? ' · Town role: '+householdInstitutionRole(currentFamily.person,day) : ''}</p>
            <ul data-testid="current-household-family" className="mt-2 space-y-1 text-sm">{currentFamily.relatives.map(relative => <li key={relative.person.occupantId}>
              <strong>{relative.person.name}</strong> · {relative.relation} · {householdLifeAge(relative.person,day)} years
              {relative.person.diedDay !== undefined && relative.person.diedDay <= day ? ' · deceased' : ''}
              {householdEntries.find(entry => entry.source?.person.occupantId === relative.person.occupantId)?.member.occupation ? ' · '+householdEntries.find(entry => entry.source?.person.occupantId === relative.person.occupantId)!.member.occupation : ''}
              {householdInstitutionRole(relative.person,day) ? ' · Town role: '+householdInstitutionRole(relative.person,day) : ''}
              {relative.partner ? ' · married to '+relative.partner.name : ''}
              {relative.homeElsewhere ? ' · home elsewhere in town' : ''}
            </li>)}</ul>
            {/* Family links do not cover servants, lodgers or other household
                roles. Retain those existing people and their schedule view. */}
            {otherHouseholdEntries.length > 0 && <>
              <h5 className="mt-3 text-sm font-semibold">Other household records</h5>
              <ul className="mt-1 space-y-1 text-sm">{otherHouseholdEntries.map(({member,index,source}) => {
                const age = source ? householdLifeAge(source.person,day) : member.age;
                const station = visit.occupancy?.stationsByHour[currentHour]?.find(entry => entry.memberIndex === index);
                const status = memberStatus(index);
                return <li key={index}><strong>{member.name}</strong> · {words(member.role)} · {age} years{member.occupation ? ' · '+member.occupation : ''}
                  {status === 'deceased' ? ' · deceased' : status === 'not-born' ? ' · not present' : status === 'unresolved' ? ' · identity unverified' : station ? ' · '+(station.where === 'out' ? 'away from this building' : words(station.activity)) : ''}
                </li>;
              })}</ul>
            </>}
          </> : <ul className="mt-2 space-y-1 text-sm">{visit.household.members.map((member, index) => {
            const station = visit.occupancy?.stationsByHour[currentHour]?.find((entry) => entry.memberIndex === index);
            return <li key={`${member.role}:${index}`}><strong>{member.name}</strong> · {words(member.role)} · {member.age} years{member.occupation ? ` · ${member.occupation}` : ''}{memberStatus(index) === 'deceased' ? ' · deceased' : memberStatus(index) === 'not-born' ? ' · not present' : memberStatus(index) === 'unresolved' ? ' · identity unverified' : station ? ` · ${station.where === 'out' ? 'away from this building' : words(station.activity)}` : ''}</li>;
          })}</ul>}
        </section>}
        {visit.isBusiness && onKeeperAction && <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="action" size="sm" disabled={!keeperOnDuty} onClick={() => { if (keeperOnDuty) onKeeperAction('talk'); }}>Talk to keeper</Button>
          <Button variant="action" size="sm" disabled={!keeperOnDuty} onClick={() => { if (keeperOnDuty) onKeeperAction('shop'); }}>Browse goods</Button>
          {guestBeds.length > 0 && <>
            <Button variant="action" size="sm" disabled={!keeperOnDuty || !lodgingKeeperOnDuty(visit, currentHour) || offeredBeds.length === 0} onClick={() => onKeeperAction('lodging')}>Ask about guest beds</Button>
            <p className="w-full text-sm text-slate-300">{guestBeds.length} guest beds · {LODGING_COST_PER_MEMBER_GP} GP per traveler for one night. Private bedrooms are not for hire.</p>
            {offeredBeds.length < guestBeds.length && <p className="w-full text-sm text-amber-200">{offeredBeds.length === 0 ? 'The guest rooms have no usable stair route. No new stay can be booked here.' : `${offeredBeds.length} beds can be booked; the other guest rooms have no usable stair route.`}</p>}
          </>}
          {!keeperOnDuty && <p className="w-full text-sm text-slate-300">{keeperUnavailableReason}{keeperAlive && <> {guestBedsForVisit(visit).length > 0 ? 'Guest beds cannot be booked without a keeper on duty.' : 'Trading and keeper conversation are unavailable.'}</>}</p>}
        </div>}
        <label className="mb-2 text-sm">Floor <select aria-label="Building floor" className="ml-2 rounded border border-slate-500 bg-slate-800 p-2" value={floor.level} onChange={(event) => { setLevel(Number(event.target.value)); setExamined(null); }}>
          {visit.plan.floors.map((entry) => <option key={entry.level} value={entry.level}>{entry.level < 0 ? 'Cellar' : entry.level === 0 ? 'Ground floor' : `Floor ${entry.level}`}</option>)}
        </select></label>
        <div className="mb-4 overflow-auto rounded bg-[#efe6d2] [&_svg]:h-auto [&_svg]:max-w-full" aria-label="Furnished floor plan" dangerouslySetInnerHTML={{ __html: svg }} />
        <h4 className="mb-2 font-semibold">Rooms and furnishings</h4>
        {floor.rooms.filter((room) => !room.isCorridor).map((room) => <section key={room.id} className="mb-3">
          <h5 className="text-sm font-semibold capitalize text-amber-100">{words(room.purpose)}</h5>
          <div className="mt-1 flex flex-wrap gap-2">{floor.furnishings.map((entry, index) => entry.roomId === room.id ? <Button key={index} variant="secondary" size="sm" aria-pressed={examined === index} onClick={() => setExamined(index)}>Examine {words(entry.kind)}</Button> : null)}</div>
        </section>)}
        {furniture && <section role="status" aria-live="polite" className="mt-2 rounded border border-amber-300/30 bg-slate-900 p-3 text-sm">
          <h4 className="mb-1 font-semibold capitalize">{words(furniture.kind)}</h4>
          {container ? <><p>Belongings of this household:</p><ul className="mt-1 list-inside list-disc">{container.entries.map((entry, index) => <li key={index}>{entry.qty} × {ALL_ITEMS[entry.itemId]?.name ?? words(entry.itemId)}</li>)}</ul></> : <p>{words(furniture.kind)} in the {words(floor.rooms.find((room) => room.id === furniture.roomId)?.purpose ?? 'room')}.</p>}
        </section>}
      </> : null}
    </aside>
  );
}
