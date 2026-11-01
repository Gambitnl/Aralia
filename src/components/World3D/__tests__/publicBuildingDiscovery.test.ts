import {describe, it, expect, vi} from 'vitest';
import {publicBuildingDiscovery} from '../publicBuildingDiscovery';
import type {GroundWorld} from '../../../systems/worldforge/bridge/groundChunkLoader';
import type {TownBuildingVisit} from '../../Worldforge/townBuildingVisit';
import type {GameState} from '../../../types/state';
import {BLUEPRINT_STOREY_FT} from '../../../systems/world3d/buildingModels';

vi.mock('../terrain/groundSurfaceYM', () => ({groundSurfaceYM: () => 10}));
const fixture = () => {
  const building = {id:'wf-plot-253-1',xM:20,zM:30,name:'Fallback Crown',
    cornersM:[{x:18,z:28},{x:22,z:28},{x:22,z:32},{x:18,z:32}],
    parts:[{x:0,z:0,w:4,d:4,h:.1,baseY:0,walkSurface:'floor'}]};
  const ground={buildings:[building]} as unknown as GroundWorld;
  const room={id:1,purpose:'common-room',isMain:true,cells:[{cx:2,cy:2}]};
  const visit={plot:{id:1},townName:'Putivl',isBusiness:true,plan:{type:'inn',widthFt:20,depthFt:20,floors:[{level:0,rooms:[room]}]}} as unknown as TownBuildingVisit;
  const state={worldSeed:77,playerCell:{cellId:1885},worldBusinesses:{saved:{id:'saved',burgId:253,plotId:1,name:'The Gilded Consortium'}},gameTime:new Date('0351-01-03T19:08:00Z'),townSim:{}} as unknown as GameState;
  const body={xM:20.1,zM:30.1,yM:10.1};
  return {ground,building,visit,room,state,body,read:vi.fn(()=>visit)};
};
describe('firsthand public building knowledge',()=>{
  it('uses the real room and saved source identity at the actual observation time without promising services',()=>{
    const f=fixture(),before=JSON.stringify(f);
    const entry=publicBuildingDiscovery(f.ground,f.body,f.state,f.read)!;
    expect(entry).toMatchObject({title:'Place Visited: The Gilded Consortium',gameTime:'0351-01-03T19:08:00.000Z',associatedLocationId:'cell_1885',source:{id:'world:77:cell:1885:building:wf-plot-253-1'}});
    expect(entry.content).toContain('public common room');
    expect(entry.content).toContain('No keeper is scheduled');
    expect(entry.content).not.toContain('..');
    expect(entry.flags).toContainEqual({key:'businessId',value:'saved'});
    expect(entry.content).not.toMatch(/map|booked|recovered|met /i);
    expect(JSON.stringify(f)).toBe(before);
  });
  for(const yM of [10,11,13.1,NaN])it(`refuses feet at ${yM} instead of the structural floor`,()=>{
    const f=fixture();expect(publicBuildingDiscovery(f.ground,{...f.body,yM},f.state,f.read)).toBeNull();expect(f.read).not.toHaveBeenCalled();
  });
  it('refuses an outside body even when the camera could see the room',()=>{
    const f=fixture();expect(publicBuildingDiscovery(f.ground,{...f.body,xM:24},f.state,f.read)).toBeNull();
  });
  it('does not turn private rooms or households into public visits',()=>{
    const f=fixture();f.visit.isBusiness=false;expect(publicBuildingDiscovery(f.ground,f.body,f.state,f.read)).toBeNull();
    f.visit.isBusiness=true;f.room.purpose='bedroom';expect(publicBuildingDiscovery(f.ground,f.body,f.state,f.read)).toBeNull();
    f.room.purpose='common-room';f.room.isMain=false;expect(publicBuildingDiscovery(f.ground,f.body,f.state,f.read)).toBeNull();
  });
  it('does not accept a furnishing or invisible tactical surface as a public floor',()=>{
    const f=fixture(),p=f.building.parts[0];Object.assign(p,{renderRole:'tactical-only'});
    expect(publicBuildingDiscovery(f.ground,f.body,f.state,f.read)).toBeNull();
    Object.assign(p,{renderRole:undefined,furnishing:{kind:'table'}});
    expect(publicBuildingDiscovery(f.ground,f.body,f.state,f.read)).toBeNull();
  });
  it('keeps worlds distinct and refuses ambiguous saved businesses',()=>{
    const f=fixture(),a=publicBuildingDiscovery(f.ground,f.body,f.state,f.read)!;
    f.state.worldSeed=78;expect(publicBuildingDiscovery(f.ground,f.body,f.state,f.read)!.source.id).not.toBe(a.source.id);
    f.state.worldBusinesses.other={...f.state.worldBusinesses.saved,id:'other'};
    expect(publicBuildingDiscovery(f.ground,f.body,f.state,f.read)).toBeNull();
  });
  for(const yaw of [0,.7,-2.2])for(const sign of [-1,1])it(`recognizes the rendered room at yaw ${yaw} and mirror ${sign}`,()=>{
    const f=fixture(),cos=Math.cos(yaw),sin=Math.sin(yaw);
    const world=(x:number,z:number)=>({x:20+x*cos+z*sin,z:30-x*sin+z*cos});
    f.building.cornersM=[[-2,-2],[2,-2],[2,2],[-2,2]].map(([x,z])=>world(x,z*-sign));
    const point=world(.1,.1*-sign);
    expect(publicBuildingDiscovery(f.ground,{xM:point.x,zM:point.z,yM:10.1},f.state,f.read)?.flags).toContainEqual({key:'roomId',value:'1'});
  });
  it('distinguishes an upper public floor from the room below',()=>{
    const f=fixture(),height=BLUEPRINT_STOREY_FT*.3048;
    f.building.parts[0].baseY=height;f.body.yM+=height;f.visit.plan.floors[0].level=1;
    expect(publicBuildingDiscovery(f.ground,f.body,f.state,f.read)?.flags).toContainEqual({key:'floorLevel',value:'1'});
    expect(publicBuildingDiscovery(f.ground,{...f.body,yM:10.1},f.state,f.read)).toBeNull();
  });
  it('does not break walking or invent knowledge when the canonical source is unavailable',()=>{
    const f=fixture();expect(publicBuildingDiscovery(f.ground,f.body,f.state,()=>{throw Error('Unavailable source')})).toBeNull();
  });
  it('names an unnamed civic destination once while retaining its source identity',()=>{
    const f=fixture();f.visit.isBusiness=false;f.visit.plan.type='temple';
    f.visit.plan.floors[0].rooms[0].purpose='nave';f.state.worldBusinesses={};
    f.building.name='temple in Putivl';
    const entry=publicBuildingDiscovery(f.ground,f.body,f.state,f.read)!;
    expect(entry.source.name).toBe('temple in Putivl');
    expect(entry.content).toBe('You entered temple in Putivl. Its public nave is on the ground floor.');
    expect(entry.source.id).toBe('world:77:cell:1885:building:wf-plot-253-1');
    f.building.name='';
    expect(publicBuildingDiscovery(f.ground,f.body,f.state,f.read)?.content).toBe(entry.content);
  });
});
