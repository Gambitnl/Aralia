/** Character-sized floorplans keep the five-foot grid and town parcel limits. */
import { describe, expect, it } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import { genFootprint } from '../footprint';
import { generateBuilding } from '../generateBuilding';
import type { BuildingType } from '../blueprintTypes';

describe('character-scale building allocation', () => {
  it('never labels a five-foot bent wing as a guest room across hospitality plans', () => {
    for (const type of ['tavern', 'inn'] as const) {
      for (const seed of [792767481, ...Array.from({ length: 40 }, (_, i) => i)]) {
        const plan = generateBuilding({ buildingId: 1, type, seedPath: rootSeedPath(seed), storeys: 2, basement: true });
        for (const room of plan.floors.flatMap(floor => floor.rooms)) {
          if (room.purpose !== 'guest-room' && room.purpose !== 'bedroom') continue;
          const occupied = new Set(room.cells.map(c => `${c.cx},${c.cy}`));
          expect(room.cells.some(c => occupied.has(`${c.cx + 1},${c.cy}`)
            && occupied.has(`${c.cx},${c.cy + 1}`)
            && occupied.has(`${c.cx + 1},${c.cy + 1}`)), `${type} ${seed} room ${room.id}`).toBe(true);
        }
      }
    }
  });

  it('keeps the reported tavern guest wing accessible when its kitchen is closed', () => {
    const plan = generateBuilding({ buildingId: 1, type: 'tavern', seedPath: rootSeedPath(792767481), storeys: 2, basement: true });
    const ground = plan.floors.find(floor => floor.level === 0)!;
    const kitchen = ground.rooms.find(room => room.purpose === 'kitchen')!;
    expect(kitchen).toBeDefined();
    expect(kitchen.cells.length * 25).toBeGreaterThanOrEqual(225);
    const entry = ground.doors.find(door => door.isEntry)!;
    const reachable = new Set([entry.b]);
    const pending = [entry.b];
    while (pending.length) {
      const current = pending.pop()!;
      for (const door of ground.doors) {
        const next = door.a === current ? door.b : door.b === current ? door.a : undefined;
        if (next === undefined || next < 0 || next === kitchen.id || reachable.has(next)) continue;
        reachable.add(next);
        pending.push(next);
      }
    }
    const guests = ground.rooms.filter(room => room.purpose === 'guest-room');
    expect(guests.length).toBeGreaterThan(0);
    for (const guest of guests) {
      expect(reachable.has(guest.id), `guest ${guest.id} requires crossing kitchen ${kitchen.id}`).toBe(true);
    }
  });
  it('keeps a usable main room and real entry across every building type', () => {
    const types: BuildingType[] = ['cottage', 'townhouse', 'tenement', 'farmstead', 'shop', 'smithy', 'workshop', 'inn', 'tavern', 'storehouse', 'manor', 'temple', 'keep', 'civic'];
    for (const type of types) {
      for (const seed of [1, 42, 792767481]) {
        const plan = generateBuilding({ buildingId: 1, type, seedPath: rootSeedPath(seed), storeys: 1, basement: false });
        const floor = plan.floors[0];
        expect(Math.max(...floor.rooms.map(room => room.cells.length)) * 25, `${type} ${seed}`).toBeGreaterThanOrEqual(150);
        expect(floor.doors.some(door => door.isEntry), `${type} ${seed}`).toBe(true);
      }
    }
  });
  it('gives domestic and hospitality main masses room for furniture and movement', () => {
    for (const seed of [1, 42, 792767481]) {
      const cottage = genFootprint(rootSeedPath(seed), 'cottage').masses[0];
      const tavern = genFootprint(rootSeedPath(seed), 'tavern').masses[0];
      const inn = genFootprint(rootSeedPath(seed), 'inn').masses[0];
      expect(cottage.w * 5).toBeGreaterThanOrEqual(30);
      expect(cottage.h * 5).toBeGreaterThanOrEqual(25);
      expect(tavern.w * 5).toBeGreaterThanOrEqual(50);
      expect(tavern.h * 5).toBeGreaterThanOrEqual(40);
      expect(inn.w * inn.h).toBeGreaterThan(tavern.w * tavern.h);
    }
  });

  it('keeps the reported tavern seed spacious without multiplying rooms', () => {
    const plan = generateBuilding({ buildingId: 1, type: 'tavern', seedPath: rootSeedPath(792767481), storeys: 1, basement: false });
    const rooms = plan.floors[0].rooms;
    expect(rooms.length).toBeLessThanOrEqual(7);
    const common = rooms.find(room => room.purpose === 'common-room');
    expect(common).toBeDefined();
    expect(common!.cells.length * 25).toBeGreaterThanOrEqual(600);
    // A 5ft cell is unchanged; extra floor area comes from the authored plan.
    expect(plan.widthFt % 5).toBe(0);
    expect(plan.depthFt % 5).toBe(0);
  });

  it('never grows a building beyond an explicitly negotiated town parcel', () => {
    const plan = generateBuilding({ buildingId: 1, type: 'tavern', seedPath: rootSeedPath(792767481), maxWidthFt: 40, maxDepthFt: 35, storeys: 1, basement: false });
    expect(plan.widthFt).toBeLessThanOrEqual(40);
    expect(plan.depthFt).toBeLessThanOrEqual(35);
  });
});
