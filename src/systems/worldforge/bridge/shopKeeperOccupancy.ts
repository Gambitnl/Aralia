/**
 * @file shopKeeperOccupancy.ts — 3D shop occupants follow the town sim's keeper.
 *
 * NPC lives (GG-595 item 4, 2026-11-02). The town sim (`townsim/shopLife.ts`)
 * records who keeps each shop: an heir after a death, or a new keeper when a
 * closed shop reopens. The 3D bake drew each shop from its founding household,
 * so the counter showed the original family (or nobody, once the founder died)
 * while merchants and attendance already followed the sim.
 *
 * This module is the pure join. It finds each tracked open shop whose keeper is
 * not the founding keeper, and it rewrites the occupancy rows so that:
 *  - in the shop's own packet, the founding keeper's row is dropped and the new
 *    keeper stands at the founder's counter stations in the founder's working
 *    hours (a keeper who lives in this household keeps their own rows for the
 *    other hours);
 *  - in any other packet that holds the new keeper (their own home), the keeper
 *    is away (null) for those hours, so the same person is never drawn twice.
 *
 * PRESERVED: an untracked town (no `shops`), a closed shop, an unresolved
 * record and a shop still kept by its founder change nothing. Rows, stations
 * and households are never mutated; new arrays and rows are returned.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 11:11:49
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { OccupantDaySchedule } from './buildingOccupancy';
import type { Household } from '../town/household';
import { householdMemberIdentity } from '../town/householdBrief';
import { shopKeeperAt, type ShopLifeView } from '../townsim/shopLife';
import type { TownLifeVillager } from '../roster/agentLife';
import type { Occupant } from '../roster/types';

/** One shop whose sim keeper is not its founding keeper. */
export interface ShopTakeover {
  plotId: number;
  /** The sim's current keeper. */
  keeper: TownLifeVillager;
  /** The founding keeper's hours at the counter (0–23). */
  hours: number[];
}

/** True when a roster or life record is this sim villager. The household key
 * wins when both carry one; numeric ids are the legacy join. */
function samePerson(a: { id?: number; occupantId?: number; householdMemberId?: string }, keeper: TownLifeVillager): boolean {
  if (a.householdMemberId && keeper.householdMemberId) return a.householdMemberId === keeper.householdMemberId;
  return (a.occupantId ?? a.id) === keeper.occupantId;
}

/**
 * Each tracked open shop whose keeper on `day` is not its founding keeper.
 * `founders` maps a shop plot to its founding roster keeper and that keeper's
 * working hours (the roster schedule shares these hours with the interior).
 */
export function shopTakeoversAt(
  life: ShopLifeView | undefined,
  founders: ReadonlyMap<number, { founder: Pick<Occupant, 'id' | 'householdMemberId'>; hours: number[] }>,
  day: number,
): Map<number, ShopTakeover> {
  const out = new Map<number, ShopTakeover>();
  for (const plotId of [...founders.keys()].sort((a, b) => a - b)) {
    const status = shopKeeperAt(life, plotId, day);
    if (status.status !== 'open') continue;
    const { founder, hours } = founders.get(plotId)!;
    if (samePerson(founder, status.keeper)) continue;
    out.set(plotId, { plotId, keeper: status.keeper, hours: [...hours] });
  }
  return out;
}

/** The member index of `keeper` in `household`, if they belong to it. */
export function keeperIndexIn(household: Household, keeper: TownLifeVillager): number | undefined {
  for (let i = 0; i < household.members.length; i++) {
    if (keeper.householdMemberId
      ? householdMemberIdentity(household, i) === keeper.householdMemberId
      : household.members[i].name === keeper.name) return i;
  }
  return undefined;
}

/**
 * The shop packet's rows after a takeover. The founding keeper is member 0.
 * `keeperIndex` is the new keeper's member index in this household, or
 * undefined for a keeper from another household; that keeper gets a new row
 * at `outsideRowIndex` (past every member and visitor row, so it is unique).
 */
export function shopRowsWithKeeper(
  rows: readonly OccupantDaySchedule[],
  takeover: ShopTakeover,
  keeperIndex: number | undefined,
  outsideRowIndex: number,
): { rows: OccupantDaySchedule[]; outsideRow?: OccupantDaySchedule } {
  const founder = rows.find((r) => r.memberIndex === 0 && !r.visitor);
  const hours = new Set(takeover.hours);
  const counter = (h: number) => (hours.has(h) ? founder?.stationsByHour[h] ?? null : null);
  const kept = rows.filter((r) => r !== founder);
  if (keeperIndex !== undefined && keeperIndex !== 0) {
    const own = kept.find((r) => r.memberIndex === keeperIndex && !r.visitor);
    if (own) {
      const merged: OccupantDaySchedule = {
        ...own,
        occupation: founder?.occupation ?? own.occupation,
        stationsByHour: own.stationsByHour.map((s, h) => (hours.has(h) ? counter(h) : s)),
      };
      return { rows: kept.map((r) => (r === own ? merged : r)) };
    }
  }
  const outsideRow: OccupantDaySchedule = {
    memberIndex: outsideRowIndex,
    name: takeover.keeper.name.split(' ')[0],
    ageBand: 'adult',
    occupation: founder?.occupation ?? 'shopkeeper',
    stationsByHour: Array.from({ length: 24 }, (_, h) => counter(h)),
  };
  return { rows: [...kept, outsideRow], outsideRow };
}

/** Rows of another packet with this keeper away at the counter hours. */
export function rowsWithKeeperAway(
  rows: readonly OccupantDaySchedule[],
  household: Household,
  takeover: ShopTakeover,
): OccupantDaySchedule[] {
  const index = keeperIndexIn(household, takeover.keeper);
  if (index === undefined) return [...rows];
  const hours = new Set(takeover.hours);
  return rows.map((r) => (r.memberIndex === index && !r.visitor
    ? { ...r, stationsByHour: r.stationsByHour.map((s, h) => (hours.has(h) ? null : s)) }
    : r));
}
