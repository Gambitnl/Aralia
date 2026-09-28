// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 30/08/2026, 02:32:20
 * Dependents: components/Town/NoticeBoard.tsx, state/reducers/factReducer.ts, state/reducers/worldReducer.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file townSituation.ts — The first World Echo Engine transaction.
 *
 * A situation is derived from a real TownSim chronicle event; it is not stored
 * as a second piece of state that could drift from the town. Resolving it
 * appends one `player_intervention` receipt to that same chronicle and adjusts
 * the town's existing prosperity meter. The pure result is suitable for a
 * reducer and remains deterministic across save/reload or action replay.
 */

import type { LifeEvent, LifeEventKind, TownSimState } from './types';
import { selectTownNews } from './townNews';

/** Public developments that invite player agency rather than private gossip. */
const ACTIONABLE_KINDS = new Set<LifeEventKind>([
  'disaster',
  'economy',
  'building',
  'raid_worry',
]);

/** The three materially different responses in the first playable situation. */
export type TownSituationResolutionId =
  | 'organize_response'
  | 'fund_response'
  | 'exploit_disruption';

export interface TownSituationResolution {
  id: TownSituationResolutionId;
  label: string;
  description: string;
  goldDelta: number;
  prosperityDelta: number;
}

/** UI-ready view derived entirely from a town's canonical chronicle. */
export interface TownSituation {
  key: string;
  burgId: number;
  sourceEventId: number;
  sourceKind: LifeEventKind;
  sourceText: string;
  resolved: boolean;
  outcome?: LifeEvent;
}

export type TownSituationResolutionStatus =
  | 'resolved'
  | 'already_resolved'
  | 'not_found'
  | 'insufficient_gold';

export interface ResolveTownSituationInput {
  sourceEventId: number;
  resolutionId: TownSituationResolutionId;
  currentDay: number;
  currentGold: number;
  actorName: string;
}

export interface ResolveTownSituationResult {
  status: TownSituationResolutionStatus;
  town: TownSimState;
  gold: number;
  resolution?: TownSituationResolution;
  outcome?: LifeEvent;
}

/**
 * Resolution definitions are data, so UI copy and mechanical effects cannot
 * disagree. Costs use signed deltas: funding costs 25 gp; exploiting the gap
 * earns 15 gp while reducing prosperity.
 */
export const TOWN_SITUATION_RESOLUTIONS: readonly TownSituationResolution[] = [
  {
    id: 'organize_response',
    label: 'Organize the town',
    description: 'Coordinate neighbors and tradespeople around what happens next.',
    goldDelta: 0,
    prosperityDelta: 2,
  },
  {
    id: 'fund_response',
    label: 'Back the town',
    description: 'Contribute 25 gp to turn this moment into lasting local progress.',
    goldDelta: -25,
    prosperityDelta: 5,
  },
  {
    id: 'exploit_disruption',
    label: 'Turn it to your advantage',
    description: 'Use the moment to make favorable deals and collect 15 gp.',
    goldDelta: 15,
    prosperityDelta: -4,
  },
] as const;

/** Stable identity shared by the outcome receipt and durable player knowledge. */
export function townSituationKey(burgId: number, sourceEventId: number): string {
  return `town_situation:${burgId}:${sourceEventId}`;
}

/** Return the outcome receipt already written for a source, if one exists. */
export function findTownSituationOutcome(
  town: TownSimState,
  sourceKey: string,
): LifeEvent | undefined {
  return town.chronicle.events.find(
    (event) =>
      event.kind === 'player_intervention' &&
      event.provenance?.sourceKey === sourceKey,
  );
}

/**
 * Pick the newest recent civic development and pair it with any existing player
 * outcome. Reusing the shared news projection keeps the situation and the
 * Notice Board on one recency rule, so an old event cannot look like a current
 * choice beside an otherwise empty board.
 *
 * We intentionally do not fall through to older events after resolution: the
 * board should remember what the player just did, not immediately become an
 * endless queue of historical chores.
 */
export function deriveTownSituation(
  town: TownSimState,
  currentDay: number,
): TownSituation | null {
  const source = selectTownNews(town, currentDay, { minProminence: 'notice' })
    .find((event) => ACTIONABLE_KINDS.has(event.kind));
  if (!source) return null;

  const key = townSituationKey(town.burgId, source.id);
  const outcome = findTownSituationOutcome(town, key);
  return {
    key,
    burgId: town.burgId,
    sourceEventId: source.id,
    sourceKind: source.kind,
    sourceText: source.text,
    resolved: Boolean(outcome),
    outcome,
  };
}

function clampProsperity(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function outcomeSummary(
  actorName: string,
  resolution: TownSituationResolution,
  sourceText: string,
): string {
  switch (resolution.id) {
    case 'organize_response':
      return `${actorName} organized neighbors after local news spread: ${sourceText}`;
    case 'fund_response':
      return `${actorName} invested 25 gp in the town after local news spread: ${sourceText}`;
    case 'exploit_disruption':
      return `${actorName} made 15 gp by leveraging the moment after local news spread: ${sourceText}`;
  }
}

/**
 * Resolve one current situation as an atomic immutable transaction. Invalid,
 * stale, unaffordable, and replayed inputs fail closed with the original town
 * reference and purse value, so reducers cannot partially apply an outcome.
 */
export function resolveTownSituation(
  town: TownSimState,
  input: ResolveTownSituationInput,
): ResolveTownSituationResult {
  const situation = deriveTownSituation(town, input.currentDay);
  if (!situation || situation.sourceEventId !== input.sourceEventId) {
    return { status: 'not_found', town, gold: input.currentGold };
  }

  if (situation.outcome) {
    return {
      status: 'already_resolved',
      town,
      gold: input.currentGold,
      outcome: situation.outcome,
    };
  }

  const resolution = TOWN_SITUATION_RESOLUTIONS.find(
    (candidate) => candidate.id === input.resolutionId,
  );
  if (!resolution) {
    return { status: 'not_found', town, gold: input.currentGold };
  }

  const nextGold = input.currentGold + resolution.goldDelta;
  if (nextGold < 0) {
    return {
      status: 'insufficient_gold',
      town,
      gold: input.currentGold,
      resolution,
    };
  }

  const outcome: LifeEvent = {
    id: town.chronicle.nextEventId,
    day: input.currentDay,
    kind: 'player_intervention',
    subjectId: 0,
    relatedIds: [],
    summary: outcomeSummary(input.actorName, resolution, situation.sourceText),
    provenance: {
      sourceKey: situation.key,
      sourceEventId: situation.sourceEventId,
      resolutionId: resolution.id,
      actorName: input.actorName,
    },
  };

  const nextTown: TownSimState = {
    ...town,
    prosperity: clampProsperity((town.prosperity ?? 50) + resolution.prosperityDelta),
    chronicle: {
      ...town.chronicle,
      events: [...town.chronicle.events, outcome],
      nextEventId: town.chronicle.nextEventId + 1,
    },
  };

  return {
    status: 'resolved',
    town: nextTown,
    gold: nextGold,
    resolution,
    outcome,
  };
}
