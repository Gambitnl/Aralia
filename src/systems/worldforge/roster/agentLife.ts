// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 18/07/2026, 20:18:25
 * Dependents: None (Orphan)
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file joins the town's day-scale life history to the roster used by the
 * visual agent simulation.
 *
 * The older living-world engine already owns villagers, genealogy, and the
 * append-only chronicle. This adapter deliberately reuses that state instead
 * of creating a second population database. Callers provide an explicit day
 * and clock. Life-event-only replay advances aging, births, deaths, inheritance,
 * succession, and coming-of-age. The optional deepened mode follows each core
 * day with bounded economy, relationship, and town-event progression before it
 * returns the living roster for the newer hourly behaviour simulation. Buildings,
 * persistence wiring, React, and live-game integration remain outside this seam.
 *
 * Called by: focused agent-life tests today; future agent-sim hosts can consume
 * the replay snapshot without changing the canonical town-sim contracts.
 * Depends on: townSim for life-event rules, townSimRegistry for stable per-day
 * seeds, and roster/types for the existing visual-population shape.
 */
import { ageOf, rollTownDay } from '../townsim/townSim';
import { seedForTownDay } from '../townsim/townSimRegistry';
import type { LivingVillager, TownSimState } from '../townsim/types';
import { advanceAgentDeepeningDay } from './agentDeepening';
import type { AgeBand, Occupant, TownRoster } from './types';

// ============================================================================
// Public Replay Contracts
// ============================================================================
// The anchor day names the calendar day on which `dayStart` occurs. A clock
// before that anchor therefore belongs to the following calendar day. Keeping
// both values explicit prevents midnight from silently replaying the wrong day.
// ============================================================================

export interface AgentLifeMoment {
  /** Calendar day on which this replay window begins at `dayStart`. */
  anchorDay: number;
  /** Hour shown by the agent-sim clock; values are normalized into [0, 24). */
  hour: number;
}

export interface AgentLifeReplayOptions {
  /** Hour the behaviour day begins. Defaults to midnight; arbitrary values wrap. */
  dayStart?: number;
  /** Keep the core-only default, or opt into economy, relationships, and town events. */
  mode?: AgentLifeMode;
}

/** Optional daily layers supported by the same multi-day replay spine. */
export type AgentLifeMode = 'life-events' | 'deepened';

/** Inputs needed when advancing days without the one-call roster wrapper below. */
export interface AgentLifeAdvanceOptions {
  mode?: AgentLifeMode;
  /** Deepened replay reads existing home, work, age-band, and occupation facts. */
  roster?: TownRoster;
}

export interface ResolvedAgentLifeMoment {
  /** Calendar day after accounting for an anchored replay crossing midnight. */
  day: number;
  /** Normalized hour in [0, 24). */
  hour: number;
}

export interface AgentLifeSnapshot extends ResolvedAgentLifeMoment {
  /** Replayable canonical life-event state, including dead genealogical records. */
  state: TownSimState;
  /** Only people alive at this moment, shaped for the hourly behaviour sim. */
  roster: TownRoster;
}

// ============================================================================
// Clock And Day Resolution
// ============================================================================
// This mirrors simulateMindsTo's forward-from-dayStart interpretation. For
// example, a 06:00 anchor reaching 03:00 crosses midnight and lands on day + 1;
// an equivalent dayStart of 30 resolves identically because both mean 06:00.
// ============================================================================

const wrapHour = (hour: number): number => ((hour % 24) + 24) % 24;

/** Resolve an anchored agent clock to one unambiguous calendar day and hour. */
export function resolveAgentLifeMoment(
  moment: AgentLifeMoment,
  opts: AgentLifeReplayOptions = {},
): ResolvedAgentLifeMoment {
  if (!Number.isFinite(moment.anchorDay) || !Number.isFinite(moment.hour)) {
    throw new RangeError('Agent life replay requires a finite day and hour.');
  }

  const anchorDay = Math.trunc(moment.anchorDay);
  const start = wrapHour(opts.dayStart ?? 0);
  const hour = wrapHour(moment.hour);

  // A target earlier on the clock face is still forward in the replay window:
  // it occurs after midnight on the next calendar day. Equality is the fresh
  // anchor itself and therefore stays on the anchor day.
  return { day: anchorDay + (hour < start ? 1 : 0), hour };
}

