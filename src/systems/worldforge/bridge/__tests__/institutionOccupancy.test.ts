/** A temple worker must occupy actual clear public floor, reuse one household
 * body, keep meals/sleep at home and hand off through the real door route. */
import { describe, expect, it } from 'vitest';
import { institutionDutyStation, institutionOccupancyBuildings } from '../institutionOccupancy';
import { residentDoorRoutes } from '../residentDoorRoutes';
import { allGroundAgentsAt } from '../groundAgentMotion';
import { furnishingFootprint } from '../../interior/householdFurnish';
import type { BlueprintPlan } from '../../interior/blueprintTypes';
import type { TownRoster } from '../../roster/types';
import type { TownPlan } from '../../artifacts';
import type { GroundWorld } from '../groundChunkLoader';
import { townBuildingVisit } from '../../../../components/Worldforge/townBuildingVisit';

type Building = GroundWorld['buildings'][number];
const FT = .3048;
// GG-552 (2026-11-01): the town-look rules re-lay out every NEW town (Remy's
// ruling q2, layout revision 2). The saved library and temple below keep the
// layout their save was made with, so they read layout revision 1.
const SAVED = 1 as const;
const floorPlan = (): BlueprintPlan => ({
  widthFt: 30, depthFt: 20, stairs: [],
  floors: [{level: 0,
    rooms: [{id: 1, purpose: 'nave', area: 600, anchor: {cx: 3, cy: 2},
      cells: Array.from({length: 24}, (_, i) => ({cx: i % 6, cy: Math.floor(i / 6)}))}],
    furnishings: [{kind: 'altar', roomId: 1, x: 15, y: 5, rotation: 0}],
    doors: [{a: -1, b: 1, x: 15, y: 20, axis: 'x', isEntry: true,
      openDir: {nx: 0, ny: -1}, swingInto: 1}],
  }],
} as unknown as BlueprintPlan);
const person = {id: 145, burgId: 675, name: 'Faelan Ironsmith', householdMemberId: 'b54:spouse',
  ageBand: 'elder', body: {sourceRecipe: 'same-body'},
  stationsByHour: Array.from({length: 24}, (_, hour) => hour >= 8 && hour < 18 ? null
    : {xFt: 5, yFt: 5, level: 0, activity: 'meal' as const})};
const roster = {burgId: 675, occupants: [{id: 145, name: person.name,
  householdMemberId: person.householdMemberId, homePlotId: 54, ageBand: 'elder',
  occupation: 'resident', civicWorkplace: {role: 'priest', plotId: 168}}]} as TownRoster;
const building = (id: number, x: number, role: string): Building => ({
  id: 'wf-plot-675-' + id, xM: x, zM: 0, heightM: 3, role,
  wallWidthM: 30 * FT, wallDepthM: 20 * FT,
  cornersM: [{x: x - 5, z: -5}, {x: x + 5, z: -5}, {x: x + 5, z: 5}, {x: x - 5, z: 5}],
  parts: [{x: 0, z: -3, w: 1, d: .1, h: 2, colorHex: '#654',
    door: {id: 'entry', level: 0, index: 0, axis: 'x', swingX: 0, swingZ: 1}}],
});
const inputs = () => {
  const home = building(54, 0, 'house');
  home.occupants = [person as never];
  return [home, building(168, 30, 'temple'), building(9, 60, 'workshop')];
};

