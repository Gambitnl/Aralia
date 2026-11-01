/** The real Film partition must retain a partly wet cell and conserve shared
 * transfers before the new edge can receive waterfall impact supply. These
 * tests do not qualify source coupling, inclined terrain or live rendering. */
import {describe,expect,it} from 'vitest';
import {WaterfallContactFilm} from '../waterfallContactFilm';
import {getWaterfallContactSurfaces,type ContactSurface,type ContactVec3} from '../waterfallContactFlow';

function fixture(angle=0,bed=20) {
  const c=Math.cos(angle),s=Math.sin(angle);
  const point=(x:number,z:number):ContactVec3=>[30+x*c-z*s,bed,40+x*s+z*c];
  const surface:ContactSurface={id:'straight-front-grid',vertices:[point(0,0),point(24,0),point(24,16),point(0,16)],normal:[0,1,0]};
  const film=new WaterfallContactFilm(surface);
  return {film,point,front:film.createStraightFront({origin:8.3,bornAt:2,depth:1,velocity:0})};
}
const keys=['volume','momentum','energy'] as const;

describe('straight moving edge on Film geometry',()=>{
  it('uses all 12 by 16 actual cells with a partly wet initial column',()=>{
    const {film,front}=fixture(),s=front.snapshot();
    expect(film.nx).toBe(12);expect(film.nz).toBe(16);expect(s.cells).toHaveLength(192);
    expect(s.inventory.volume).toBeCloseTo(8.3*16,11);
    expect(s.inventory.energy).toBeCloseTo((.5*1000*9.81+1000*9.81*20)*8.3*16,6);
    expect(s.cells[4].wetArea).toBeCloseTo(.3,12);
    expect(s.cells[4].pieces[0].depth).toEqual([1,1,1]);
    expect(s.cells[5].pieces).toEqual([]);
    expect(s.cells[5].inventory.volume).toBe(0);
    expect(film.volume).toBe(0); // independent initialization, not snapshot migration
  });
  it.each([0,Math.PI/6])('advances exact support and shared pressure-bearing transfers on a rotated grid (%s)',angle=>{
    const {front,point}=fixture(angle),old=front.snapshot();
    const next=front.advanceTo(3),x=8.3+2*Math.sqrt(9.81);
    next.front[0].forEach((v,k)=>expect(v).toBeCloseTo(point(x,0)[k],11));
    next.front[1].forEach((v,k)=>expect(v).toBeCloseTo(point(x,16)[k],11));
    expect(next.transfers).toHaveLength(13*16);
    expect(next.inventory.volume).toBeCloseTo(old.inventory.volume,10);
    // The upstream reservoir has zero advection but exerts pressure. Omitting
    // this impulse would preserve mass while corrupting momentum immediately.
    expect(next.inventory.momentum-old.inventory.momentum).toBeCloseTo(.5*1000*9.81*16,7);
    expect(next.inventory.energy).toBeCloseTo(old.inventory.energy,7);
    for (let j=0;j<16;j++) for (let i=0;i<12;i++) {
      const cell=next.cells[j*12+i],l=next.transfers[j*13+i],r=next.transfers[j*13+i+1];
      for (const key of keys) expect(cell.inventory[key]-old.cells[cell.id].inventory[key]).toBeCloseTo(l[key]-r[key],7);
      if (i*2>=x) {
        expect(cell.inventory).toEqual({volume:0,momentum:0,energy:0});
        expect(cell.pieces).toEqual([]);
        expect(l.volume).toBe(0);expect(r.volume).toBe(0);
      }
    }
    expect(next.cells[7].wetArea).toBeCloseTo(x-14,11);
    const tip=next.cells[7].pieces.at(-1)!;
    expect(tip.depth[2]).toBe(0);
    // Simpson is exact for quadratic depth: geometry independently owns the
    // declared partial-cell volume rather than being a coverage-only mask.
    const length=Math.hypot(...tip.corners[1].map((v,k)=>v-tip.corners[0][k]));
    expect(length*(tip.depth[0]+4*tip.depth[1]+tip.depth[2])/6).toBeCloseTo(tip.inventory.volume,12);
  });
  it('retains event age over 120 updates rather than kicking the front every tick',()=>{
    const a=fixture().front,b=fixture().front;
    const once=a.advanceTo(3);
    for(let step=1;step<=120;step++)b.advanceTo(2+step/120);
    const split=b.snapshot();
    expect(split.cells).toEqual(once.cells);expect(split.front).toEqual(once.front);
    expect(split.inventory).toEqual(once.inventory);
    expect(Math.max(...Object.values(split.maximumBalanceResidual))).toBeLessThan(1e-7);
  });
  it('retreats without deleting remaining water or leaving full-cell tails',()=>{
    const {film}=fixture(),front=film.createStraightFront({origin:16,bornAt:0,depth:.25,velocity:-5});
    const before=front.snapshot(),after=front.advanceTo(1);
    expect(after.inventory.volume).toBeLessThan(before.inventory.volume);
    expect(after.inventory.volume).toBeCloseTo(before.inventory.volume-5*.25*16,11);
    const boundary=16-5+2*Math.sqrt(9.81*.25);
    for(let i=0;i<12;i++)if(i*2>=boundary)expect(after.cells[i].pieces).toEqual([]);
    expect(after.transfers[0].volume).toBeCloseTo(-1.25,12);
  });
  it('rejects unsupported boundary interaction atomically and protects returned records',()=>{
    const {front}=fixture(),before=front.snapshot();
    expect(()=>front.advanceTo(20)).toThrow('boundary-interaction');
    expect(front.snapshot()).toEqual(before);
    expect(()=>front.advanceTo(1)).toThrow('invalid-time');
    before.cells[0].pieces[0].corners[0][0]=NaN;
    before.inventory.volume=0;
    expect(front.snapshot().inventory.volume).toBeGreaterThan(0);
    expect(front.snapshot().cells[0].pieces[0].corners[0][0]).toBe(30);
  });
  it('refuses old full-cell water and inclined terrain rather than claiming they are coupled',()=>{
    const {film,point}=fixture();
    film.capture(point(2,2),1,[0,0,0]);
    expect(()=>film.createStraightFront({origin:8,bornAt:0,depth:1,velocity:0})).toThrow('fresh-grid');
    const slope=new WaterfallContactFilm(getWaterfallContactSurfaces()[0]);
    expect(()=>slope.createStraightFront({origin:8,bornAt:0,depth:1,velocity:0})).toThrow('horizontal-plane');
  });
  it('carries the same volume transfer into world-datum energy at both elevations',()=>{
    const low=fixture(0,0).front.advanceTo(3),high=fixture(0,20).front.advanceTo(3);
    high.transfers.forEach((row,i)=>{
      expect(row.volume).toBe(low.transfers[i].volume);
      expect(row.momentum).toBe(low.transfers[i].momentum);
      expect(row.energy-low.transfers[i].energy).toBeCloseTo(1000*9.81*20*row.volume,8);
    });
    high.cells.forEach((cell,i)=>expect(cell.inventory.energy-low.cells[i].inventory.energy).toBeCloseTo(1000*9.81*20*cell.inventory.volume,8));
  });
});
