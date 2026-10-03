// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 09/09/2026, 08:45:39
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file graveyard.ts — the town's dead, and the living who still remember them.
 *
 * The sim already retained dead villagers: `killVillager` stamps `diedDay` and
 * leaves the record in `state.villagers` for genealogy, and `pruneTownState`
 * deliberately keeps any dead villager still referenced by a LIVING relative.
 * That retention rule was never given a reading surface, so the accumulated dead
 * were invisible — a graveyard that filled up in the save file and nowhere else.
 *
 * This file is that reading surface. It is a pure PROJECTION: it derives graves
 * from state the sim already writes and stores nothing new, so it can never
 * disagree with the chronicle and adds no save-compat burden.
 *
 * The remembrance rule mirrors `pruneTownState` on purpose. A grave is tended
 * while a living relative anchors it; once the last of them dies the villager
 * falls out of retention on the next prune and the grave goes unmarked. Death
 * in this town is therefore two-stage — you die, and later you are forgotten —
 * which is the generational texture the family-tree design asks for.
 *
 * Deliberately NOT here: 3D placement. `props/generators/gravestoneGeometry.ts`
 * and the prop placement engine already own where a stone stands; this only says
 * whose name is on it. Wiring the two together is a later pass.
 *
 * Called by: graveyard tests today; chronicle/UI surfaces and prop placement next.
 * Depends on: types.ts + constants.ts. No rng and no clock — every value is
 * derived from days the sim already stamped on the villager.
 */
import { DAYS_PER_YEAR } from './constants';
import type { LivingVillager, TownSimState } from './types';

/** How a living villager is related to the person in the grave. */
export type MournerRelation = 'spouse' | 'child' | 'parent' | 'sibling' | 'grandchild';

/**
 * Strongest tie first. Sorting mourners this way means the UI can take the head
 * of the list ("survived by his wife Mara") without re-deriving precedence.
 */
const RELATION_ORDER: readonly MournerRelation[] = [
  'spouse',
  'child',
  'parent',
  'sibling',
  'grandchild',
];

/** One living person who still remembers the occupant of a grave. */
export interface Mourner {
  occupantId: number;
  name: string;
  relation: MournerRelation;
}

/** One grave in the town's burial ground. */
export interface Grave {
  occupantId: number;
  name: string;
  race: string;
  bornDay: number;
  diedDay: number;
  /** Whole years lived. Zero for an infant who did not see a birthday. */
  ageAtDeath: number;
  /** Home plot the deceased last belonged to — where the family still is. */
  homePlotId: number;
  /** Living kin, strongest tie first. Empty when nobody is left to remember. */
  mourners: Mourner[];
  /**
   * True when no living villager is kin to the deceased. Such a grave is the one
   * `pruneTownState` will eventually drop, so this flag is also the honest
   * warning that the record is not permanent.
   */
  forgotten: boolean;
  /** One-line memorial for UI; deterministic, no rng. */
  epitaph: string;
}

const isAlive = (v: LivingVillager): boolean => v.diedDay === undefined;

/** Whole years between two days, floored at 0 (an infant death reads as age 0). */
function yearsBetween(fromDay: number, toDay: number): number {
  return Math.max(0, Math.floor((toDay - fromDay) / DAYS_PER_YEAR));
}

/**
 * Relation of a LIVING villager to a DEAD one, or undefined if unrelated.
 * Grandchild is checked last and only through the stored parent links, so it
 * costs one extra hop and never needs a second genealogy index.
 */
function relationTo(
  villagers: Record<number, LivingVillager>,
  living: LivingVillager,
  dead: LivingVillager,
): MournerRelation | undefined {
  if (living.spouseId === dead.occupantId || dead.spouseId === living.occupantId) return 'spouse';
  if (living.parentIds.includes(dead.occupantId)) return 'child';
  if (living.childIds.includes(dead.occupantId)) return 'parent';
  if (
    living.parentIds.length > 0 &&
    living.parentIds.some((p) => dead.parentIds.includes(p))
  ) {
    return 'sibling';
  }
  for (const parentId of living.parentIds) {
    const parent = villagers[parentId];
    if (parent && parent.parentIds.includes(dead.occupantId)) return 'grandchild';
  }
  return undefined;
}

/**
 * Memorial line. Built from facts the sim already recorded (role, kin, age)
 * rather than a phrase table, so it stays true after any later rules change.
 */
function epitaphFor(dead: LivingVillager, age: number, mourners: Mourner[]): string {
  const held = dead.role ? `, ${dead.role} of this town` : '';
  if (mourners.length === 0) {
    return `${dead.name}${held}, died at ${age}. No kin remain to tend this stone.`;
  }
  const first = mourners[0];
  const others = mourners.length - 1;
  const rest = others > 0 ? ` and ${others} other${others > 1 ? 's' : ''}` : '';
  return `${dead.name}${held}, died at ${age}. Remembered by ${first.name} (${first.relation})${rest}.`;
}

/**
 * Every dead villager still held in state, newest burial first (ties broken by
 * id so the order is total and stable across saves).
 *
 * No current day is needed: ages come from each villager's own `bornDay`/
 * `diedDay`, so a grave reads identically whenever it is rendered.
 */
export function buildGraveyard(state: TownSimState): Grave[] {
  const villagers = state.villagers;
  const dead = Object.values(villagers).filter((v) => !isAlive(v));
  const living = Object.values(villagers).filter(isAlive);

  const graves = dead.map((d) => {
    const diedDay = d.diedDay as number;
    const mourners: Mourner[] = [];
    for (const l of living) {
      const relation = relationTo(villagers, l, d);
      if (relation) mourners.push({ occupantId: l.occupantId, name: l.name, relation });
    }
    mourners.sort(
      (a, b) =>
        RELATION_ORDER.indexOf(a.relation) - RELATION_ORDER.indexOf(b.relation) ||
        a.occupantId - b.occupantId,
    );
    const ageAtDeath = yearsBetween(d.bornDay, diedDay);
    return {
      occupantId: d.occupantId,
      name: d.name,
      race: d.race,
      bornDay: d.bornDay,
      diedDay,
      ageAtDeath,
      homePlotId: d.homePlotId,
      mourners,
      forgotten: mourners.length === 0,
      epitaph: epitaphFor(d, ageAtDeath, mourners),
    } satisfies Grave;
  });

  return graves.sort((a, b) => b.diedDay - a.diedDay || a.occupantId - b.occupantId);
}

/**
 * The graves one living villager visits — their own dead kin, strongest tie
 * first then most recent. This is the per-NPC hook a "visits the graveyard"
 * schedule slot or a grief/memory dialogue beat should read.
 */
export function gravesTendedBy(state: TownSimState, occupantId: number): Grave[] {
  return buildGraveyard(state)
    .filter((g) => g.mourners.some((m) => m.occupantId === occupantId))
    .sort((a, b) => {
      const ra = a.mourners.find((m) => m.occupantId === occupantId)!.relation;
      const rb = b.mourners.find((m) => m.occupantId === occupantId)!.relation;
      return RELATION_ORDER.indexOf(ra) - RELATION_ORDER.indexOf(rb) || b.diedDay - a.diedDay;
    });
}

/** Headline counts for a town-info panel. Cheap enough to call per render. */
export function graveyardSummary(state: TownSimState): {
  graves: number;
  tended: number;
  forgotten: number;
} {
  const graves = buildGraveyard(state);
  const forgotten = graves.filter((g) => g.forgotten).length;
  return { graves: graves.length, tended: graves.length - forgotten, forgotten };
}
