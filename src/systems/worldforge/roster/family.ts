/**
 * @file family.ts — kinship + ages for a town roster.
 *
 * `generateTownRoster` groups occupants into households by home plot but says
 * nothing about who is related to whom. This pass adds it, deterministically:
 * every villager gets a concrete age, and households resolve into believable
 * families — a married couple with children, a single parent, siblings sharing a
 * roof. Whoever has NO close kin in town either has relatives in ANOTHER town or
 * is genuinely alone in the world. Pure: same roster + seed → identical families.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/11/2026, 13:07:47
 * Dependents: components/Worldforge/AgentSimPreview.tsx, components/Worldforge/LivingWorldPreview.tsx, components/Worldforge/VillagerRegistry.tsx, systems/worldforge/roster/relationshipWeb.ts, systems/worldforge/town/household.ts, systems/worldforge/townsim/townSim.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Occupant, AgeBand } from './types';
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';

export type KinRelation = 'parent' | 'child' | 'sibling' | 'spouse' | 'cousin' | 'aunt/uncle';

/** A relative who lives in a DIFFERENT town (no presence in this roster). */
export interface DistantKin {
  town: string;
  relation: KinRelation;
  name: string;
}

/** One villager's age + family ties (ids reference fellow in-town occupants). */
export interface FamilyTies {
  occupantId: number;
  age: number;
  /** Ancestry (a `RACE_GROUPS` name). Blood relatives share it; a married-in
   *  spouse may differ — the only intra-family exception. */
  race: string;
  spouseId?: number;
  parentIds: number[];
  childIds: number[];
  siblingIds: number[];
  distantKin: DistantKin[];
  /** True when the villager has no known family anywhere — in town or beyond. */
  alone: boolean;
}

const AGE_RANGE: Record<AgeBand, [number, number]> = {
  child: [4, 15],
  adult: [20, 55],
  elder: [58, 84],
};

// Weighted townsfolk ancestries (names match `data/races/raceGroups.ts`): a town
// skews human with a coherent spread of the common civilised folk + a few rarer.
// Exported so the SP-T lazy household generator (town/household.ts) draws ancestry
// from the SAME distribution the whole-town roster + agent-sim use.
export const TOWNSFOLK_RACES: readonly string[] = [
  'Human', 'Human', 'Human', 'Human', 'Human', 'Human', 'Human', 'Human',
  'Elf', 'Elf', 'Elf', 'Elf',
  'Dwarf', 'Dwarf', 'Dwarf', 'Dwarf',
  'Halfling', 'Halfling', 'Halfling',
  'Gnome', 'Gnome', 'Gnome',
  'Half-Elf', 'Half-Elf', 'Half-Elf',
  'Greenskins', 'Greenskins',
  'Goliath', 'Tiefling', 'Aasimar', 'Draconic Kin', 'Beastfolk',
];

const TOWN_SYLL = ['ash', 'bre', 'dun', 'el', 'far', 'glen', 'holt', 'mere', 'oak', 'win', 'thorn', 'vale', 'kirk', 'stow'];
const KIN_SYLL = ['ad', 'bel', 'cor', 'del', 'ed', 'fen', 'gris', 'hal', 'isa', 'jor', 'lin', 'mara', 'ned', 'ros'];

interface Rng { next(): number }
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng.next() * arr.length)] ?? arr[0];
const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function syllName(rng: Rng, parts: readonly string[]): string {
  const n = 2 + Math.floor(rng.next() * 2);
  let s = '';
  for (let i = 0; i < n; i++) s += pick(rng, parts);
  return titleCase(s);
}

const DISTANT_RELATIONS: KinRelation[] = ['parent', 'sibling', 'child', 'cousin', 'aunt/uncle'];

/**
 * Resolve ages + family structure for a roster. Returns a map keyed by occupant
 * id. Deterministic over a sorted traversal so household decisions never depend
 * on input order.
 */
/** Source farm members keep their original ages, ancestry and roles. Run the
 * legacy random family pass on urban residents alone, so appending a farm
 * cannot redraw an established marriage, sibling or distant-family decision. */
export function assignFamilies(occupants:Occupant[],seedPath:SeedPath):Map<number,FamilyTies>{
 const rural=occupants.filter(o=>o.ruralHousehold);
 if(!rural.length)return assignGeneratedFamilies(occupants,seedPath);
 const ties=assignGeneratedFamilies(occupants.filter(o=>!o.ruralHousehold),seedPath);
 const households=new Map<number,Occupant[]>();
 for(const person of [...rural].sort((a,b)=>a.id-b.id)){
  const source=person.ruralHousehold!,member=source.member;
  if(ties.has(person.id)||!person.householdMemberId?.startsWith(source.farmId+':')
   ||!Number.isFinite(member.age)||member.age<0||!member.race)throw new Error('Source farm family identity or age is inconsistent');
  ties.set(person.id,{occupantId:person.id,age:member.age,race:member.race,parentIds:[],childIds:[],siblingIds:[],distantKin:[],alone:false});
  const group=households.get(person.homePlotId)??[];group.push(person);households.set(person.homePlotId,group);
 }
 for(const members of households.values()){
  const farmIds=new Set(members.map(o=>o.ruralHousehold!.farmId));
  const heads=members.filter(o=>o.ruralHousehold!.member.role==='head'),spouses=members.filter(o=>o.ruralHousehold!.member.role==='spouse');
  if(farmIds.size!==1||heads.length>1||spouses.length>1)throw new Error('Source farm family has ambiguous household roles');
  const parents=[...heads,...spouses],children=members.filter(o=>o.ruralHousehold!.member.role==='child');
  if(heads.length===1&&spouses.length===1){ties.get(heads[0].id)!.spouseId=spouses[0].id;ties.get(spouses[0].id)!.spouseId=heads[0].id;}
  for(const child of children){const own=ties.get(child.id)!;
   own.parentIds=parents.map(p=>p.id);own.siblingIds=children.filter(s=>s.id!==child.id).map(s=>s.id);
   for(const parent of parents)ties.get(parent.id)!.childIds.push(child.id);
  }
  // Elder/kin/lodger labels do not identify a specific parent or a distant
  // relation. Leave that unfinished world knowledge unasserted, not rerolled.
 }
 return ties;
}

