import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {TownBuildingVisit} from '../../Worldforge/townBuildingVisit';
import type {FurnishingPick} from '../groundFurnishingInteraction';
import {isPublicTempleAltar,templeDedicationAccessError,TempleDedicationAction} from '../templeDedication';
afterEach(cleanup);
function fixture(){
  const visit={plot:{role:'temple'},isBusiness:false,plan:{type:'temple',widthFt:30,depthFt:15,floors:[{level:0,
    rooms:[{id:0,isMain:true,purpose:'nave',cells:Array.from({length:9},(_,i)=>({cx:i%3,cy:Math.floor(i/3)}))}],
    furnishings:[{kind:'altar',roomId:0,x:12,y:7.5,rotation:0}]}]}} as unknown as TownBuildingVisit;
  const pick:FurnishingPick={siteId:'wf-plot-675-168',part:{x:-.9144,z:0,w:1,d:.8,h:1.1,colorHex:'#aaaaaa',furnishing:{level:0,roomId:0,index:0,kind:'altar'}},
    transform:{groupX:20,groupZ:30,surfaceY:4,rotationY:0,doorZSign:-1}};
  return {visit,pick,feet:{xM:18.17,zM:30,yM:4}};
}
describe('physical temple dedication',()=>{
  it('admits a nearby public altar, not an absent body, another floor or a remote reader',()=>{
    const f=fixture();expect(templeDedicationAccessError(f.visit,f.pick,f.feet)).toBeNull();
    expect(templeDedicationAccessError(f.visit,f.pick,null)).toContain('arrives');
    expect(templeDedicationAccessError(f.visit,f.pick,{...f.feet,yM:8})).toContain('same floor');
    expect(templeDedicationAccessError(f.visit,f.pick,{...f.feet,xM:15.5,zM:27.9})).toContain('Move closer');
  });
  it('keeps private altars, benches and unrelated buildings outside the action',()=>{
    const f=fixture();f.visit.plan.floors[0].rooms[0].isMain=false;expect(isPublicTempleAltar(f.visit,0,0)).toBe(false);
    f.visit.plan.floors[0].rooms[0].isMain=true;f.visit.plan.type='cottage';expect(isPublicTempleAltar(f.visit,0,0)).toBe(false);
    f.visit.plan.type='temple';f.visit.plan.floors[0].furnishings[0].kind='bench';expect(isPublicTempleAltar(f.visit,0,0)).toBe(false);
  });
  it('does not reveal faith or clergy before the player reads, and blocks repeat input while pending',()=>{
    const f=fixture(),read=vi.fn();const {rerender}=render(<TempleDedicationAction visit={f.visit} level={0} index={0} pending={false} onRead={read}/>);
    expect(screen.queryByText(/Pantheon/)).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Read dedication'}));expect(read).toHaveBeenCalledOnce();
    rerender(<TempleDedicationAction visit={f.visit} level={0} index={0} pending onRead={read}/>);
    expect(screen.getByRole('button',{name:'Read dedication'})).toBeDisabled();
  });
});
