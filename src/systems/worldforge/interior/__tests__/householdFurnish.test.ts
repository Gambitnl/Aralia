/** Real saved-town homes must house their assigned family without furniture
 * crossing walls, overlapping, or consuming the stair shaft. */
import { describe, expect, it } from 'vitest';
import { townBuildingVisit } from '../../../../components/Worldforge/townBuildingVisit';
import { furnishingFootprint, furnishHouseholdBuilding, furnishHouseholdSeating } from '../householdFurnish';
import {roomFurnishingsReachable} from '../buildingLayoutRepair';
import type {BlueprintFloor} from '../blueprintTypes';
import { cellKey } from '../blueprintTypes';
import { stairAscentDir } from '../../../world3d/buildingModels';

describe('canonical household furnishing', () => {
  for (const [plot, members, expectedBeds] of [[1, 5, 5], [2, 7, 7], [5, 4, 8]]) {
    it(`fits actual furniture inside Sypege home ${plot}`, () => {
      // These played households belong to layout 1. Layout 2 has different
      // buildings at these indices; their current default is a different case.
      const { plan, household, occupancy } = townBuildingVisit(1793146029630, 10, plot, undefined, undefined, 1);
      expect(household?.members).toHaveLength(members);
      let beds = 0;
      for (const floor of plan.floors) {
        // Independently search at half-foot resolution with a real 0.8 m
        // walking footprint; room-center routes are no longer required.
        for (const room of floor.rooms) {
          // A return shaft has real height changes; its room is tested by the
          // stair geometry suite, never as a flat furniture-navigation route.
          if (plan.stairs.some(s => s.layout && room.cells.every(c => s.layout!.shaftCells.some(sc => sc.cx === c.cx && sc.cy === c.cy)))) continue;
          const obstacles = floor.furnishings.filter(f => f.roomId === room.id).map(furnishingFootprint);
          if (floor.level === 0) for (const stair of plan.stairs.filter(s => s.fromLevel === 0)) {
            obstacles.push({ left: stair.x - 2.5, right: stair.x + 2.5, top: stair.y - 2.5, bottom: stair.y + 2.5 });
          }
          const cells = new Set(room.cells.map(c => cellKey(c.cx, c.cy)));
          const targets = floor.doors.filter(d => d.a === room.id || d.b === room.id).flatMap(d =>
            room.cells.filter(c => Math.abs(c.cx * 5 + 2.5 - d.x) + Math.abs(c.cy * 5 + 2.5 - d.y) < 2.51));
          targets.push(...room.cells.filter(c => plan.stairs.some(s => s.x === c.cx * 5 + 2.5 && s.y === c.cy * 5 + 2.5)));
          const points = floor.doors.filter(d => d.a === room.id || d.b === room.id).flatMap(d =>
            room.cells.filter(c => Math.abs(c.cx * 5 + 2.5 - d.x) + Math.abs(c.cy * 5 + 2.5 - d.y) < 2.51)
              .map(c => ({ x: d.x + Math.sign(c.cx * 5 + 2.5 - d.x) * 1.5, y: d.y + Math.sign(c.cy * 5 + 2.5 - d.y) * 1.5 })));
          points.push(...targets.filter(c => plan.stairs.some(s => s.x === c.cx * 5 + 2.5 && s.y === c.cy * 5 + 2.5))
            .map(c => {
              const dir = floor.level === 0 ? stairAscentDir(floor, c.cx, c.cy) : { dx: 0, dy: 0 };
              return { x: c.cx * 5 + 2.5 - dir.dx * 4, y: c.cy * 5 + 2.5 - dir.dy * 4 };
            }));
          if (!points.length) continue;
          const free = new Set<string>();
          const half = 0.4 / 0.3048;
          for (let x = Math.min(...room.cells.map(c => c.cx * 5)) + 0.5; x < Math.max(...room.cells.map(c => (c.cx + 1) * 5)); x += 0.5) {
            for (let y = Math.min(...room.cells.map(c => c.cy * 5)) + 0.5; y < Math.max(...room.cells.map(c => (c.cy + 1) * 5)); y += 0.5) {
              const box = { left: x - half, right: x + half, top: y - half, bottom: y + half };
              const inside = [box.left, x, box.right].every(px => [box.top, y, box.bottom].every(py => cells.has(cellKey(Math.floor(px / 5), Math.floor(py / 5)))));
              if (inside && !obstacles.some(o => box.left < o.right && box.right > o.left && box.top < o.bottom && box.bottom > o.top)) free.add(`${x},${y}`);
            }
          }
          for (const point of points) expect(free.has(`${point.x},${point.y}`)).toBe(true);
          const queue = [points[0]], visited = new Set([`${points[0].x},${points[0].y}`]);
          for (let i = 0; i < queue.length; i++) {
            const a = queue[i];
            for (const [dx, dy] of [[0.5, 0], [0, 0.5], [-0.5, 0], [0, -0.5]]) {
              const point = { x: a.x + dx, y: a.y + dy }, key = `${point.x},${point.y}`;
              if (free.has(key) && !visited.has(key)) { visited.add(key); queue.push(point); }
            }
          }
          for (const point of points) expect(visited.has(`${point.x},${point.y}`)).toBe(true);
          for (const bed of floor.furnishings.filter(f => f.roomId === room.id && f.kind === 'bed')) {
            const box = furnishingFootprint(bed);
            expect([...visited].some(key => {
              const [x, y] = key.split(',').map(Number);
              return Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom)) < 2;
            })).toBe(true);
          }
          const demand = room.forSlot?.split(',').filter(Boolean).length ?? 0;
          expect(floor.furnishings.filter(f => f.roomId === room.id && f.kind === 'bed').length).toBeGreaterThanOrEqual(demand);
        }
        for (const item of floor.furnishings) {
          const box = furnishingFootprint(item);
          const room = floor.rooms.find(r => r.id === item.roomId)!;
          const cells = new Set(room.cells.map(c => cellKey(c.cx, c.cy)));
          for (let y = box.top; y < box.bottom; y += 0.25) for (let x = box.left; x < box.right; x += 0.25) {
            expect(cells.has(cellKey(Math.floor(x / 5), Math.floor(y / 5)))).toBe(true);
          }
          for (const other of floor.furnishings.filter(f => f !== item)) {
            const b = furnishingFootprint(other);
            expect(box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top).toBe(false);
          }
          for (const cell of plan.stairs.flatMap(s => s.layout?.shaftCells ?? [{ cx: Math.floor(s.x / 5), cy: Math.floor(s.y / 5) }])) {
            const b = { left: cell.cx * 5, right: (cell.cx + 1) * 5, top: cell.cy * 5, bottom: (cell.cy + 1) * 5 };
            expect(box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top).toBe(false);
          }
          if (item.kind === 'bed') beds++;
        }
      }
      const assignedTags = plan.floors.flatMap(f => f.rooms.flatMap(r => r.forSlot?.split(',').filter(Boolean) ?? []));
      expect(assignedTags.sort()).toEqual(plan.household!.slots.filter(s => s.role !== 'servant').map(s => s.tag).sort());
      const sleeping = occupancy!.stationsByHour[2];
      const stations = sleeping.map(station => {
        expect(station.activity).toBe('sleeping');
        const furniture = plan.floors.find(f => f.level === station.level)!.furnishings[station.furnishingIndex!];
        expect(furniture?.kind).toBe('bed');
        expect(furniture.roomId).toBe(station.roomId);
        return `${station.level}:${station.furnishingIndex}`;
      });
      expect(new Set(stations).size).toBe(members);
      console.info('Saved Sypege home furnishing', { plot, members, beds,
        pieces: plan.floors.map(f => [f.level, f.furnishings.length]) });
      expect(beds).toBe(expectedBeds);
    }, 60000);
  }
});

