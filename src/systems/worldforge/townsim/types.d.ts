/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 18/07/2026, 20:18:10
 * Dependents: components/Worldforge/LivingWorldPreview.tsx, components/debug/TownHistoryDevOverlay.tsx, systems/worldforge/roster/agentDeepening.ts, systems/worldforge/roster/agentLife.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/chronicle.ts, systems/worldforge/townsim/chronicleForLocation.ts, systems/worldforge/townsim/keyNpcs.ts, systems/worldforge/townsim/townNews.ts, systems/worldforge/townsim/townSim.ts, systems/worldforge/townsim/townSimRegistration.ts, systems/worldforge/townsim/townSimRegistry.ts, utils/world/chronicleNewsToRumors.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
import type { BuildingEvent, BuildingEventLogsByPlot } from '../interior/blueprintTypes';
import type { PlannedBuildingExtension } from '../interior/buildingExtensions';
/** Re-exported here so town-sim callers need one contract surface for persisted state. */
export type TownBuildingEvent = BuildingEvent;
export type LifeEventKind = 'birth' | 'death' | 'inheritance' | 'came_of_age' | 'role_succession' | 'courtship' | 'marriage' | 'economy' | 'festival' | 'disaster' | 'building' | 'raid_worry';
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
export type InstitutionRole = 'lord' | 'priest' | 'innkeeper' | 'tavernkeeper' | 'marketmaster' | 'harbormaster' | 'wildcard';
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
    /**
     * Sparse chronological logs keyed by canonical plot id. Optional for old
     * saves. Legacy arrays migrate into versioned folded snapshots plus a short
     * chronological tail; structural outcomes retain their absolute ordinals.
     */
    buildingEvents?: BuildingEventLogsByPlot;
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
    totals?: {
        births: number;
        deaths: number;
    };
    /**
     * Optional daily agent-sim detail. Old saves and life-event-only callers can
     * omit it; deepened replay initializes it deterministically from the roster.
     */
    agentDeepening?: AgentDeepeningState;
    /** Last gameDay this state has been advanced to. */
    lastSimDay: number;
    /** Next occupant id to allocate for newborns. */
    nextVillagerId: number;
}
