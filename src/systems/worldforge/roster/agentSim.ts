/**
 * @file agentSim.ts — WF-AGENTSIM behaviour layer (SPEC §8).
 *
 * The schedule substrate (`occupantSchedule`) answers "where is occupant O at hour
 * H" from a FIXED hash-of-id routine. This layer makes townsfolk actually *decide*:
 * each has needs that decay/recover, picks an activity by its most-pressing need
 * (tempered by the time of day), spends/earns wealth, and socialises when it shares
 * a place with others. Needs PERSIST across ticks, so behaviour varies day to day
 * (a late shift → low energy → an early night) instead of repeating identically.
 *
 * Pure + deterministic: state in → state out, no Math.random / Date.now. A seeded
 * per-occupant stream supplies small threshold jitter so the town doesn't move in
 * lockstep. This is the stateful counterpart to the stateless `townSnapshotAt`;
 * a host ticks it forward and reads each agent's chosen `activity` + `targetPlotId`.
 */
import type { Occupant } from './types';

/** All needs are 0 (desperate) … 100 (fully satisfied). */
export interface AgentNeeds {
  /** Rest. Drains while awake (faster working), restored by sleeping. */
  energy: number;
  /** Food. Drains steadily, restored by eating (costs wealth). */
  satiety: number;
  /** Company. Drains over time, restored by being co-located with others. */
  social: number;
  /** Money. Earned by working, spent on eating/shopping. Never blocks survival. */
  wealth: number;
}

/** What an agent has chosen to do this tick. */
export type AgentActivity = 'sleep' | 'eat' | 'work' | 'socialize' | 'shop' | 'home';

/** One agent's evolving mind: needs + the decision it acted on this tick. */
export interface AgentMind {
  occupantId: number;
  needs: AgentNeeds;
  activity: AgentActivity;
  /** Plot the activity sends them to (home / work / a gathering place). */
  targetPlotId: number;
  /** True when this tick's social recovery came from real company (interaction). */
  socialized: boolean;
}

/** Town context the simulation reads (plots it can route activities to). */
export interface AgentSimContext {
  /** Plot ids that serve as gathering places (markets/workshops). */
  gatheringPlotIds: number[];
  /**
   * Optional kinship so families act together: a child trails an out-and-about
   * parent (or stays home with a resting one), and spouses who both go out to
   * socialise meet at the SAME place. Keyed by occupant id.
   */
  kin?: Map<number, { parentId?: number; spouseId?: number }>;
}

export interface StepOptions {
  /** Fractional hour of day (0–24). */
  hour: number;
  /** Sim time elapsed this step, in hours. */
  dtHours: number;
  context: AgentSimContext;
}

// ── Tuning (per-hour rates) ──────────────────────────────────────────────────
const DRAIN = { energyAwake: 6, energyWork: 9, satiety: 7, social: 5 } as const;
const RECOVER = { sleep: 14, eat: 40, socialAlone: 2, socialTogether: 22 } as const;
const WAGE_PER_HOUR = 8;
const MEAL_COST = 6;
const LOW = { energy: 25, satiety: 30, social: 25 } as const;
const clamp = (v: number): number => Math.max(0, Math.min(100, v));