describe('institution physical occupancy', () => {
  it('qualifies the real authored library study desk without changing its plan', () => {
    // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every
    // world): Menaikon (675) has no library now; Brampton (16) plot 0 is one.
    const visit = townBuildingVisit(1793146029630, 16, 0, undefined, undefined, SAVED);
    const before = JSON.stringify(visit.plan);
    expect(visit.household?.members[0].occupation).toBe('librarian');
    expect(institutionDutyStation(visit.plan, 'librarian')).toMatchObject({level: 0, activity: 'work'});
    expect(JSON.stringify(visit.plan)).toBe(before);
  }, 60000);

  it.each(['private', 'upper', 'no-entry', 'no-desk', 'packed'] as const)(
    'does not admit library duty on %s floor space', issue => {
      const plan = floorPlan(), floor = plan.floors[0];
      floor.rooms[0].purpose = 'study';
      floor.furnishings[0].kind = 'desk';
      if (issue === 'private') floor.rooms[0].purpose = 'bedroom';
      if (issue === 'upper') floor.level = 1;
      if (issue === 'no-entry') floor.doors = [];
      if (issue === 'no-desk') floor.furnishings = [];
      if (issue === 'packed') {
        floor.rooms[0].cells = [{cx: 0, cy: 0}];
        Object.assign(floor.furnishings[0], {x: 2.5, y: 2.5});
      }
      expect(institutionDutyStation(plan, 'librarian')).toBeUndefined();
    });

  it('uses a clear position beside the altar with a real entry approach', () => {
    const plan = floorPlan(), before = JSON.stringify(plan);
    const point = institutionDutyStation(plan)!;
    expect(point).toMatchObject({level: 0, activity: 'work'});
    expect(Number.isFinite(point.xFt) && Number.isFinite(point.yFt)).toBe(true);
    const box = furnishingFootprint(plan.floors[0].furnishings[0]);
    expect(point.xFt + 1 <= box.left || point.xFt - 1 >= box.right
      || point.yFt + 1 <= box.top || point.yFt - 1 >= box.bottom).toBe(true);
    expect(Math.hypot(point.xFt - 15, point.yFt - 20)).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(plan)).toBe(before);
  });

  it.each(['private', 'upper', 'no-entry', 'packed'] as const)('refuses %s floor space', kind => {
    const plan = floorPlan(), floor = plan.floors[0];
    if (kind === 'private') floor.rooms[0].purpose = 'vestry';
    if (kind === 'upper') floor.level = 1;
    if (kind === 'no-entry') floor.doors = [];
    if (kind === 'packed') floor.rooms[0].cells = [{cx: 0, cy: 0}];
    // A single tiny cell can still hold a body; pack it with the actual altar.
    if (kind === 'packed') floor.furnishings[0] = {...floor.furnishings[0], x: 2.5, y: 2.5};
    expect(institutionDutyStation(plan)).toBeUndefined();
  });

  it('reuses the same person/body without assigning merchant identity or moving source geometry', () => {
    const source = inputs(), plan = floorPlan(), before = JSON.stringify({source, roster, plan});
    const result = institutionOccupancyBuildings(675, roster, source, new Map([[168, plan]]));
    const work = result[1].occupants![0], home = result[0].occupants![0];
    expect(work).toMatchObject({id: 145, burgId: 675, name: person.name, householdMemberId: 'b54:spouse'});
    expect(work.body).toBe(person.body);
    expect(work.stationsByHour[14]).toEqual(institutionDutyStation(plan));
    expect(work.stationsByHour[7]).toBeNull();
    expect(work.stationsByHour[18]).toBeNull();
    expect(home.stationsByHour[14]).toBeNull();
    expect(home.stationsByHour[7]).toBe(person.stationsByHour[7]);
    expect(home.stationsByHour[18]).toBe(person.stationsByHour[18]);
    expect(result[2]).toBe(source[2]);
    for (let i = 0; i < source.length; i++) {
      expect(result[i].parts).toBe(source[i].parts);
      expect(result[i].cornersM).toBe(source[i].cornersM);
    }
    expect(roster.occupants[0].workPlotId).toBeUndefined();
    expect(JSON.stringify({source, roster, plan})).toBe(before);
  });

  it('does not create a substitute when the source body, identity or entry is missing', () => {
    for (const issue of ['body', 'name', 'entry', 'temple'] as const) {
      const source = inputs();
      if (issue === 'body') source[0].occupants = [];
      if (issue === 'name') source[0].occupants = [{...person, name: 'Other person'} as never];
      if (issue === 'entry') source[1].parts = [];
      if (issue === 'temple') source[1].role = 'workshop';
      expect(institutionOccupancyBuildings(675, roster, source, new Map([[168, floorPlan()]]))).toBe(source);
    }
  });

  it('supports the real saved Menaikon main-temple blueprint', () => {
    // Re-pinned 2026-10-31 after the GG-541 road fix (Remy chose to re-lay out every world).
    const visit = townBuildingVisit(1793146029630, 675, 164, undefined, undefined, SAVED);
    expect(visit.household).toBeUndefined();
    const point = institutionDutyStation(visit.plan);
    expect(point).toBeDefined();
    expect(point!.level).toBe(0);
  }, 60000);

  it('retains street ownership until the existing measured door-to-door trip arrives', () => {
    const source = inputs(), projected = institutionOccupancyBuildings(675, roster, source, new Map([[168, floorPlan()]]));
    const plan = {burgId: 675, plots: [
      {id: 54, footprint: [[-15,-10],[15,-10],[15,10],[-15,10]]},
      {id: 168, footprint: [[85,-10],[115,-10],[115,10],[85,10]]},
    ], streets: [{id: 1, widthFt: 10, centerline: [[0,-20],[100,-20]]}]} as unknown as TownPlan;
    const routed = residentDoorRoutes(plan, 675, projected, roster, {x: 0, y: 0});
    const delay = routed.buildings[1].occupants![0].interiorArrivalDelayByHour![8];
    expect(delay).toBeGreaterThan(0);
    const ground = {rosters: [roster], townPlans: [{burgId: 675, plan, streetGraph: routed.streetGraph}],
      boundsFeet: {x: 0, y: 0}} as GroundWorld;
    const leaving = allGroundAgentsAt(ground, 8)[0];
    const arrived = allGroundAgentsAt(ground, 8 + delay + 1e-8)[0];
    expect(leaving.moving).toBe(true);
    expect(arrived.moving).toBe(false);
    expect(arrived.activity).toBe('working');
    expect(arrived.xM).toBeCloseTo(30, 8);
    expect(arrived.zM).toBeCloseTo(-3, 8);
  });
});
