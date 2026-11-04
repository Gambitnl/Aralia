/**
 * GG-598 (2026-11-03): each station names what the body does with the furniture there.
 *
 * Hand-built rooms pin each rule; a real Sypege household proves that every home
 * station of a whole day gets a pose and that beds, tables and seats are found.
 */
import { describe, expect, it } from 'vitest';
import { computeOccupancy, type OccupantStation } from '../occupancy';
import { POSE_CLIPS, stationPose } from '../stationPose';
import type { BlueprintPlan } from '../blueprintTypes';
import { townBuildingVisit } from '../../../../components/Worldforge/townBuildingVisit';

const room = { id: 0, purpose: 'hall', cells: [0, 1, 2, 3].map((cx) => ({ cx, cy: 0 })), anchor: { cx: 0, cy: 0 } };
const plan = { stairs: [], floors: [{ level: 0, rooms: [room], doors: [], furnishings: [
  { kind: 'bed', roomId: 0, x: 2.5, y: 2.5, rotation: 90 },      // 0
  { kind: 'table', roomId: 0, x: 10, y: 2.5, rotation: 0 },      // 1
  { kind: 'bench', roomId: 0, x: 12, y: 2.5, rotation: 0 },      // 2
  { kind: 'anvil', roomId: 0, x: 17.5, y: 2.5, rotation: 0 },    // 3
  { kind: 'counter', roomId: 0, x: 15, y: 2.5, rotation: 0 },    // 4
  { kind: 'hearth', roomId: 0, x: 19, y: 4, rotation: 180 },     // 5
  { kind: 'desk', roomId: 0, x: 6, y: 4, rotation: 0 },          // 6
] }] } as unknown as BlueprintPlan;
const at = (activity: OccupantStation['activity'], furnishingIndex?: number, standing?: { xFt: number; yFt: number }): OccupantStation =>
  ({ memberIndex: 0, hour: 12, where: 'home', level: 0, roomId: 0, activity, furnishingIndex, standingPosition: standing });

describe('station poses (GG-598)', () => {
  it('lies a sleeper on their bed, with the bed turn', () => {
    expect(stationPose(plan, at('sleeping', 0))).toEqual({ pose: 'sleep', use: { kind: 'bed', xFt: 2.5, yFt: 2.5, rotation: 90 } });
    // The second of a couple has no bed index of their own: they share the bed.
    expect(stationPose(plan, at('sleeping'))).toEqual({ pose: 'sleep', use: { kind: 'bed', xFt: 2.5, yFt: 2.5, rotation: 90 } });
    const bare = structuredClone(plan); bare.floors[0].furnishings = bare.floors[0].furnishings.filter((f) => f.kind !== 'bed');
    expect(stationPose(bare, at('sleeping'))).toEqual({ pose: 'sleep' }); // a pallet on the floor
  });

  it('seats a meal on the nearest bench, facing the table', () => {
    expect(stationPose(plan, at('meal', 1, { xFt: 11, yFt: 2 }))).toEqual({
      pose: 'sit', use: { kind: 'bench', xFt: 12, yFt: 2.5, rotation: 0 }, faceFt: { xFt: 10, yFt: 2.5 } });
  });

  it('puts the smith at the anvil, a clerk at the desk and a seller behind the counter', () => {
    expect(stationPose(plan, at('work', 3))).toMatchObject({ pose: 'work-at', use: { kind: 'anvil' }, faceFt: { xFt: 17.5, yFt: 2.5 } });
    expect(stationPose(plan, at('work', 6))).toMatchObject({ pose: 'sit', use: { kind: 'desk' } });
    expect(stationPose(plan, at('work', 4))).toEqual({ pose: 'stand', faceFt: { xFt: 15, yFt: 2.5 } });
    expect(stationPose(plan, at('work'))).toEqual({ pose: 'stand' });
  });

  it('sits by the fire only when a seat is in reach, and does chores at a piece in reach', () => {
    expect(stationPose(plan, at('hearthside', 5, { xFt: 18, yFt: 3 }))).toEqual({ pose: 'stand', faceFt: { xFt: 19, yFt: 4 } });
    expect(stationPose(plan, at('hearthside', 5, { xFt: 13, yFt: 3 }))).toMatchObject({ pose: 'sit', use: { kind: 'bench' } });
    expect(stationPose(plan, at('chores', undefined, { xFt: 9, yFt: 3 }))).toMatchObject({ pose: 'work-at', use: { kind: 'table' } });
    expect(stationPose(plan, at('chores', undefined, { xFt: 2, yFt: 2 }))).toEqual({ pose: 'stand' });
  });

  it('gives no pose to a person who is out, and a clip for every pose', () => {
    expect(stationPose(plan, { memberIndex: 0, hour: 12, where: 'out', activity: 'out' })).toBeUndefined();
    expect(Object.keys(POSE_CLIPS).sort()).toEqual(['sit', 'sleep', 'stand', 'work-at']);
  });

  it('poses every home station of a real household for a whole day', () => {
    // The Hartdown house (burg 10, plot 1) in the saved Sypege layout (revision 4).
    const visit = townBuildingVisit(1793146029630, 10, 1, undefined, undefined, 4), home = visit.household!;
    const occ = computeOccupancy(visit.plan, home, { worksAtHome: false });
    const counts = new Map<string, number>();
    let homeStations = 0;
    for (const row of occ.stationsByHour) for (const station of row) {
      const info = stationPose(visit.plan, station);
      if (station.where !== 'home') { expect(info).toBeUndefined(); continue; }
      homeStations++;
      expect(info).toBeDefined();
      counts.set(`${station.activity}:${info!.pose}`, (counts.get(`${station.activity}:${info!.pose}`) ?? 0) + 1);
      if (station.activity === 'sleeping' && station.furnishingIndex !== undefined) {
        expect(info).toMatchObject({ pose: 'sleep', use: { kind: 'bed' } });
      }
    }
    expect(homeStations).toBeGreaterThan(0);
    // Sleepers lie down and the household sits to eat.
    expect(counts.get('sleeping:sleep') ?? 0).toBeGreaterThan(0);
    expect(counts.get('meal:sit') ?? 0).toBeGreaterThan(0);
    // Same plan and station, same pose.
    const sample = occ.stationsByHour[18].find((s) => s.where === 'home')!;
    expect(stationPose(visit.plan, sample)).toEqual(stationPose(visit.plan, sample));
  });
});
