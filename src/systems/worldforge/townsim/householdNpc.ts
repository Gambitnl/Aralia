/**
 * Projects a real household member into an existing game NPC. This repairs the
 * old independent keeper name/family draws while retaining the NPC id, earned
 * capabilities, equipment and memory. Household facts never reset a meeting.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/11/2026, 13:03:15
 * Dependents: components/Dialogue/DialogueInterface.tsx, components/World3D/ResidentProfile.tsx, components/World3D/World3DWrapper.tsx, components/World3D/groundResidentInteraction.ts, components/Worldforge/TownBuildingInspector.tsx, components/layout/GameModals.tsx, hooks/app/useAppLocationView.ts, services/dialogueService.ts, systems/social/npcDialogueMemory.ts, systems/social/npcInstitutionStatements.ts, systems/social/npcPersonalStatements.ts, systems/travel/npcLocalDirections.ts, systems/worldforge/townsim/npcsForCell.ts, systems/worldforge/townsim/registerBurgMerchants.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Household } from '../town/household';
import { DAYS_PER_YEAR } from './constants';
import { householdMemberIdentity } from '../town/householdBrief';
import type { FamilyMember, RichNPC } from '../../../types/world';
import { householdResidentAliveAt, householdResidentLifeStatusAt, householdResidentForKey, type TownLifeVillager, type TownLifeRegistry, type TownLifeState } from '../roster/agentLife';

type HouseholdNpc = RichNPC & {worldforgeHousehold?: {memberId: string; burgId: number; signature: string; legacyNameUnique?: boolean}};
export const householdResidentNpcId = (burgId: number, memberId: string) => `npc_burg_${burgId}_member_${memberId}`;

export function householdNpcFacts(home: Household, index: number, burgId: number, townName: string, keeperIds: ReadonlyMap<string, string> = new Map(), life?: TownLifeState, day = 0) {
  const member = home.members[index];
  if (!member) throw new Error(`Missing household member ${home.homeId}:${index}`);
  const relationTo = (role: string): FamilyMember['relation'] | null => {
    if (member.role === 'head' || member.role === 'spouse') {
      if (role === 'head' || role === 'spouse') return 'spouse';
      if (role === 'child') return 'child';
    }
    if (member.role === 'child') {
      if (role === 'head' || role === 'spouse') return 'parent';
      if (role === 'child') return 'sibling';
    }
    return null;
  };
  const family: FamilyMember[] = home.members.flatMap((relative, other) => {
    const relation = other !== index && relationTo(relative.role);
    const memberId = householdMemberIdentity(home, other);
    const lifeStatus = householdResidentLifeStatusAt(life, memberId, relative.name, day, home.members.filter(m => m.name === relative.name).length === 1);
    return relation ? [{id: keeperIds.get(memberId) ?? householdResidentNpcId(burgId, memberId), name: relative.name,
      age: relative.age, occupation: relative.occupation, relation,
      ...(lifeStatus === 'untracked' ? {} : {lifeStatus}), isAlive: householdResidentAliveAt(life, memberId, relative.name, day, home.members.filter(m => m.name === relative.name).length === 1)}] : [];
  });
  const description = `${member.name}, age ${member.age}, ${member.occupation || 'resident'}. ${home.summary}`;
  const lifeNote = (other: number) => {
    const relative = home.members[other];
    const status = householdResidentLifeStatusAt(life, householdMemberIdentity(home, other), relative.name, day,
      home.members.filter(m => m.name === relative.name).length === 1);
    return status === 'deceased' ? ', deceased' : status === 'unresolved' ? ', life record unresolved'
      : status === 'not-born' ? ', not present' : '';
  };
  return {name: member.name, occupation: member.occupation, age: member.age, family,
    legacyNameUnique: home.members.filter(m => m.name === member.name).length === 1,
    baseDescription: description,
    initialPersonalityPrompt: `${description} You live in ${townName}. Your household is: ${home.members.map((m, i) => `${m.name} (${m.role}, age ${m.age}${m.occupation ? `, ${m.occupation}` : ''}${lifeNote(i)})`).join('; ')}. Keep these people and relationships consistent. Do not claim to have met the player before unless your memory records it.`,
    visual: {description: `${member.name}, an ${member.ageBand} ${member.race} resident, age ${member.age}.`,
      portraitPrompt: `${member.name}, ${member.ageBand} ${member.race}, age ${member.age}, ${member.occupation || 'town resident'}.`, style: 'oil painting', themeColor: '#cccccc'}};
}

export function reconcileHouseholdNpc(npc: RichNPC, home: Household, index: number, burgId: number, townName: string, keeperIds?: ReadonlyMap<string, string>, life?: TownLifeState, day = 0): RichNPC {
  const facts = householdNpcFacts(home, index, burgId, townName, keeperIds, life, day);
  const signature = JSON.stringify(facts);
  if ((npc as HouseholdNpc).worldforgeHousehold?.signature === signature) return npc;
  const revised: HouseholdNpc = {...npc, name: facts.name, occupation: facts.occupation, baseDescription: facts.baseDescription,
    initialPersonalityPrompt: facts.initialPersonalityPrompt, visual: facts.visual,
    biography: {...npc.biography, age: facts.age, family: facts.family, background: undefined},
    worldforgeHousehold: {memberId: householdMemberIdentity(home, index), burgId, signature, legacyNameUnique: facts.legacyNameUnique}};
  return revised;
}

/** Saved NPC identity remains available to history; only present-day contact is gated. */
export function householdNpcLifeStatusAt(npc: RichNPC, registry: TownLifeRegistry | undefined, day: number) {
  const identity = (npc as HouseholdNpc).worldforgeHousehold;
  return identity ? householdResidentLifeStatusAt(registry?.[identity.burgId], identity.memberId, npc.name, day, identity.legacyNameUnique) : 'untracked';
}
export function householdNpcAliveAt(npc: RichNPC, registry: TownLifeRegistry | undefined, day: number): boolean {
  const status = householdNpcLifeStatusAt(npc, registry, day);
  return status !== 'deceased' && status !== 'not-born' && status !== 'unresolved';
}


