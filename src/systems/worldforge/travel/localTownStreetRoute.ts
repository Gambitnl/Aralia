/** Local journeys can follow the same maintained streets that the town draws
 * and its residents use. A town name alone grants no shortcut: both endpoints
 * and the complete connected route must remain on real public street space
 * and pass the existing terrain/crossing admission. No body or plan is moved. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 19:07:14
 * Dependents: systems/worldforge/travel/localGroundJourney.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {TownPlan} from '../artifacts';
import {buildStreetGraph, routeAlongStreets} from '../roster/agentPath';
import {pointInPolygon} from '../submap/submapEngine';
import {planFastestRoute, type RoutePlan, type TravelGraph} from '../../travel/routePlanning';
import {climbFactorFor, landDanger, landSpeedFactor} from './routeTerrain';

type Point = [number, number];
function distanceToStreet(point: Point, from: Point, to: Point) {
  const dx=to[0]-from[0],dy=to[1]-from[1],length=dx*dx+dy*dy;
  const t=Math.max(0,Math.min(1,((point[0]-from[0])*dx+(point[1]-from[1])*dy)/(length||1)));
  return Math.hypot(point[0]-from[0]-t*dx,point[1]-from[1]-t*dy);
}

export function planLocalTownStreetRoute(origin: Point, destination: Point, plan: TownPlan | undefined,
  speedMph: number, biomeName: string, seasonMultiplier: number,
  admitted: (point: Point) => boolean, heightAt: (point: Point) => number | null): RoutePlan | null {
  if(!plan || !(speedMph>0) || !(seasonMultiplier>0))return null;
  const spans=plan.streets.flatMap(street=>street.centerline.slice(1).map((to,index)=>({from:street.centerline[index],to,width:street.widthFt})));
  const onSpan=(point:Point,span:typeof spans[number])=>Number.isFinite(span.width)&&span.width>0&&distanceToStreet(point,span.from,span.to)<=span.width/2;
  const publicStreet=(point:Point)=>point.every(Number.isFinite)&&spans.some(span=>onSpan(point,span))
    && !(plan.plots??[]).some(plot=>pointInPolygon(point,plot.footprint))&&admitted(point);
  if(!publicStreet(origin)||!publicStreet(destination))return null;
  const sourceGraph=buildStreetGraph(plan);
  if(!sourceGraph.segments.length)return null;
  const traversable=(a:Point,b:Point)=>{
    const steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
    for(let step=0;step<=steps;step++)if(!publicStreet([a[0]+(b[0]-a[0])*step/steps,a[1]+(b[1]-a[1])*step/steps]))return false;
    return true;
  };
  // A geometrically short street may cross an unqualified river or private
  // plot. Search the remaining real network, rather than inventing that link
  // or abandoning a valid longer land approach after the first blocked path.
  const segments=sourceGraph.segments.filter(span=>traversable(sourceGraph.nodes[span.fromNode],sourceGraph.nodes[span.toNode]));
  if(!segments.length)return null;
  const edgeKey=(a:number,b:number)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
  const admittedEdges=new Set(segments.map(span=>edgeKey(span.fromNode,span.toNode)));
  const graphForRoute={...sourceGraph,segments,plotEntrances:new Map(),
    adj:sourceGraph.adj.map((edges,from)=>edges.filter(edge=>admittedEdges.has(edgeKey(from,edge.to))))};
  // Roster routes may replace a building centroid with its door. A traveler
  // must retain the exact arrived feet, so only the shared street graph is used.
  const points=routeAlongStreets(graphForRoute,origin,destination);
  if(points.length<2 || points[0][0]!==origin[0] || points[0][1]!==origin[1]
    || points.at(-1)![0]!==destination[0] || points.at(-1)![1]!==destination[1])return null;
  // agentPath deliberately retains a straight fallback for disconnected legacy
  // networks. It is not proof of a street connection; admit a two-point path
  // only when both feet really share one authored street span.
  if(points.length===2&&!spans.some(span=>onSpan(origin,span)&&onSpan(destination,span)))return null;
  for(let index=1;index<points.length;index++)if(!traversable(points[index-1],points[index]))return null;
  const graph:TravelGraph={position:index=>points[index],neighbors:index=>[index-1,index+1].filter(n=>n>=0&&n<points.length),
    terrain:()=> 'road',passable:()=>true,danger:()=>landDanger(biomeName,'road'),speedFactor:()=>landSpeedFactor(biomeName,'road'),
    climbFactor:(a,b)=>climbFactorFor(((heightAt(points[b])??0)-(heightAt(points[a])??0))*100,'road')};
  return planFastestRoute(graph,0,points.length-1,{speedMph,milesPerUnit:1/5280,timeCostMultiplier:seasonMultiplier});
}
