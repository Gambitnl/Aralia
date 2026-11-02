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
 * role succession, coming-of-age). Later economy, relationship, disaster, and
 * building-evolution slices all pour into these same save-safe contracts.
 * Exact prevalidated additions let a prosperous year grow an occupied home
 * without rerolling or guessing its future geometry.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 31/10/2026, 21:11:55
 * Dependents: components/Worldforge/LivingWorldPreview.tsx, components/debug/TownHistoryDevOverlay.tsx, state/reducers/townReducer.ts, systems/intrigue/RumorMillSystem.ts, systems/worldforge/roster/agentDeepening.ts, systems/worldforge/roster/agentLife.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/chronicle.ts, systems/worldforge/townsim/chronicleForLocation.ts, systems/worldforge/townsim/graveyard.ts, systems/worldforge/townsim/inheritance.ts, systems/worldforge/townsim/keyNpcs.ts, systems/worldforge/townsim/townNews.ts, systems/worldforge/townsim/townSim.ts, systems/worldforge/townsim/townSimRegistration.ts, systems/worldforge/townsim/townSimRegistry.ts, systems/worldforge/townsim/townSituation.ts, utils/world/chronicleNewsToRumors.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BuildingEvent, BuildingEventLogsByPlot } from '../interior/blueprintTypes';
import type { ObservedBuildingSource } from '../interior/buildingSource';
import type { PlannedBuildingExtension } from '../interior/buildingExtensions';
import type { TownLayoutRevision } from '../town/townLayoutRevision';

/** Re-exported here so town-sim callers need one contract surface for persisted state. */
export type TownBuildingEvent = BuildingEvent;

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
  | 'building'
  // Player interventions share the town's append-only diary with simulated
  // events. That makes player agency visible to every existing chronicle/news
  // projection without creating a second source of world truth.
  | 'player_intervention'
  // Pillar 2, Task 8 (living ecology): an occasional worry line about the
  // uncleared dungeons around the burg (raid-pressure signal, one visible
  // symptom). Never lethal — it colors the town's mood, not its population.
  | 'raid_worry'
  // NPC lives (2026-11-02): a shop passes to an heir, closes with no heir, or
  // reopens under a new keeper. See shopLife.ts. Old saves never contain them.
  | 'shop_succession'
  | 'shop_closed'
  | 'shop_opened'
  // A villager crosses the rich or poor wealth threshold at a year boundary.
  | 'fortune_rose'
  | 'fortune_fell';

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
  /**
   * Optional causal receipt for events written by an external gameplay loop.
   * Sim-authored births, deaths, and economy ticks deliberately omit it. The
   * stable source key lets replayed UI actions prove an outcome already exists
   * instead of appending duplicate history after a reload or double click.
   */
  provenance?: {
    sourceKey: string;
    sourceEventId?: number;
    resolutionId?: string;
    actorName?: string;
  };
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
  /** Stable household provenance; older saves retain their original numeric id. */
  householdMemberId?: string;
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

// ============================================================================
// Agent-Sim Deepening State
// ============================================================================
// The visual agent simulation can opt into a richer daily layer without
// replacing the town's canonical villagers or chronicle. These records keep
// only bounded, replayable meters: current market facts, a capped set of social
// bonds, and the current weather. Births, deaths, marriages, and genealogy stay
// on LivingVillager and TownChronicle above.
// ============================================================================

/** The social meaning currently earned by repeated contact between two people. */
export type AgentRelationshipStatus = 'acquaintance' | 'friend' | 'rival' | 'courting';

/** One stable, unordered pair of villagers whose contact has changed over time. */
export interface AgentRelationshipBond {
  leftId: number;
  rightId: number;
  /** -100 (hostile) through 100 (devoted), clamped after every contact. */
  affinity: number;
  /** Lifetime contact days, capped so very old saves cannot grow the counter forever. */
  contactDays: number;
  status: AgentRelationshipStatus;
  lastContactDay: number;
}