/** The life registry may predate genealogy fields; missing ties stay unknown. */
type HouseholdLifePerson = TownLifeVillager & {spouseId?:number;parentIds?:number[];childIds?:number[]};
export interface HouseholdLifeFamily {
  person: HouseholdLifePerson;
  relatives: {person:HouseholdLifePerson;relation:'spouse'|'parent'|'child';partner?:HouseholdLifePerson;homeElsewhere:boolean}[];
  reply: string;
}

/** One read-only family view for speech and inspection. Original household
 * briefs and person records remain intact; a shared address creates no kinship. */
export function householdFamilyAt(town: TownLifeState | undefined, memberId:string, name:string, day:number, legacyNameUnique=true):HouseholdLifeFamily|undefined {
  if (!town || !Number.isInteger(day)) return undefined;
  const speaker = householdResidentForKey(town,memberId,name,legacyNameUnique);
  if (!speaker || speaker.name !== name || town.villagers[speaker.occupantId] !== speaker) return undefined;
  // History retains deceased relatives. Future births and conflicting IDs
  // cannot supply a present-day family answer, even if a biography names them.
  const person = (id: number | undefined): HouseholdLifePerson | undefined => {
    if (!Number.isInteger(id) || id === undefined || id <= 0) return undefined;
    const found = town.villagers[id] as HouseholdLifePerson | undefined;
    if (!found || found.occupantId !== id || !found.name?.trim()
      || !Number.isFinite(found.bornDay) || found.bornDay > day
      || found.diedDay !== undefined && !Number.isFinite(found.diedDay)
      || Object.values(town.villagers).filter(other => other.occupantId === id).length !== 1) return undefined;
    return found;
  };
  const self = person(speaker.occupantId);
  if (!self || self.diedDay !== undefined && self.diedDay <= day) return undefined;
  const lines: string[] = [];
  const relatives: HouseholdLifeFamily["relatives"] = [];
  const seen = new Set<number>([self.occupantId]);
  const describe = (relative: HouseholdLifePerson, relation: 'spouse'|'parent'|'child') => {
    if (seen.has(relative.occupantId)) return;
    seen.add(relative.occupantId);
    const deceased = relative.diedDay !== undefined && relative.diedDay <= day;
    let line = relative.name.trim() + ' is my ' + relation;
    if (deceased) line += ' (deceased)';
    let partner: HouseholdLifePerson | undefined;
    if (relation === 'child' && !deceased) {
      const candidate = person(relative.spouseId);
      partner = candidate && candidate.spouseId === relative.occupantId && candidate.occupantId !== self.occupantId && (candidate.diedDay === undefined || candidate.diedDay > day) ? candidate : undefined;
      if (partner && partner.occupantId !== self.occupantId && partner.spouseId === relative.occupantId
        && (partner.diedDay === undefined || partner.diedDay > day)) line += ', married to ' + partner.name.trim();
    }
    line += '.';
    if (relation === 'child' && !deceased && Number.isInteger(relative.homePlotId)
      && Number.isInteger(self.homePlotId) && relative.homePlotId !== self.homePlotId) line += ' Their home is elsewhere in town.';
    lines.push(line);
    relatives.push({person:relative,relation,partner,homeElsewhere:relation === 'child' && !deceased && Number.isInteger(relative.homePlotId) && Number.isInteger(self.homePlotId) && relative.homePlotId !== self.homePlotId});
  };
  const spouse = person(self.spouseId);
  if (spouse?.spouseId === self.occupantId) describe(spouse,'spouse');
  for (const id of self.parentIds ?? []) {
    const parent = person(id);
    if (parent?.childIds?.includes(self.occupantId)) describe(parent,'parent');
  }
  for (const id of self.childIds ?? []) {
    const child = person(id);
    if (child?.parentIds?.includes(self.occupantId)) describe(child,'child');
  }
  // An incomplete record is not evidence of being orphaned or having no family.
  return {person:self,relatives,reply:lines.join(' ') || "I don't have a clear family account to share just now."};
}


