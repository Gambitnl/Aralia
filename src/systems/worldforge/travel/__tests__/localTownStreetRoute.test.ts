import {describe,it,expect} from 'vitest';
import type {TownPlan} from '../../artifacts';
import {planLocalTownStreetRoute} from '../localTownStreetRoute';
import {landDanger,landSpeedFactor} from '../routeTerrain';

const town=(lines:Array<Array<[number,number]>>=[[[0,0],[100,0]]]):TownPlan=>({burgId:1,plots:[],streets:lines.map((centerline,id)=>({id,centerline,widthFt:10}))} as TownPlan);
const route=(plan:TownPlan,from:[number,number]=[10,0],to:[number,number]=[90,0],admit=(_: [number,number])=>true,season=1)=>planLocalTownStreetRoute(from,to,plan,3,'Wetland',season,admit,()=>.4);
describe('source town street journeys',()=>{
  it('charges real road distance, season and established tier while retaining endpoints and source geometry',()=>{
    const plan=town(),before=JSON.stringify(plan),result=route(plan)!;
    expect(result.points[0]).toEqual([10,0]);expect(result.points.at(-1)).toEqual([90,0]);
    expect(result.miles).toBeCloseTo(80/5280);
    expect(result.minutes).toBeCloseTo(80/5280/3*60/landSpeedFactor('Wetland','road'));
    expect(result.danger).toBe(landDanger('Wetland','road'));
    expect(route(plan,[10,0],[90,0],()=>true,1.5)!.minutes).toBeCloseTo(result.minutes*1.5);
    expect(JSON.stringify(plan)).toBe(before);
  });
  it('follows the authored bend instead of cutting across a block',()=>{
    const result=route(town([[[0,0],[0,100],[100,100]]]),[0,10],[90,100])!;
    expect(result.points).toContainEqual([0,100]);expect(result.miles).toBeCloseTo(180/5280);
  });
  it('rejects a straight fallback between disconnected streets',()=>{
    expect(route(town([[[0,0],[20,0]],[[80,0],[100,0]]]))).toBeNull();
  });
  it('does not classify nearby country or an empty town as a maintained street',()=>{
    expect(route(town(),[10,6],[90,0])).toBeNull();expect(route(town([]))).toBeNull();
  });
  it('does not route through private plots or replace a centroid with a door',()=>{
    const plan=town();plan.plots=[{id:5,footprint:[[40,-3],[60,-3],[60,3],[40,3]]}] as TownPlan['plots'];
    expect(route(plan)).toBeNull();expect(route(plan,[50,0],[90,0])).toBeNull();
  });
  it('retains terrain and owning-cell refusals anywhere along the street',()=>{
    expect(route(town(),[10,0],[90,0],p=>p[0]<49||p[0]>51)).toBeNull();
    expect(route(town(),[10,0],[90,0],p=>p[0]<80)).toBeNull();
  });
  it('uses a longer authored land street when the shortest street crosses an unqualified river',()=>{
    const plan=town([[[0,0],[100,0]],[[0,0],[0,50],[100,50],[100,0]]]);
    const result=route(plan,[10,0],[90,0],p=>p[1]>1||p[0]<49||p[0]>51)!;
    expect(result).not.toBeNull();expect(result.points).toContainEqual([0,50]);
    expect(result.points).toContainEqual([100,50]);expect(result.miles).toBeGreaterThan(80/5280);
  });
  it('does not grant a route to an unable traveler or malformed street width',()=>{
    const plan=town();plan.streets[0].widthFt=NaN;expect(route(plan)).toBeNull();
    expect(planLocalTownStreetRoute([0,0],[10,0],town(),0,'Wetland',1,()=>true,()=>.4)).toBeNull();
  });
});
