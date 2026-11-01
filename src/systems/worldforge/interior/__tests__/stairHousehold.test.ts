import { describe, expect, it } from 'vitest';
import { townBuildingVisit } from '../../../../components/Worldforge/townBuildingVisit';
import type {BlueprintFloor} from '../blueprintTypes';
import {RURAL_FAMILY_FURNISHING} from '../ruralFamilyLayout';
import { cellKey } from '../blueprintTypes';
import { furnishingFootprint } from '../householdFurnish';
import { planHouseholdReturnStair } from '../stairHousehold';

// Played Sypege households belong to town-layout 1. Default layout 2 has
// different buildings at these plot indices; it cannot stand in for this save.
describe('joint stair and household admission', () => {
  for (const [plot, residents, shared] of [[1, 5, true], [5, 4, false]] as const) {
    it(`fits every resident and independent bed access in Sypege home ${plot}`, () => {
      const { plan } = townBuildingVisit(1793146029630, 10, plot, undefined, undefined, 1);
      const before = JSON.stringify(plan);
      const result = { layout: plan.stairs[0].layout, floors: plan.floors };
      expect(result.layout).toBeDefined();
      if (shared) {
        const upper = plan.floors.find(f => f.level === 1)!;
        expect(upper.rooms.some(r => r.forSlot?.split(',').filter(t => t.startsWith('child:')).length === 4)).toBe(true);
        expect(upper.rooms.some(r => r.forSlot === 'head')).toBe(true);
      }
      expect(JSON.stringify(plan)).toBe(before);
      const tags = result.floors.flatMap(f => f.rooms.flatMap(r => r.forSlot?.split(',').filter(Boolean) ?? []));
      expect(tags).toHaveLength(residents);
      expect(new Set(tags).size).toBe(residents);
      for (const floor of result.floors) for (const room of floor.rooms) {
        const items = floor.furnishings.filter(item => item.roomId === room.id);
        const beds = items.filter(item => item.kind === 'bed');
        expect(beds.length).toBeGreaterThanOrEqual(room.forSlot?.split(',').filter(Boolean).length ?? 0);
        if (!items.length) continue;
        const cells = new Set(room.cells.map(c => cellKey(c.cx, c.cy)));
        const obstacles = items.map(furnishingFootprint);
        for (const [index, box] of obstacles.entries()) {
          // Independent subcell sampling catches walls in concave rooms.
          for (let x = box.left; x < box.right; x += 0.25) for (let y = box.top; y < box.bottom; y += 0.25) {
            expect(cells.has(cellKey(Math.floor(x / 5), Math.floor(y / 5)))).toBe(true);
          }
          for (const other of obstacles.slice(index + 1)) {
            expect(box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top).toBe(false);
          }
        }
        const targets = floor.doors.filter(d => d.a === room.id || d.b === room.id).flatMap(d => room.cells
          .filter(c => Math.abs(c.cx * 5 + 2.5 - d.x) + Math.abs(c.cy * 5 + 2.5 - d.y) < 2.51)
          .map(c => ({ x: d.x + Math.sign(c.cx * 5 + 2.5 - d.x) * 1.5,
            y: d.y + Math.sign(c.cy * 5 + 2.5 - d.y) * 1.5 })));
        expect(targets.length).toBeGreaterThan(0);
        const free = new Set<string>();
        const half = 0.4 / 0.3048;
        for (let x = room.bbox.x + 0.5; x < room.bbox.x + room.bbox.w; x += 0.5) {
          for (let y = room.bbox.y + 0.5; y < room.bbox.y + room.bbox.d; y += 0.5) {
            const left = x - half, right = x + half, top = y - half, bottom = y + half;
            if (![left, x, right].every(px => [top, y, bottom].every(py => cells.has(cellKey(Math.floor(px / 5), Math.floor(py / 5)))))) continue;
            if (!obstacles.some(o => left < o.right && right > o.left && top < o.bottom && bottom > o.top)) free.add(`${x},${y}`);
          }
        }
        const queue = [targets[0]], seen = new Set([`${targets[0].x},${targets[0].y}`]);
        expect(free.has([...seen][0])).toBe(true);
        for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
          const next = { x: queue[i].x + dx, y: queue[i].y + dy }, key = `${next.x},${next.y}`;
          if (free.has(key) && !seen.has(key)) { seen.add(key); queue.push(next); }
        }
        for (const point of targets) expect(seen.has(`${point.x},${point.y}`)).toBe(true);
        for (const bed of beds.map(furnishingFootprint)) expect(queue.some(p =>
          Math.hypot(Math.max(bed.left - p.x, 0, p.x - bed.right), Math.max(bed.top - p.y, 0, p.y - bed.bottom)) <= 0.6 / 0.3048)).toBe(true);
      }
    });
  }

  it('rejects the unresolved Blackford layout without losing or moving a resident in the source', () => {
    const { plan } = townBuildingVisit(1793146029630, 10, 2, undefined, undefined, 1);
    const before = JSON.stringify(plan);
    expect(planHouseholdReturnStair(plan.footprintCells, plan.floors, 0)).toBeUndefined();
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('keeps real provisions in Hartdown hall when the stair occupies part of its former kitchen', () => {
    const { plan, manifests } = townBuildingVisit(1793146029630, 10, 1, undefined, undefined, 1);
    const ground = plan.floors.find(f => f.level === 0)!;
    const hall = ground.rooms.find(r => r.purpose === 'hall')!;
    const index = ground.furnishings.findIndex(f => f.roomId === hall.id && f.kind === 'barrel');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(ground.furnishings.some(f => f.roomId === hall.id && f.kind === 'hearth')).toBe(true);
    expect(ground.furnishings.some(f => f.roomId === hall.id && f.kind === 'table')).toBe(true);
    expect(manifests.some(m => m.level === 0 && m.furnishingIndex === index)).toBe(true);
  });

  it('also rejects missing servant beds when the room has no family slot tags', () => {
    const { plan } = townBuildingVisit(1793146029630, 10, 2, undefined, undefined, 1);
    const floors = plan.floors.map(f => ({ ...f, rooms: f.rooms.map(r => ({ ...r, forSlot: undefined })) }));
    floors.find(f => f.level === 1)!.rooms[2].purpose = 'servant-room';
    expect(planHouseholdReturnStair(plan.footprintCells, floors, 99, { candidates: 1, merges: 1 })).toBeUndefined();
  });
});


it('sizes newly reserved stair doors before strict furnishing and preserves the source',()=>{
 const cells=Array.from({length:36},(_,i)=>({cx:i%6,cy:Math.floor(i/6)}));
 const floors:BlueprintFloor[]=[0,1].map(level=>({level,rooms:[{id:0,purpose:'hall',cells:structuredClone(cells),area:36,anchor:{cx:2,cy:2},bbox:{x:0,y:0,w:30,d:30},isMain:true,isCorridor:false,}],
  doors:level===0?[{a:-1,b:0,x:17.5,y:0,axis:'x',isEntry:true,openDir:{nx:0,ny:1},swingInto:0}]:[],furnishings:[],windows:[],walls:[],wallRuns:[]}));
 const before=JSON.stringify(floors),planned=planHouseholdReturnStair(cells,floors,0,{candidates:1,merges:0,furnishing:{...RURAL_FAMILY_FURNISHING,walkingWidthM:.8},minimumDoorWidthFt:4});
 expect(planned).toBeDefined();expect(JSON.stringify(floors)).toBe(before);
 const wide=planHouseholdReturnStair(cells,floors,0,{furnishing:RURAL_FAMILY_FURNISHING,minimumDoorWidthFt:4});
 expect(wide).toBeDefined();expect(wide!.layout.shaftCells).toHaveLength(6);
 expect(wide!.layout.flightWidthFt*.3048).toBeGreaterThanOrEqual(1.2);
 expect(wide!.layout.landingDepthFt*.3048).toBeGreaterThanOrEqual(1.2);
 expect(JSON.stringify(floors)).toBe(before);
 expect(planned!.floors.flatMap(f=>f.doors).every(d=>(d.clearWidthFt??3)>=4)).toBe(true);
 const blocked=new Set(planned!.layout.shaftCells.map(c=>cellKey(c.cx,c.cy)));
 for(const floor of planned!.floors)for(const piece of floor.furnishings){const box=furnishingFootprint(piece);
  for(const key of blocked){const [x,y]=key.split(',').map(Number);expect(box.left<x*5+5&&box.right>x*5&&box.top<y*5+5&&box.bottom>y*5).toBe(false);}
 }
});