/** A saved institution is an additional civic responsibility, not a replacement
 * for household work or proof of spells, services, a location or recruitment.
 * Callers supply an admitted person from householdFamilyAt; dead and future
 * people cannot be described as holding a current office. Internal wildcard
 * tags and unknown legacy values have no player-facing title. */
export function householdInstitutionRole(person:(TownLifeVillager & {role?:unknown})|undefined,day:number):string|undefined {
  if (!person || !Number.isInteger(day) || !Number.isFinite(person.bornDay) || person.bornDay > day
    || person.diedDay !== undefined && (!Number.isFinite(person.diedDay) || person.diedDay <= day)) return undefined;
  return typeof person.role === 'string' && ['lord','priest','innkeeper','tavernkeeper','marketmaster','harbormaster'].includes(person.role) ? person.role : undefined;
}

/** Ages stop advancing at death; the founding biography is not rewritten. */
export function householdLifeAge(person:TownLifeVillager,day:number):number {
  return Math.floor((Math.min(day,person.diedDay ?? day)-person.bornDay)/DAYS_PER_YEAR);
}

/** A current profile replaces only the rendered description of an admitted
 * household person. Authored biographies and all saved capabilities survive. */
export function householdNpcDescription(npc:RichNPC,registry:TownLifeRegistry|undefined,day:number):string|undefined {
  const identity=(npc as HouseholdNpc).worldforgeHousehold;
  if (!identity) return undefined;
  const family=householdFamilyAt(registry?.[identity.burgId],identity.memberId,npc.name,day,identity.legacyNameUnique);
  if (!family) return undefined;
  const office=householdInstitutionRole(family.person,day);
  return npc.name+', age '+householdLifeAge(family.person,day)+(npc.occupation?.trim() ? ', '+npc.occupation.trim() : '')+'.'+(office ? ' Town role: '+office+'.' : '');
}