// ============================================================================
// Deterministic Life-Event Progression
// ============================================================================
// Each calendar day receives its own seed, matching the production town-sim
// replay contract. Advancing ten days at once therefore equals two five-day
// advances, which makes saved state safe to resume without rerolling history.
// ============================================================================

/** Advance the multi-day spine to an explicit calendar day. */
export function advanceAgentLifeDays(
  state: TownSimState,
  worldSeed: number,
  targetDay: number,
  opts: AgentLifeAdvanceOptions = {},
): TownSimState {
  if (!Number.isFinite(targetDay)) {
    throw new RangeError('Agent life replay requires a finite target day.');
  }

  const resolvedTargetDay = Math.trunc(targetDay);
  if (resolvedTargetDay < state.lastSimDay) {
    throw new RangeError(
      `Agent life replay cannot move backward from day ${state.lastSimDay} to ${resolvedTargetDay}.`,
    );
  }

  // The richer economy and contact layers need the already-generated roster.
  // Failing loudly prevents a caller from silently receiving a half-deepened town.
  if (opts.mode === 'deepened' && !opts.roster) {
    throw new RangeError('Deepened agent life replay requires the generated town roster.');
  }

  let next = state;
  for (let day = state.lastSimDay + 1; day <= resolvedTargetDay; day += 1) {
    const lifeState = rollTownDay(
      next,
      day,
      seedForTownDay(worldSeed, next.burgId, day),
      { mode: 'life-events' },
    );
    next = opts.mode === 'deepened'
      ? advanceAgentDeepeningDay(lifeState, opts.roster!, worldSeed, day)
      : lifeState;
  }
  return next;
}

// ============================================================================
// Living Roster Projection
// ============================================================================
// The town-sim state retains the dead for family history, while the hourly
// behaviour sim should move only people alive on the requested day. Existing
// jobs are preserved from the generated roster; newborns begin as residents.
// ============================================================================

/** Convert exact age into the broad bands already understood by agentSim. */
function ageBandFor(villager: LivingVillager, day: number): AgeBand {
  const age = ageOf(villager, day);
  if (age < 16) return 'child';
  if (age >= 58) return 'elder';
  return 'adult';
}

/** True when a genealogical record represents a person alive on this day. */
function isAliveOn(villager: LivingVillager, day: number): boolean {
  return villager.bornDay <= day
    && (villager.diedDay === undefined || villager.diedDay > day);
}

/** Project canonical life state into the existing, id-sorted visual roster. */
export function livingRosterAt(
  state: TownSimState,
  generatedRoster: TownRoster,
  day: number,
): TownRoster {
  const generatedById = new Map(generatedRoster.occupants.map((occupant) => [occupant.id, occupant]));

  const occupants: Occupant[] = Object.values(state.villagers)
    .filter((villager) => isAliveOn(villager, day))
    .sort((left, right) => left.occupantId - right.occupantId)
    .map((villager) => {
      const generated = generatedById.get(villager.occupantId);

      // Original residents retain their work assignment and occupation. A
      // newborn has no prior job, so it enters the behaviour sim as a resident
      // until a later economy/workplace layer intentionally assigns one.
      return {
        ...(generated ?? {
          id: villager.occupantId,
          occupation: 'resident' as const,
          ageBand: 'child' as const,
          homePlotId: villager.homePlotId,
          name: villager.name,
        }),
        id: villager.occupantId,
        name: villager.name,
        ageBand: ageBandFor(villager, day),
        homePlotId: villager.homePlotId,
      };
    });

  return { burgId: state.burgId, occupants };
}

// ============================================================================
// One-Call Replay Surface
// ============================================================================
// Hosts can rebuild the same snapshot from the same initial state, world seed,
// and moment. The hourly behaviour replay remains separate and can consume the
// returned roster with its existing arbitrary-dayStart logic.
// ============================================================================

/** Advance life history and return the living roster for one anchored clock. */
export function replayAgentLifeTo(
  state: TownSimState,
  generatedRoster: TownRoster,
  worldSeed: number,
  moment: AgentLifeMoment,
  opts: AgentLifeReplayOptions = {},
): AgentLifeSnapshot {
  const resolved = resolveAgentLifeMoment(moment, opts);
  const next = advanceAgentLifeDays(state, worldSeed, resolved.day, {
    mode: opts.mode,
    roster: generatedRoster,
  });

  return {
    ...resolved,
    state: next,
    roster: livingRosterAt(next, generatedRoster, resolved.day),
  };
}