function assignGeneratedFamilies(occupants: Occupant[], seedPath: SeedPath): Map<number, FamilyTies> {
  const rng = rngFromPath(streamPath(seedPath, 'family'));
  const ties = new Map<number, FamilyTies>();

  // Ages + a provisional ancestry first (sorted by id for order-independence).
  // Households below re-stamp blood relatives to one ancestry; a married-in spouse
  // keeps this independent draw, so mixed marriages happen but bloodlines stay pure.
  for (const o of [...occupants].sort((a, b) => a.id - b.id)) {
    const [lo, hi] = AGE_RANGE[o.ageBand] ?? [20, 55];
    ties.set(o.id, {
      occupantId: o.id,
      age: lo + Math.floor(rng.next() * (hi - lo + 1)),
      race: pick(rng, TOWNSFOLK_RACES),
      parentIds: [], childIds: [], siblingIds: [], distantKin: [], alone: false,
    });
  }

  // Group into households by home plot.
  const households = new Map<number, Occupant[]>();
  for (const o of occupants) {
    const list = households.get(o.homePlotId);
    if (list) list.push(o); else households.set(o.homePlotId, [o]);
  }

  for (const plotId of [...households.keys()].sort((a, b) => a - b)) {
    const members = households.get(plotId)!.slice().sort((a, b) => a.id - b.id);
    const adults = members.filter((m) => m.ageBand !== 'child');
    const children = members.filter((m) => m.ageBand === 'child');

    if (adults.length >= 2 && rng.next() > 0.15) {
      // A married couple heads the household. `a`'s bloodline defines the race;
      // `b` married in and keeps their own (possibly different) ancestry.
      const [a, b, ...rest] = adults;
      const bloodRace = ties.get(a.id)!.race;
      ties.get(a.id)!.spouseId = b.id;
      ties.get(b.id)!.spouseId = a.id;
      for (const c of children) {
        ties.get(c.id)!.parentIds = [a.id, b.id];
        ties.get(c.id)!.race = bloodRace; // children take the bloodline
        ties.get(a.id)!.childIds.push(c.id);
        ties.get(b.id)!.childIds.push(c.id);
      }
      // Remaining adults are a sibling of the head — same blood, same race.
      for (const sib of rest) {
        ties.get(sib.id)!.race = bloodRace;
        ties.get(sib.id)!.siblingIds.push(a.id);
        ties.get(a.id)!.siblingIds.push(sib.id);
      }
    } else if (adults.length >= 1) {
      // A single adult (lone, or a single parent), with any other adults as siblings.
      const [head, ...sibs] = adults;
      const bloodRace = ties.get(head.id)!.race;
      for (const c of children) {
        ties.get(c.id)!.parentIds = [head.id];
        ties.get(c.id)!.race = bloodRace;
        ties.get(head.id)!.childIds.push(c.id);
      }
      for (const sib of sibs) {
        ties.get(sib.id)!.race = bloodRace;
        ties.get(sib.id)!.siblingIds.push(head.id);
        ties.get(head.id)!.siblingIds.push(sib.id);
      }
    }
  }

  // Whoever ended up with NO close in-town kin: family elsewhere, or nobody.
  for (const o of [...occupants].sort((a, b) => a.id - b.id)) {
    const t = ties.get(o.id)!;
    const hasInTown = t.spouseId !== undefined || t.parentIds.length > 0 || t.childIds.length > 0 || t.siblingIds.length > 0;
    if (hasInTown) continue;
    if (rng.next() < 0.55) {
      const count = 1 + Math.floor(rng.next() * 2);
      for (let i = 0; i < count; i++) {
        t.distantKin.push({ town: syllName(rng, TOWN_SYLL), relation: pick(rng, DISTANT_RELATIONS), name: syllName(rng, KIN_SYLL) });
      }
    } else {
      t.alone = true;
    }
  }

  return ties;
}

/** One-line family summary for UI, resolving in-town ids to names. */
export function familySummary(ties: FamilyTies, nameOf: (id: number) => string): string {
  if (ties.spouseId !== undefined) {
    const kids = ties.childIds.length;
    return `Married to ${nameOf(ties.spouseId)}${kids ? ` · ${kids} child${kids > 1 ? 'ren' : ''}` : ''}`;
  }
  if (ties.parentIds.length > 0) return `Child of ${ties.parentIds.map(nameOf).join(' & ')}`;
  if (ties.childIds.length > 0) return `Single parent of ${ties.childIds.length} child${ties.childIds.length > 1 ? 'ren' : ''}`;
  if (ties.siblingIds.length > 0) return `Sibling of ${ties.siblingIds.map(nameOf).join(', ')}`;
  if (ties.distantKin.length > 0) {
    const k = ties.distantKin[0];
    return `Family in ${k.town} (a ${k.relation})`;
  }
  return ties.alone ? 'No known family' : 'No close family in town';
}
