/** New source roads may bend around obstacles, never through a narrow gap. */
import {describe,it,expect} from 'vitest';
import {findRuralApproach} from '../ruralApproachRoute';
import type {Pt} from '../../submap/submapEngine';
import {footprintBoundaryDistance,footprintRouteDistance,pointInsideFootprint} from '../../props/propFootprint';
const polygon=(x:number,y:number,w:number,h:number)=>[{x,z:y},{x:x+w,z:y},{x:x+w,z:y+h},{x,z:y+h}];
function space(obstacles:ReturnType<typeof polygon>[],town=polygon(-20,-40,140,120)){
 const segmentClear=(a:Pt,b:Pt)=>{
  const from={x:a[0],z:a[1]},to={x:b[0],z:b[1]};
  return pointInsideFootprint(from,town)&&pointInsideFootprint(to,town)
   &&footprintBoundaryDistance([from,to],town)>=4
   &&obstacles.every(p=>footprintRouteDistance(p,from,to)>=5);
 };
 return {segmentClear,pointClear:(p:Pt)=>segmentClear(p,p)};
}
describe('bounded rural approach routing',()=>{
 it('finds and safely smooths an eight-foot connection around a blocking lot',()=>{
  const admission=space([polygon(25,-12,20,24)]),request={start:[0,0] as Pt,targets:[[70,0] as Pt],step:5,...admission};
  expect(admission.segmentClear(request.start,request.targets[0])).toBe(false);
  const before=JSON.stringify(request),route=findRuralApproach(request)!;
  expect(route).toBeDefined();expect(route.targetIndex).toBe(0);expect(route.points[0]).toEqual([0,0]);expect(route.points.at(-1)).toEqual([70,0]);
  expect(route.points.length).toBeGreaterThan(2);
  for(let i=1;i<route.points.length;i++)expect(admission.segmentClear(route.points[i-1],route.points[i])).toBe(true);
  expect(findRuralApproach(request)).toEqual(route);expect(JSON.stringify(request)).toBe(before);
 });
 it('joins a narrow diagonal public-road end using its admitted round cap',()=>{
  const u=[Math.SQRT1_2,Math.SQRT1_2],v=[-u[1],u[0]],origin=[50,50];
  const band=(low:number,high:number)=>[[0,low],[80,low],[80,high],[0,high]].map(([a,b])=>({x:origin[0]+u[0]*a+v[0]*b,z:origin[1]+u[1]*a+v[1]*b}));
  const obstacles=[band(5,40),band(-40,-5)],admission=space(obstacles,polygon(-100,-100,300,300));
  const squareClear=(p:Pt)=>obstacles.every(o=>{
   const cap=polygon(p[0]-4,p[1]-4,8,8);
   return !cap.some(c=>pointInsideFootprint(c,o))&&footprintBoundaryDistance(cap,o)>=1;
  });
  expect(squareClear([50,50])).toBe(false);expect(admission.pointClear([50,50])).toBe(true);
  const route=findRuralApproach({start:[30,30],targets:[[50,50]],step:5,pointClear:squareClear,targetClear:admission.pointClear,segmentClear:admission.segmentClear});
  expect(route?.points.at(-1)).toEqual([50,50]);
 });
 it('retains the original public-target index when a nearer target is blocked',()=>{
  const admission=space([polygon(25,-12,20,24)]);
  const route=findRuralApproach({start:[0,0],targets:[[30,0],[70,0]],step:5,...admission})!;
  expect(route.targetIndex).toBe(1);expect(route.points.at(-1)).toEqual([70,0]);
 });
 it('connects another admitted point of the same source street when its seed is blocked',()=>{
  const admission=space([polygon(65,-5,10,10)]);
  expect(admission.pointClear([70,0])).toBe(false);
  const route=findRuralApproach({start:[0,0],targets:[[70,0]],step:5,...admission,
   connect:()=>({point:[70,25],targetIndex:0}),estimate:()=>0})!;
  expect(route.targetIndex).toBe(0);expect(route.points.at(-1)).toEqual([70,25]);
  for(let i=1;i<route.points.length;i++)expect(admission.segmentClear(route.points[i-1],route.points[i])).toBe(true);
 });
 it.each(['index','point','segment'] as const)('cannot bypass %s admission through a dynamic street connector',kind=>{
  const admission=space([],polygon(-20,-40,140,120)),stops:string[]=[];
  const route=findRuralApproach({start:[0,0],targets:[[70,0]],step:5,maxExpanded:1,
   ...admission,segmentClear:()=>false,connect:()=>({point:kind==='point'?[NaN,0]:[70,25],targetIndex:kind==='index'?1:0}),
   onRefusal:reason=>stops.push(reason)});
  expect(route).toBeUndefined();expect(stops).toEqual(['search-limit']);
 });
 it('cannot cut diagonally through adjoining obstacles',()=>{
  const admission=space([polygon(0,40,50,20),polygon(50,40,50,20)],polygon(0,0,100,100));
  expect(findRuralApproach({start:[20,20],targets:[[80,80]],step:10,...admission})).toBeUndefined();
 });
 it('keeps an eight-foot route out of a six-foot opening',()=>{
  const admission=space([polygon(40,0,20,47),polygon(40,53,20,47)],polygon(0,0,100,100));
  expect(findRuralApproach({start:[20,50],targets:[[80,50]],step:5,...admission})).toBeUndefined();
 });
 it('returns a bounded refusal rather than inventing the remaining route',()=>{
  let probes=0;const stops:string[]=[];const route=findRuralApproach({start:[0,0],targets:[[10000,0]],step:5,maxExpanded:3,
   pointClear:()=>{probes++;return true;},
   segmentClear:(a,b)=>(a[0]<30&&b[0]<30)||(a[0]>30&&b[0]>30),onRefusal:reason=>stops.push(reason)});
  expect(route).toBeUndefined();expect(probes).toBeLessThan(30);expect(stops).toEqual(['search-limit']);
 });
 it.each([0,-1,NaN])('refuses invalid search scale %s',step=>{
  expect(findRuralApproach({start:[0,0],targets:[[10,0]],step,pointClear:()=>true,segmentClear:()=>true})).toBeUndefined();
 });
 it('does not search when the forecourt or every public target is blocked',()=>{
  const base={start:[0,0] as Pt,targets:[[10,0] as Pt],step:5,segmentClear:()=>true};
  expect(findRuralApproach({...base,pointClear:()=>false})).toBeUndefined();
  expect(findRuralApproach({...base,pointClear:p=>p[0]===0})).toBeUndefined();
 });
});