describe('public common room seating', () => {
  it('adds a reachable seat without rebinding existing inn furnishing indices', () => {
    // Preserve the played revision-1 inn and its seven original furnishings.
    const {plan}=townBuildingVisit(1793146029630,675,35,undefined,undefined,1);
    const floor=plan.floors.find(f=>f.level===0)!;
    // These seven pieces were played before adding seating. Containers and
    // manifests refer to their indices, so new seats must append after them.
    const existing=[{"kind":"crate","roomId":0,"x":1.6123359580052494,"y":1.6123359580052494,"rotation":0},{"kind":"barrel","roomId":0,"x":1.448293963254593,"y":6.448293963254593,"rotation":0},{"kind":"crate","roomId":0,"x":6.612335958005249,"y":1.6123359580052494,"rotation":0},{"kind":"hearth","roomId":1,"x":27.403412073490813,"y":1.448293963254593,"rotation":0},{"kind":"hearth","roomId":2,"x":1.448293963254593,"y":12.596587926509187,"rotation":90},{"kind":"table","roomId":2,"x":1.7763779527559054,"y":17.9246719160105,"rotation":90},{"kind":"barrel","roomId":2,"x":1.448293963254593,"y":23.551706036745408,"rotation":0}];
    expect(floor.furnishings.slice(0,existing.length)).toEqual(existing);
    const common=floor.rooms.find(r=>r.purpose==='common-room'&&r.isMain)!;
    const bench=floor.furnishings.find(f=>f.roomId===common.id&&f.kind==='bench');
    expect(bench).toBeDefined();
    const box=furnishingFootprint(bench!);
    const cells=new Set(common.cells.map(c=>cellKey(c.cx,c.cy)));
    for(let x=box.left;x<box.right;x+=.25)for(let y=box.top;y<box.bottom;y+=.25)
      expect(cells.has(cellKey(Math.floor(x/5),Math.floor(y/5)))).toBe(true);
    for(const piece of floor.furnishings.filter(p=>p!==bench)){
      const b=furnishingFootprint(piece);
      expect(box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top).toBe(false);
    }
    // Independently walk the room with an 0.8 m square. Its entry and both
    // stair doors must stay connected, and the seat must be approachable.
    const half=.4/.3048,free=new Set<string>();
    for(let x=15.5;x<30;x+=.5)for(let y=.5;y<15;y+=.5){
      const b={left:x-half,right:x+half,top:y-half,bottom:y+half};
      if(![b.left,x,b.right].every(px=>[b.top,y,b.bottom].every(py=>cells.has(cellKey(Math.floor(px/5),Math.floor(py/5))))))continue;
      if(floor.furnishings.filter(p=>p.roomId===common.id).some(p=>{const a=furnishingFootprint(p);return b.left<a.right&&b.right>a.left&&b.top<a.bottom&&b.bottom>a.top;}))continue;
      free.add(x+','+y);
    }
    const queue=[{x:22.5,y:1.5}],seen=new Set(['22.5,1.5']);
    expect(free.has('22.5,1.5')).toBe(true);
    for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){
      const p={x:queue[i].x+dx,y:queue[i].y+dy},key=p.x+','+p.y;
      if(free.has(key)&&!seen.has(key)){seen.add(key);queue.push(p);}
    }
    for(const key of ['16.5,2.5','18.5,7.5','18.5,12.5'])expect(seen.has(key)).toBe(true);
    expect(queue.some(p=>Math.hypot(Math.max(box.left-p.x,0,p.x-box.right),Math.max(box.top-p.y,0,p.y-box.bottom))<=2)).toBe(true);
  },60000);
});


