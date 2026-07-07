/**
 * @file types.ts — Data contracts for the living-world town sim (life-event core).
 *
 * Design source: docs/projects/worldforge/LIVING_WORLD_SIM_SPEC.md.
 *  - D7 (diary + meters): the chronicle's LifeEvent[] is the append-only source
 *    of truth; meters (wealth) are cached on LivingVillager and only ever move
 *    when an event is written ("the diary writes, the meter ticks").
 *  - D8 (event-grained): history is discrete facts, not a per-tick numeric sim.
 *
 * This is the foundation slice (§5 item 1: aging, death, inheritance, births,
 * role succession, coming-of-age). Economy / relationship / festival event
 * kinds are added by later plans; they pour into this same chronicle + meters.
 */

export type LifeEventKind =
  | 'birth'
  | 'death'
  | 'inheritance'
  | 'came_of_age'
  | 'role_succession'
  | 'courtship'
  | 'marriage'
  | 'economy'
  | 'festival'
  | 'disaster'
  // Pillar 2, Task 8 (living ecology): an occasional worry line about the
  // uncleared dungeons around the burg (raid-pressure signal, one visible
  // symptom). Never lethal — it colors the town's mood, not its population.
  | 'raid_worry';

/** One recorded fact in a town's history (a diary line). */
export interface LifeEvent {
  /** Monotonic id within a town's chronicle. */
  id: number;
  /** gameDay the event occurred. */
  day: number;
  kind: LifeEventKind;
  /** Primary villager the event is about. */
  subjectId: number;
  /** Secondary villagers touched (spouse, parents, heir, deceased, recipients). */
  relatedIds: number[];
  /** Plain-English diary line. */
  summary: string;
}

/** Town institutions a key NPC can hold. */
export type InstitutionRole =
  | 'lord'
  | 'priest'
  | 'innkeeper'
  | 'tavernkeeper'
  | 'marketmaster'
  | 'harbormaster'
  | 'wildcard';

/** A tracked person in the living-world sim (alive or, once dead, retained for genealogy). */
export interface LivingVillager {
  occupantId: number;
  name: string;
  race: string;
  /** gameDay of birth (may be negative for villagers alive at sim start). */
  bornDay: number;
  /** gameDay of death; undefined while alive. */
  diedDay?: number;
  spouseId?: number;
  /** Current courtship partner (pre-marriage); cleared on marriage or partner death. */
  courtingId?: number;
  /** gameDay the current courtship began. */
  courtshipStartDay?: number;
  parentIds: number[];
  childIds: number[];
  /** Institution held (key NPCs only). */
  role?: InstitutionRole;
  homePlotId: number;
  /** Cached wealth meter (folded from events; never negative). */
  wealth: number;
}

/** A town's append-only history. */
export interface TownChronicle {
  burgId: number;
  events: LifeEvent[];
  /** Next id to assign to a new event. */
  nextEventId: number;
}

/** The complete persistable state of one town's living-world sim. */
export interface TownSimState {
  burgId: number;
  /** Keyed by occupantId. Includes the dead (diedDay set) for genealogy. */
  villagers: Record<number, LivingVillager>;
  chronicle: TownChronicle;
  /** Town prosperity meter (0–100, ~50 typical), nudged by annual economy events. */
  prosperity?: number;
  /**
   * Cumulative lifetime tallies, never pruned. Lets population invariants be
   * checked even after the chronicle's old events are trimmed by retention.
   */
  totals?: { births: number; deaths: number };
  /** Last gameDay this state has been advanced to. */
  lastSimDay: number;
  /** Next occupant id to allocate for newborns. */
  nextVillagerId: number;
}