/** Small stable hash → [0,1), so each occupant's thresholds jitter deterministically. */
function jitter01(id: number, salt: number): number {
  let h = (2166136261 ^ id ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Deterministic starting minds for a roster: everyone wakes rested + fed. */
export function initAgentMinds(occupants: Occupant[]): AgentMind[] {
  return occupants.map((o) => ({
    occupantId: o.id,
    needs: {
      // ±15% spread per person so the town isn't perfectly synchronized.
      energy: clamp(80 + (jitter01(o.id, 1) - 0.5) * 30),
      satiety: clamp(75 + (jitter01(o.id, 2) - 0.5) * 30),
      social: clamp(60 + (jitter01(o.id, 3) - 0.5) * 30),
      wealth: clamp(50 + (jitter01(o.id, 4) - 0.5) * 30),
    },
    activity: 'home',
    targetPlotId: o.homePlotId,
    socialized: false,
  }));
}

const wrapHour = (h: number): number => ((h % 24) + 24) % 24;

/**
 * Pick an activity from the agent's needs + the hour. Priority: survival
 * (sleep when exhausted or it's deep night) → eat when hungry → socialise when
 * lonely (daytime) → work the shift (workers) → idle at home. Per-person jitter
 * shifts the thresholds so neighbours don't flip in unison.
 */
function decide(occupant: Occupant, needs: AgentNeeds, hour: number): AgentActivity {
  const h = wrapHour(hour);
  const isWorker = occupant.workPlotId !== undefined && occupant.ageBand !== 'child';
  const night = h >= 22 || h < 6 + jitter01(occupant.id, 5) * 1.5;

  if (needs.energy <= LOW.energy * (0.8 + jitter01(occupant.id, 6) * 0.4)) return 'sleep';
  if (night) return 'sleep';
  if (needs.satiety <= LOW.satiety * (0.8 + jitter01(occupant.id, 7) * 0.4)) return 'eat';
  if (needs.social <= LOW.social * (0.8 + jitter01(occupant.id, 8) * 0.4)) return 'socialize';
  if (isWorker && h >= 7 && h < 18) return 'work';
  // Idle non-workers run a daytime errand sometimes; otherwise stay home.
  if (!isWorker && h >= 9 && h < 17 && jitter01(occupant.id, Math.floor(h)) > 0.6) return 'shop';
  return 'home';
}

/** Where an activity sends an agent. Gathering activities pick a stable market. */
function targetFor(occupant: Occupant, activity: AgentActivity, ctx: AgentSimContext): number {
  const gathering = ctx.gatheringPlotIds.length
    ? ctx.gatheringPlotIds[Math.abs(occupant.id) % ctx.gatheringPlotIds.length]
    : occupant.homePlotId;
  switch (activity) {
    case 'work': return occupant.workPlotId ?? occupant.homePlotId;
    case 'socialize':
    case 'shop': return gathering;
    case 'sleep':
    case 'eat':
    case 'home':
    default: return occupant.homePlotId;
  }
}

/**
 * Advance every agent one tick: decay needs, decide the next activity, apply the
 * activity's recovery (sleep→energy, eat→satiety−wealth, work→wealth), then resolve
 * co-location — agents sharing a plot while socialising recover MORE social and are
 * flagged `socialized` (a real interaction, not solo idling). Pure: returns new
 * minds; inputs are untouched.
 */
export function stepAgentSim(
  minds: AgentMind[],
  occupants: Occupant[],
  opts: StepOptions,
): AgentMind[] {
  const byId = new Map(occupants.map((o) => [o.id, o]));
  const { hour, dtHours, context } = opts;

  // Pass 1: decay + decide + per-activity recovery (excluding social-from-others).
  const next: AgentMind[] = minds.map((m) => {
    const occ = byId.get(m.occupantId);
    if (!occ) return m;
    const n: AgentNeeds = { ...m.needs };

    // Decay (we settle on the activity below; work uses the higher energy drain).
    // Sleeping pauses energy AND social drain — you don't tire or grow lonelier
    // asleep — so the town doesn't wake up uniformly exhausted/lonely and stampede
    // into one activity at dawn. Hunger still creeps up overnight (→ morning meals).
    const provisional = decide(occ, n, hour);
    n.satiety = clamp(n.satiety - DRAIN.satiety * dtHours);
    if (provisional !== 'sleep') {
      n.social = clamp(n.social - DRAIN.social * dtHours);
      n.energy = clamp(n.energy - (provisional === 'work' ? DRAIN.energyWork : DRAIN.energyAwake) * dtHours);
    }

    // Per-activity recovery / economy.
    switch (provisional) {
      case 'sleep': n.energy = clamp(n.energy + RECOVER.sleep * dtHours); break;
      case 'eat':
        n.satiety = clamp(n.satiety + RECOVER.eat * dtHours);
        n.wealth = clamp(n.wealth - MEAL_COST * dtHours);
        break;
      case 'work': n.wealth = clamp(n.wealth + WAGE_PER_HOUR * dtHours); break;
      case 'socialize': n.social = clamp(n.social + RECOVER.socialAlone * dtHours); break;
      default: break;
    }

    return {
      occupantId: m.occupantId,
      needs: n,
      activity: provisional,
      targetPlotId: targetFor(occ, provisional, context),
      socialized: false,
    };
  });

  // Pass 1.5: family coordination — kin move together.
  if (context.kin) {
    const mindById = new Map(next.map((m) => [m.occupantId, m]));
    // Spouses who both head out to socialise meet at ONE place (lower id decides).
    for (const m of next) {
      if (m.activity !== 'socialize') continue;
      const spouseId = context.kin.get(m.occupantId)?.spouseId;
      if (spouseId == null) continue;
      const sp = mindById.get(spouseId);
      if (sp && sp.activity === 'socialize') {
        const plot = m.occupantId < spouseId ? m.targetPlotId : sp.targetPlotId;
        m.targetPlotId = plot;
        sp.targetPlotId = plot;
      }
    }
    // Children trail an out-and-about parent; settle home with a resting one.
    for (const m of next) {
      const parentId = context.kin.get(m.occupantId)?.parentId;
      if (parentId == null) continue;
      const parent = mindById.get(parentId);
      if (!parent) continue;
      if (parent.activity === 'socialize' || parent.activity === 'shop') {
        m.activity = parent.activity;
        m.targetPlotId = parent.targetPlotId; // tag along with the parent
      } else if ((parent.activity === 'home' || parent.activity === 'sleep') && (m.activity === 'shop' || m.activity === 'socialize')) {
        const occ = byId.get(m.occupantId);
        m.activity = parent.activity === 'sleep' ? 'sleep' : 'home';
        if (occ) m.targetPlotId = occ.homePlotId; // stay home, don't wander off alone
      }
    }
  }

  // Pass 2: interactions — co-located socialisers boost each other's social need.
  const socialClusters = new Map<number, number>(); // plotId → count of socialisers
  for (const m of next) {
    if (m.activity === 'socialize') socialClusters.set(m.targetPlotId, (socialClusters.get(m.targetPlotId) ?? 0) + 1);
  }
  for (const m of next) {
    if (m.activity === 'socialize' && (socialClusters.get(m.targetPlotId) ?? 0) >= 2) {
      m.needs = { ...m.needs, social: clamp(m.needs.social + RECOVER.socialTogether * dtHours) };
      m.socialized = true;
    }
  }

  return next;
}