/** Current bounded facts produced by wages, household costs, shops, and prices. */
export interface AgentEconomyState {
  /** 100 is an ordinary price level; the simulation clamps this to 60..180. */
  priceIndex: number;
  /** Capped cumulative shop takings, keyed only by real roster work plots. */
  shopIncomeByPlot: Record<number, number>;
  /** Current average resident wealth, grouped by canonical home plot. */
  districtWealthByHomePlot: Record<number, number>;
  lastUpdatedDay: number;
}

/** Weather is current state; notable changes are retained in the shared chronicle. */
export interface AgentTownEventState {
  weather: 'mild' | 'storm' | 'drought' | 'cold_snap';
  lastUpdatedDay: number;
}

/** Optional deepening payload stored beside, never instead of, canonical town state. */
export interface AgentDeepeningState {
  economy: AgentEconomyState;
  relationships: Record<string, AgentRelationshipBond>;
  townEvents: AgentTownEventState;
}

/**
 * The current keeper of one market or workshop plot. The chronicle keeps the
 * history (shop_succession, shop_closed, shop_opened); this record keeps only
 * the present holder, so readers do not replay the diary to staff a shop.
 */
export interface TownShopRecord {
  /** occupantId of the keeper, or null while the shop is closed. */
  keeperId: number | null;
  /** gameDay the current keeper took the shop (or the seed day). */
  sinceDay: number;
  /** gameDay the shop closed; absent while the shop is open. */
  closedDay?: number;
  /** Plain noun for the trade ("smithy", "general store"), for diary lines. */
  trade?: string;
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
  /** Canonical streets/lots/founding inputs used when this town registered.
   * Missing in older saves means unresolved, not revision 1 or today's layout.
   * Admission and intentional relayout must preserve people and site joins. */
  layoutRevision?: TownLayoutRevision;
  /** Keyed by occupantId. Includes the dead (diedDay set) for genealogy. */
  villagers: Record<number, LivingVillager>;
  chronicle: TownChronicle;
  /**
   * Sparse chronological logs keyed by canonical plot id. Optional for old
   * saves. Legacy arrays migrate into versioned folded snapshots plus a short
   * chronological tail; structural outcomes retain their absolute ordinals.
   */
  buildingEvents?: BuildingEventLogsByPlot;
  /** Sparse current door state by plot and geometry-backed door id. Old saves
   * omit it: generated entries begin closed. This is not structural history. */
  buildingDoors?: Record<number, Record<string, boolean>>;
  /** Exact first physically observed source. Old saves omit it; recording is
   * not a claim to recover historical originals or an automatic migration. */
  buildingSources?: Record<number, ObservedBuildingSource>;
  /**
   * Prevalidated future additions keyed by canonical plot id. Registration
   * derives these from the real lot and district roof grammar; old saves may
   * omit them and simply produce no structural growth until migrated.
   */
  buildingEvolution?: Record<number, {
    districtKey: string;
    roofForm: PlannedBuildingExtension['roofForm'];
    extensionCandidates: PlannedBuildingExtension[];
  }>;
  /** Town prosperity meter (0–100, ~50 typical), nudged by annual economy events. */
  prosperity?: number;
  /**
   * Cumulative lifetime tallies, never pruned. Lets population invariants be
   * checked even after the chronicle's old events are trimmed by retention.
   */
  totals?: { births: number; deaths: number };
  /**
   * Optional daily agent-sim detail. Old saves and life-event-only callers can
   * omit it; deepened replay initializes it deterministically from the roster.
   */
  agentDeepening?: AgentDeepeningState;
  /**
   * Current keepers of market and workshop plots, keyed by plot id. Seeded at
   * registration from roster occupants with a work plot. Old saves omit it:
   * missing means "untracked", and every shop rule then does nothing.
   */
  shops?: Record<number, TownShopRecord>;
  /** Last gameDay this state has been advanced to. */
  lastSimDay: number;
  /** Next occupant id to allocate for newborns. */
  nextVillagerId: number;
}