describe('explicit household body-clearance profile',()=>{
  const floorFor=(purpose:'bedroom'|'hall'):BlueprintFloor=>({level:0,
    rooms:[{id:0,purpose,cells:Array.from({length:12},(_,i)=>({cx:i%3,cy:Math.floor(i/3)})),area:12,anchor:{cx:1,cy:1},bbox:{x:0,y:0,w:15,d:20},isMain:true,isCorridor:false,...(purpose==='bedroom'?{forSlot:'head,spouse'}:{})}],
    doors:[{a:-1,b:0,x:7.5,y:0,axis:'x',isEntry:true,clearWidthFt:4,swingInto:0,openDir:{nx:0,ny:1}}],windows:[],furnishings:[],walls:[],wallRuns:[]});
  const profile={walkingWidthM:1.2,reserveDoorSweeps:true,reachAllFurniture:true,compactBeds:true};
  it('fits full-size beds beyond a four-foot doorway with a wider visitor',()=>{
    const floor=floorFor('bedroom');furnishHouseholdBuilding([floor],new Set(),0,profile);
    expect(floor.furnishings.filter(p=>p.kind==='bed')).toHaveLength(2);
    // Independent quarter-foot audit also checks the chests, not only beds.
    expect(roomFurnishingsReachable(floor,0,.25,1.2)).toBe(true);
    for(const piece of floor.furnishings){const b=furnishingFootprint(piece);
      expect(b.left<9.5&&b.right>5.5&&b.top<4&&b.bottom>0).toBe(false);}
  });
  it('measures bed reach from the explicit body edge independently of all-object admission',()=>{
    const floor=floorFor('bedroom');
    furnishHouseholdBuilding([floor],new Set(),0,{walkingWidthM:1.2,compactBeds:true});
    expect(floor.furnishings.filter(p=>p.kind==='bed')).toHaveLength(2);
    expect(roomFurnishingsReachable(floor,0,.25,1.2)).toBe(true);
  });
  it('retains the wider profile when adding household seats',()=>{
    const floor=floorFor('hall');furnishHouseholdBuilding([floor],new Set(),0,profile);
    const established=structuredClone(floor.furnishings);
    furnishHouseholdSeating([floor],new Set(),0,4,{...profile,seatingTrials:4});
    expect(floor.furnishings.slice(0,established.length)).toEqual(established);
    expect(floor.furnishings.reduce((n,p)=>n+(p.kind==='bench'?2:p.kind==='chair'?1:0),0)).toBeGreaterThanOrEqual(4);
    expect(roomFurnishingsReachable(floor,0,.25,1.2)).toBe(true);
  });
  it('keeps default packing when optional clearance changes are disabled',()=>{
    const ordinary=floorFor('bedroom'),explicit=structuredClone(ordinary);
    furnishHouseholdBuilding([ordinary],new Set(),0);
    furnishHouseholdBuilding([explicit],new Set(),0,{walkingWidthM:.8,reserveDoorSweeps:false,reachAllFurniture:false});
    expect(explicit).toEqual(ordinary);
  });
  it('refuses invalid explicit body widths and walking grids',()=>{
    for(const walkingWidthM of [0,-1,NaN,Infinity])expect(()=>furnishHouseholdBuilding([floorFor('bedroom')],new Set(),0,{walkingWidthM})).toThrow(RangeError);
    for(const step of [0,.1,Infinity])expect(()=>furnishHouseholdBuilding([floorFor('bedroom')],new Set(),0,{walkingGridStepFt:step as 1})).toThrow(RangeError);
  });
});


