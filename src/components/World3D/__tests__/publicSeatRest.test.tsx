/** A public seat opens a review; private furniture, stale receipts and remote
 * feet must not become a route around the normal rest rules. */
import React from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {TownBuildingVisit} from '../../Worldforge/townBuildingVisit';
import type {FurnishingPick} from '../groundFurnishingInteraction';
import {isPublicRestSeat, publicSeatRestAccessError, PublicSeatRestAction} from '../publicSeatRest';

afterEach(cleanup);
function fixture() {
  const visit = {isBusiness:false, plan:{type:'temple',widthFt:30,depthFt:15,
    floors:[{level:0,rooms:[{id:0,isMain:true,purpose:'nave',cells:Array.from({length:9},(_,i)=>({cx:i%3,cy:Math.floor(i/3)}))}],
      furnishings:[{kind:'bench',roomId:0,x:12,y:7.5,rotation:0}]}]}} as unknown as TownBuildingVisit;
  const pick: FurnishingPick = {siteId:'wf-plot-675-168',part:{x:-.9144,z:0,w:1,d:.4,h:.5,colorHex:'#123456',
    furnishing:{level:0,roomId:0,index:0,kind:'bench'}},
    transform:{groupX:20,groupZ:30,surfaceY:4,rotationY:0,doorZSign:-1}};
  return {visit,pick,feet:{xM:18.17,zM:30,yM:4}};
}

describe('public bench short-rest review',()=>{
  it('admits an actually reached nave bench without granting recovery or changing its source',()=>{
    const f=fixture(), before=JSON.stringify(f);
    expect(publicSeatRestAccessError(f.visit,f.pick,f.feet)).toBeNull();
    expect(JSON.stringify(f)).toBe(before);
  });
  for(const purpose of ['bedroom','private-room','storage']) it(`refuses a bench in ${purpose}`,()=>{
    const f=fixture();f.visit.plan.floors[0].rooms[0].purpose=purpose as never;
    expect(isPublicRestSeat(f.visit,0,0)).toBe(false);
    expect(publicSeatRestAccessError(f.visit,f.pick,f.feet)).toContain('Private furniture');
  });
  it('refuses a household and a secondary room even when their labels resemble a public nave',()=>{
    const f=fixture();f.visit.plan.type='cottage';
    expect(isPublicRestSeat(f.visit,0,0)).toBe(false);
    f.visit.plan.type='temple';f.visit.plan.floors[0].rooms[0].isMain=false;
    expect(isPublicRestSeat(f.visit,0,0)).toBe(false);
  });
  it('does not turn an altar or bed into a rest seat',()=>{
    const f=fixture();f.visit.plan.floors[0].furnishings[0].kind='altar';
    expect(isPublicRestSeat(f.visit,0,0)).toBe(false);
    f.visit.plan.floors[0].furnishings[0].kind='bed';
    expect(isPublicRestSeat(f.visit,0,0)).toBe(false);
  });
  it('rejects absent feet, another room, another floor and a far-away body at action time',()=>{
    const f=fixture();
    expect(publicSeatRestAccessError(f.visit,f.pick,null)).toContain('arrives');
    expect(publicSeatRestAccessError(f.visit,f.pick,{...f.feet,xM:25})).toContain('Enter this room');
    expect(publicSeatRestAccessError(f.visit,f.pick,{...f.feet,yM:7})).toContain('same floor');
    expect(publicSeatRestAccessError(f.visit,f.pick,{...f.feet,xM:15.5,zM:27.9})).toContain('Move closer');
  });
  it('rejects a stale furnishing identity instead of using its old examination receipt',()=>{
    const f=fixture();f.pick.part.furnishing!.roomId=9;
    expect(publicSeatRestAccessError(f.visit,f.pick,f.feet)).toContain('no longer available');
    f.pick.part.furnishing!.roomId=0;f.pick.part.x+=1;
    expect(publicSeatRestAccessError(f.visit,f.pick,f.feet)).toContain('changed');
  });
  it('opens only the review callback and leaves private seats without an action',()=>{
    const f=fixture(), review=vi.fn();
    const {rerender}=render(<PublicSeatRestAction visit={f.visit} level={0} index={0} onReview={review}/>);
    fireEvent.click(screen.getByRole('button',{name:'Review short rest'}));
    expect(review).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button',{name:'Begin Rest'})).toBeNull();
    f.visit.plan.type='cottage';
    rerender(<PublicSeatRestAction visit={f.visit} level={0} index={0} onReview={review}/>);
    expect(screen.queryByRole('button',{name:'Review short rest'})).toBeNull();
  });
});