it('finds full-size beds in a modest room when the coarse lattice misses their aisle',()=>{
 const cells=Array.from({length:6},(_,i)=>({cx:i%2,cy:Math.floor(i/2)}));
 const floor:BlueprintFloor={level:0,rooms:[{id:0,purpose:'bedroom',cells,area:6,anchor:{cx:0,cy:1},bbox:{x:0,y:0,w:10,d:15},isMain:false,isCorridor:false,forSlot:'child:0,child:1'}],doors:[{a:-1,b:0,x:10,y:7.5,axis:'y',isEntry:true,clearWidthFt:4,swingInto:0,openDir:{nx:-1,ny:0}}],furnishings:[],windows:[],walls:[],wallRuns:[]};
 const coarse=structuredClone(floor),profile={walkingWidthM:1.2,reserveDoorSweeps:true,reachAllFurniture:true,compactBeds:false};
 furnishHouseholdBuilding([coarse],new Set(),0,profile);
 furnishHouseholdBuilding([floor],new Set(),0,{...profile,walkingGridStepFt:.5});
 expect(floor.furnishings.filter(p=>p.kind==='bed')).toHaveLength(2);
 expect(floor.furnishings.filter(p=>p.kind==='bed').length).toBeGreaterThan(coarse.furnishings.filter(p=>p.kind==='bed').length);
 expect(roomFurnishingsReachable(floor,0,.25,1.2)).toBe(true);
});


it('uses one explicit shared kitchen table while keeping both rooms approachable',()=>{
 const rooms=[0,1].map(id=>({id,purpose:id===0?'hall' as const:'kitchen' as const,cells:Array.from({length:12},(_,i)=>({cx:id*3+i%3,cy:Math.floor(i/3)})),area:12,anchor:{cx:id*3+1,cy:1},bbox:{x:id*15,y:0,w:15,d:20},isMain:id===0,isCorridor:false}));
 const floor:BlueprintFloor={level:0,rooms,doors:[{a:-1,b:0,x:7.5,y:0,axis:'x',isEntry:true,clearWidthFt:4,swingInto:0,openDir:{nx:0,ny:1}},{a:0,b:1,x:15,y:7.5,axis:'y',isEntry:false,clearWidthFt:4,swingInto:1,openDir:{nx:1,ny:0}}],furnishings:[],windows:[],walls:[],wallRuns:[]};
 furnishHouseholdBuilding([floor],new Set(),0,{walkingWidthM:1.2,walkingGridStepFt:.5,reserveDoorSweeps:true,reachAllFurniture:true,sharedTableRoom:'kitchen'});
 expect(floor.furnishings.filter(p=>p.kind==='table').map(p=>p.roomId)).toEqual([1]);
 expect(floor.furnishings.some(p=>p.kind==='barrel')).toBe(true);
 for(const room of rooms)expect(roomFurnishingsReachable(floor,room.id,.25,1.2)).toBe(true);
});
