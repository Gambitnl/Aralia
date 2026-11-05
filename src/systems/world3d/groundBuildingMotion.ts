/** Free-roam movement meets the same canonical building solids as combat.
 * Sweeps prevent thin-wall tunneling; sliding keeps a doorway approachable.
 * Supported walking follows structural floors and treads; the older planar
 * collision export remains available. Neither solver invents a route. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 18:03:43
 * Dependents: components/World3D/groundBuildingMotion.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// Moved 2026-11-02 from src/components/World3D/groundBuildingMotion.ts (GG-587, rule C11): systems/ code
// (prepareHistoricalTownLoad) needs this pure module. The old path re-exports it.

import {sweepActorBoxes,sweepActorVolumes,canActorTurn,type ActorBody,type ActorFootprint,type ActorSpace} from './actorPersonalSpace';
import {woodpileBoxesV1} from '@/systems/worldforge/props/generators/woodpileGeometry';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { doorPartForState, siteDoorKey, siteOrientationFromQuad, sitePartLocalOffset, worldOffsetToSiteLocal } from '@/systems/worldforge/bridge/sitePartTransform';
import { groundSurfaceYM } from './groundSurfaceYM';
import type { LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { createDeckSupportQueryFromMesh, type DeckSupportQuery } from '@/systems/world3d/deckGeometry';

type Point = { xM: number; zM: number };
/** Optional mounted structural surfaces. Coordinates are ground-world meters,
 * independent of the floating camera origin. The caller supplies the same
 * deck geometry that is rendered; this solver never invents a bridge height. */
export interface GroundWalkSurfaces {
  surfaceHeightsAt(xM: number, zM: number): readonly number[];
  /** Read-only rendered-fidelity diagnostic. Coarse camera LOD must never
   * replace the canonical terrain height of an accepted body or save. */
  renderedTerrainHeightAt?(xM: number, zM: number): number | undefined;
  intersectsBody(point: Point & { yM: number }, halfWidth: number, height: number): boolean;
  /** True once the full-detail chunk under the point has mounted, so its decks
   * are known. A load step that judges support must wait for this (GG-537). */
  supportReadyAt?(xM: number, zM: number): boolean;
}
/** One world's actually mounted ground/deck meshes remain available to walking even
 * when the camera streams their chunk out. Changing worlds creates a new
 * registry. Decks follow the latest mounted mesh; terrain keeps its best
 * actually mounted detail so camera-only downgrades cannot lower the feet. */
export function createMountedDeckWalkingSurfaces(): GroundWalkSurfaces & { updateLoaded(loaded: readonly LoadedChunk[]): void } {
  const retained = new Map<string, { mesh?: LoadedChunk['bundle']['decks']; terrain?: LoadedChunk['bundle']['terrain']; terrainRank: number; x: number; z: number; maxX: number; maxZ: number; query?: DeckSupportQuery; terrainQuery?: DeckSupportQuery }>();
  const ranks = { full: 0, mid: 1, low: 2, culled: 3 };
  return {
    updateLoaded(loaded) {
      for (const chunk of loaded) {
        const key = `${chunk.cx}:${chunk.cy}`, mesh = chunk.bundle.decks, previous = retained.get(key);
        // Preserve the best terrain that really mounted. A camera-only LOD
        // downgrade must not lower the feet onto a different coarse triangle.
        const keepTerrain = previous?.terrain && previous.terrainRank < ranks[chunk.lod];
        const terrain = keepTerrain ? previous.terrain : chunk.bundle.terrain;
        const terrainRank = keepTerrain ? previous.terrainRank : ranks[chunk.lod];
        if (previous?.mesh === mesh && previous?.terrain === terrain) continue;
        if (!mesh?.positions.length && !terrain?.positions.length) { retained.delete(key); continue; }
        const origin = chunkOriginWorld(chunk.cx, chunk.cy);
        const end = chunkOriginWorld(chunk.cx + 1, chunk.cy + 1);
        retained.set(key, { mesh, terrain, terrainRank, x: origin.x, z: origin.y, maxX: end.x, maxZ: end.y,
          query: mesh?.positions.length ? (previous?.mesh === mesh ? previous.query : createDeckSupportQueryFromMesh(mesh)) : undefined,
          // Terrain comparison is a diagnostic, so ordinary play should not
          // build triangle indexes for every town chunk merely by loading it.
          terrainQuery: previous?.terrain === terrain ? previous?.terrainQuery : undefined });
      }
    },
    surfaceHeightsAt(xM, zM) {
      const heights: number[] = [];
      for (const entry of retained.values()) heights.push(...entry.query?.surfaceHeightsAt(xM - entry.x, zM - entry.z) ?? []);
      return heights;
    },
    renderedTerrainHeightAt(xM, zM) {
      let highest = -Infinity;
      for (const entry of retained.values()) {
        // Heightfields stay inside their chunk. Avoid allocating triangle-bin
        // candidates for every other retained town chunk on every short step.
        if (xM < entry.x - 1e-7 || xM > entry.maxX + 1e-7 || zM < entry.z - 1e-7 || zM > entry.maxZ + 1e-7) continue;
        if (!entry.terrainQuery && entry.terrain?.positions.length) entry.terrainQuery = createDeckSupportQueryFromMesh(entry.terrain);
        for (const y of entry.terrainQuery?.surfaceHeightsAt(xM - entry.x, zM - entry.z) ?? []) highest = Math.max(highest, y);
      }
      return Number.isFinite(highest) ? highest : undefined;
    },
    intersectsBody(point, halfWidth, height) {
      // Query neighboring chunks too: rails and abutments can extend past the
      // clipping boundary, and a standing body has width on both sides of it.
      for (const entry of retained.values()) if (entry.query?.intersectsBody({ xM: point.xM - entry.x, zM: point.zM - entry.z, yM: point.yM }, halfWidth, height)) return true;
      return false;
    },
    supportReadyAt(xM, zM) {
      // Only full detail is the walking terrain that saved feet were accepted
      // on. A coarser or missing chunk is not yet a verdict on their support.
      for (const entry of retained.values()) {
        if (entry.terrainRank === ranks.full && xM >= entry.x - 1e-7 && xM <= entry.maxX + 1e-7
          && zM >= entry.z - 1e-7 && zM <= entry.maxZ + 1e-7) return true;
      }
      return false;
    },
  };
}
type SupportPoint = { yM: number; onStairs: boolean; terrain: boolean; deck?: boolean };
type Solid = { x: number; z: number; hx: number; hz: number; bottom: number; top: number; thin?: boolean; stair?: boolean; support?: boolean; tactical?: boolean };
type Support = { x: number; z: number; hx: number; hz: number; top: number; stairs: boolean };
type Building = { x: number; z: number; yaw: number; radius: number; solids: Solid[]; supports: Support[] };
const cache = new WeakMap<GroundWorld, WeakMap<ReadonlySet<string>, Building[]>>();
type SourceBuilding = NonNullable<GroundWorld['buildings']>[number];
/** GG-580 (2026-11-02): one building's solids for each of its own door states.
 * A door change used to rebuild every building in the town (about 150 ms for
 * 666 buildings) and so dropped every per-building query index below. Now only
 * the building whose door changed gets a new `Building`; the others keep the
 * same object, so their indexes and measured bodies stay warm. */
type BuildingEntry = { doorKeys: readonly string[]; byOpenKeys: Map<string, Building> };
const entries = new WeakMap<GroundWorld, WeakMap<SourceBuilding, BuildingEntry>>();
const propSolids = new WeakMap<GroundWorld, { source: GroundWorld['props']; list: Building[] }>();
const CLOSED_DOORS: ReadonlySet<string> = new Set();
// Legacy movement retains its 0.6 m walking proxy. Explicit route queries can
// supply a larger horizontal radius without resizing accepted bodies on load.
const HALF_BODY = 0.3;
const SKIN = 0.001;
const DRESSING = new Set(['motif', 'building-material', 'building-weathering', 'building-ensemble', 'building-history', 'roof', 'facade']);

function buildBuilding(ground: GroundWorld, b: SourceBuilding, openDoors: ReadonlySet<string>): Building {
  const { rotationY, doorZSign } = siteOrientationFromQuad(b.cornersM);
  const surface = groundSurfaceYM(ground, b.xM, b.zM);
  const supports: Support[] = [];
  const solids = b.parts.flatMap(source => {
    const p = doorPartForState(source, openDoors.has(siteDoorKey(b.id, source)));
    // Canonical door leaves block in their real current position. Only old
    // untagged leaves keep the legacy passage rule; combat is unchanged.
    if ((p.tag && DRESSING.has(p.tag)) || (!p.door && p.colorHex === '#4a3220')) return [];
    // Production floor slabs are four inches thick and start at the pad
    // datum. They support the walker rather than obstruct horizontal travel.
    if (p.h <= 0 || p.w <= 0 || p.d <= 0) return [];
    const off = sitePartLocalOffset(p, doorZSign);
    if (p.walkSurface && p.renderRole !== 'tactical-only') supports.push({ x: off.x, z: off.z, hx: p.w / 2, hz: p.d / 2,
      top: surface + (p.baseY ?? 0) + p.h, stairs: p.walkSurface !== 'floor' });
    return [{ x: off.x, z: off.z, hx: p.w / 2 + HALF_BODY, hz: p.d / 2 + HALF_BODY,
      thin: p.h <= 0.15, stair: p.stairSolid, tactical: p.renderRole === 'tactical-only',
      // The lower storey's wall ends just below an upper landing. Its last
      // few centimeters meet shins, not the standing torso above the slab.
      support: !!p.walkSurface || (!p.furnishing && !p.door),
      bottom: surface + (p.baseY ?? 0), top: surface + (p.baseY ?? 0) + p.h }];
  });
  return { x: b.xM, z: b.zM, yaw: rotationY,
    radius: Math.max(0, ...solids.map(s => Math.hypot(s.x, s.z) + Math.hypot(s.hx, s.hz))), solids, supports };
}

/** The building for this door state, reused while its own open doors match. */
function buildingFor(ground: GroundWorld, byBuilding: WeakMap<SourceBuilding, BuildingEntry>, b: SourceBuilding, openDoors: ReadonlySet<string>): Building {
  let entry = byBuilding.get(b);
  if (!entry) {
    entry = { doorKeys: b.parts.filter(part => part.door).map(part => siteDoorKey(b.id, part)), byOpenKeys: new Map() };
    byBuilding.set(b, entry);
  }
  const openKeys = entry.doorKeys.filter(key => openDoors.has(key)).join('\n');
  let building = entry.byOpenKeys.get(openKeys);
  if (!building) {
    building = buildBuilding(ground, b, openDoors);
    entry.byOpenKeys.set(openKeys, building);
  }
  return building;
}

function propBuildingsFor(ground: GroundWorld): Building[] {
  const cached = propSolids.get(ground);
  if (cached && cached.source === ground.props) return cached.list;
  const list: Building[] = [];
  // Only explicitly admitted model-bound props join this existing solver.
  // Legacy scenery is not retroactively solidified around accepted bodies.
  for (const prop of ground.props ?? []) {
    if (prop.retainedRenderRecipe !== 'woodpile-v1' || !prop.surface) continue;
    const base = prop.surface.groundYM - prop.surface.sinkM;
    const solids = woodpileBoxesV1(prop).map(box => ({ ...box, hx: box.hx + HALF_BODY, hz: box.hz + HALF_BODY,
      bottom: base + box.bottom, top: base + box.top, thin: false, stair: false, support: false, tactical: false }));
    list.push({ x: prop.xM, z: prop.zM, yaw: prop.rotationRad, solids, supports: [],
      radius: Math.max(...solids.map(s => Math.hypot(s.x, s.z) + Math.hypot(s.hx, s.hz))) });
  }
  propSolids.set(ground, { source: ground.props, list });
  return list;
}

/** Exported for the GG-580 reuse test only; movement callers use the queries below. */
export function buildingsFor(ground: GroundWorld, openDoors: ReadonlySet<string>): Building[] {
  let byState = cache.get(ground);
  if (!byState) { byState = new WeakMap(); cache.set(ground, byState); }
  const previous = byState.get(openDoors);
  if (previous) return previous;
  let byBuilding = entries.get(ground);
  if (!byBuilding) { byBuilding = new WeakMap(); entries.set(ground, byBuilding); }
  const buildings = (ground.buildings ?? []).filter(b => b.cornersM.length >= 4)
    .map(b => buildingFor(ground, byBuilding, b, openDoors));
  buildings.push(...propBuildingsFor(ground));
  byState.set(openDoors, buildings);
  return buildings;
}

/** Candidate selection only: exact height/contact rules below remain owners.
 * Like the ground-camera bins, these cells index immutable canonical geometry.
 * A point/short sweep should not scan every tread on every floor. Keep original
 * source order for tied support heights and first winning contacts. Large or
 * malformed rectangles stay in a full-query fallback instead of disappearing. */
const QUERY_CELL_M=1,QUERY_EDGE_M=1e-7,QUERY_MAX_CELLS=64,QUERY_CACHE_LIMIT=256;
type QueryRect={x:number;z:number;hx:number;hz:number};
type RectQueryIndex<T>={items:T[];cells:Map<string,number[]>;wide:number[];queries:Map<string,T[]>};
const queryIndices=new WeakMap<Building,{supports:RectQueryIndex<Support>;solids:RectQueryIndex<Solid>}>();
function rectQueryIndex<T extends QueryRect>(items:T[]):RectQueryIndex<T>{
 const cells=new Map<string,number[]>(),wide:number[]=[];
 for(let i=0;i<items.length;i++){
  const r=items[i],x0=Math.floor((r.x-r.hx-QUERY_EDGE_M)/QUERY_CELL_M),x1=Math.floor((r.x+r.hx+QUERY_EDGE_M)/QUERY_CELL_M),z0=Math.floor((r.z-r.hz-QUERY_EDGE_M)/QUERY_CELL_M),z1=Math.floor((r.z+r.hz+QUERY_EDGE_M)/QUERY_CELL_M);
  if(![r.x,r.z,r.hx,r.hz].every(Number.isFinite)||r.hx<0||r.hz<0||![x0,x1,z0,z1].every(Number.isSafeInteger)||(x1-x0+1)*(z1-z0+1)>QUERY_MAX_CELLS){wide.push(i);continue;}
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+':'+z,list=cells.get(key);if(list)list.push(i);else cells.set(key,[i]);}
 }
 return {items,cells,wide,queries:new Map()};
}
function buildingQueryIndex(b:Building){
 let index=queryIndices.get(b);if(!index){index={supports:rectQueryIndex(b.supports),solids:rectQueryIndex(b.solids)};queryIndices.set(b,index);}return index;
}
function nearbyRects<T>(index:RectQueryIndex<T>,minX:number,minZ:number,maxX:number,maxZ:number):T[]{
 const x0=Math.floor(minX/QUERY_CELL_M),x1=Math.floor(maxX/QUERY_CELL_M),z0=Math.floor(minZ/QUERY_CELL_M),z1=Math.floor(maxZ/QUERY_CELL_M);
 if(![minX,minZ,maxX,maxZ].every(Number.isFinite)||minX>maxX||minZ>maxZ||![x0,x1,z0,z1].every(Number.isSafeInteger)||(x1-x0+1)*(z1-z0+1)>QUERY_MAX_CELLS)return index.items;
 const key=x0+':'+z0+':'+x1+':'+z1,prior=index.queries.get(key);if(prior)return prior;
 const ids=new Set(index.wide);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const id of index.cells.get(x+':'+z)??[])ids.add(id);
 const result=[...ids].sort((a,b)=>a-b).map(id=>index.items[id]);if(index.queries.size<QUERY_CACHE_LIMIT)index.queries.set(key,result);return result;
}
function nearbySupports(b:Building,x:number,z:number):Support[]{return nearbyRects(buildingQueryIndex(b).supports,x,z,x,z);}
function nearbySolids(b:Building,minX:number,minZ:number,maxX:number,maxZ:number):Solid[]{return nearbyRects(buildingQueryIndex(b).solids,minX,minZ,maxX,maxZ);}

/** First entry into an expanded part rectangle in its own building frame. */
function entry(x: number, z: number, dx: number, dz: number, s: Solid): { t: number; nx: number; nz: number } | null {
  x -= s.x; z -= s.z;
  // Old saves may stand inside furniture. Permit movement toward the nearest
  // exit, while disallowing deeper penetration or traversal to its far side.
  if (Math.abs(x) < s.hx - 1e-9 && Math.abs(z) < s.hz - 1e-9) {
    const xDepth = s.hx - Math.abs(x), zDepth = s.hz - Math.abs(z);
    const nx = xDepth <= zDepth ? (x < 0 ? -1 : 1) : 0;
    const nz = xDepth > zDepth ? (z < 0 ? -1 : 1) : 0;
    return dx * nx + dz * nz > 0 ? null : { t: 0, nx, nz };
  }
  let near = -Infinity, far = Infinity, nx = 0, nz = 0;
  for (const [p, d, h, ax, az] of [[x, dx, s.hx, 1, 0], [z, dz, s.hz, 0, 1]]) {
    if (Math.abs(d) < 1e-12) { if (Math.abs(p) >= h) return null; continue; }
    const a = (-h - p) / d, b = (h - p) / d;
    const start = Math.min(a, b), end = Math.max(a, b);
    if (start > near) { near = start; nx = -Math.sign(d) * ax; nz = -Math.sign(d) * az; }
    far = Math.min(far, end);
  }
  if (near > far || far <= 0 || near < -1e-9 || near > 1) return null;
  return { t: Math.max(0, near), nx, nz };
}

/** The measured standing box in the body's own axes, including asymmetric
 * anatomy/gear. A margin is explicit; accepted feet and mesh size stay fixed. */
export type GroundBodyFootprint=ActorFootprint&{marginM?:number};
export function isValidGroundBodyFootprint(f:GroundBodyFootprint|null|undefined):f is GroundBodyFootprint {
 return !!f&&[f.minXM,f.maxXM,f.minZM,f.maxZM,f.yawRad,f.marginM??0].every(Number.isFinite)
  &&f.maxXM>f.minXM&&f.maxZM>f.minZM&&(f.marginM??0)>=0;
}
function footprintRadius(f:GroundBodyFootprint):number {return Math.hypot(Math.max(Math.abs(f.minXM),Math.abs(f.maxXM)),Math.max(Math.abs(f.minZM),Math.abs(f.maxZM)))+(f.marginM??0);}
const solidBodies=new WeakMap<Building,Map<Solid,ActorBody>>();
const measuredValidity=new WeakMap<Building,boolean>();
/** A malformed solid is unknown geometry, not empty space. Cache this check
 * only with the existing immutable building/door-state packet. */
function validMeasuredBuilding(b:Building):boolean {
 const prior=measuredValidity.get(b);if(prior!==undefined)return prior;
 const valid=[b.x,b.z,b.yaw,b.radius].every(Number.isFinite)&&b.solids.every(s=>
  [s.x,s.z,s.hx,s.hz,s.bottom,s.top].every(Number.isFinite)&&s.hx>HALF_BODY&&s.hz>HALF_BODY&&s.top>s.bottom);
 measuredValidity.set(b,valid);return valid;
}

/** Reuse immutable canonical solids; strip only the old 0.3m proxy expansion
 * before applying the measured box through the shared actor SAT owner. */
function solidBody(b:Building,s:Solid):ActorBody {
 let map=solidBodies.get(b);if(!map){map=new Map();solidBodies.set(b,map);}const cached=map.get(s);if(cached)return cached;
 const c=Math.cos(b.yaw),sn=Math.sin(b.yaw),hx=s.hx-HALF_BODY,hz=s.hz-HALF_BODY;
 const body:ActorBody={xM:b.x+s.x*c+s.z*sn,zM:b.z-s.x*sn+s.z*c,yM:s.bottom,heightM:s.top-s.bottom,radiusM:Math.hypot(hx,hz),
  footprint:{minXM:-hx,maxXM:hx,minZM:-hz,maxZM:hz,yawRad:b.yaw}};map.set(s,body);return body;
}
function measuredBody(point:Point&{yM:number},height:number,f:GroundBodyFootprint):ActorBody {return {...point,heightM:height,radiusM:footprintRadius(f),marginM:f.marginM??0,footprint:f};}
function measuredStaticSpace(ground:GroundWorld,point:Point&{yM:number},height:number,f:GroundBodyFootprint,doors:ReadonlySet<string>){
 const torso:ActorSpace=new Map(),feet:Array<{space:ActorSpace;yaw:number}>=[];let index=0;
 for(const b of buildingsFor(ground,doors)){
  if(Math.hypot(point.xM-b.x,point.zM-b.z)>b.radius+footprintRadius(f))continue;
  if(!validMeasuredBuilding(b))return {torso,feet,valid:false};
  const low:ActorSpace=new Map(),local=worldOffsetToSiteLocal(point.xM-b.x,point.zM-b.z,b.yaw),r=footprintRadius(f),pad=Math.max(0,r-HALF_BODY)+QUERY_EDGE_M;
  // Keep the existing circle-bound test below. The index only avoids visiting
  // distant solids; exact standing and sampled-turn admission stay unchanged.
  for(const s of nearbySolids(b,local.lx-pad,local.lz-pad,local.lx+pad,local.lz+pad)){
   if(s.tactical||s.top<=point.yM+((s.stair||s.support) ? .22 : .08)||s.bottom>=point.yM+height)continue;
   if(Math.abs(local.lx-s.x)>s.hx-HALF_BODY+r||Math.abs(local.lz-s.z)>s.hz-HALF_BODY+r)continue;
   const target=s.support&&s.top<=point.yM+.45?low:torso;target.set(String(index++),solidBody(b,s));
  }if(low.size)feet.push({space:low,yaw:b.yaw});
 }return {torso,feet,valid:true};
}
function hasBoxOverlap(point:Point&{yM:number},body:ActorBody,space:ActorSpace):boolean {
 for(const other of space.values()){const contact=sweepActorBoxes(point,point,body,other);if(!contact||contact.inside&&contact.depth>1e-8)return true;}return false;
}
/** A new stance is checked without invoking the old loaded-overlap escape
 * rule. Mounted decks still expose a radius query, so that one boundary stays
 * conservative rather than claiming oriented mesh fidelity it cannot supply. */
export function isGroundBodyClear(ground:GroundWorld,point:Point&{yM:number},height:number,f:GroundBodyFootprint,doors:ReadonlySet<string>=CLOSED_DOORS,surfaces?:GroundWalkSurfaces):boolean {
 if(!isValidGroundBodyFootprint(f)||![point.xM,point.yM,point.zM,height].every(Number.isFinite)||height<=0||!supportAt(ground,point,point.yM,doors,surfaces))return false;
 const {torso,feet,valid}=measuredStaticSpace(ground,point,height,f,doors),body=measuredBody(point,height,f);
 if(!valid)return false;
 if(hasBoxOverlap(point,body,torso))return false;
 for(const low of feet)if(hasBoxOverlap(point,measuredBody(point,height,{minXM:-.08,maxXM:.08,minZM:-.08,maxZM:.08,yawRad:low.yaw}),low.space))return false;
 const shin=Math.min(.22,height/2);
 return !surfaces?.intersectsBody({...point,yM:point.yM+shin},footprintRadius(f),height-shin);
}
/** A turn changes facing only. The shared corner-travel margin covers every
 * interval between sampled poses; a failure never moves accepted feet. The
 * structural check uses zero height tolerance so a low lintel still counts. */
export function canGroundBodyTurn(ground:GroundWorld,point:Point&{yM:number},height:number,f:GroundBodyFootprint,yaw:number,doors:ReadonlySet<string>=CLOSED_DOORS,surfaces?:GroundWalkSurfaces):boolean {
 if(!Number.isFinite(yaw)||!isGroundBodyClear(ground,point,height,f,doors,surfaces))return false;
 return canActorTurn(point,'measured-walker',measuredBody(point,height,f),yaw,measuredStaticSpace(ground,point,height,f,doors).torso,0);
}

function resolveHorizontalMotion(ground: GroundWorld, from: Point, requested: Point, footY: number, openDoors: ReadonlySet<string>, walking = false, bodyHeight = 1.9, bodyRadius = HALF_BODY,bodyFootprint?:GroundBodyFootprint): Point & { blocked: boolean; blockedReason?: 'low-clearance' } {
  if (!Number.isFinite(bodyRadius)||bodyRadius<=0||![from.xM, from.zM, requested.xM, requested.zM, footY].every(Number.isFinite)) return { ...from, blocked: true };
  let xM = from.xM, zM = from.zM, dx = requested.xM - xM, dz = requested.zM - zM;
  const growth=(bodyFootprint?Math.max(bodyRadius,footprintRadius(bodyFootprint)):bodyRadius)-HALF_BODY;
  let blocked = false, overheadBlocked = false, otherBlocked = false;
  // At most three contacts: slide along one face, then stop at an inside corner.
  for (let pass = 0; pass < 3 && Math.hypot(dx, dz) > 1e-8; pass++) {
    let hit: { t: number; nx: number; nz: number; overhead?: boolean } | null = null;
    for (const b of buildingsFor(ground, openDoors)) {
      if (Math.hypot(xM - b.x, zM - b.z) > b.radius + Math.max(0,growth) + Math.hypot(dx, dz)) continue;
      if(bodyFootprint&&!validMeasuredBuilding(b))return {...from,blocked:true};
      const pos = worldOffsetToSiteLocal(xM - b.x, zM - b.z, b.yaw);
      const move = worldOffsetToSiteLocal(dx, dz, b.yaw);
      const pad=Math.max(0,growth)+QUERY_EDGE_M;
      for (const s of nearbySolids(b,Math.min(pos.lx,pos.lx+move.lx)-pad,Math.min(pos.lz,pos.lz+move.lz)-pad,Math.max(pos.lx,pos.lx+move.lx)+pad,Math.max(pos.lz,pos.lz+move.lz)+pad)) {
        // Combat's retained party-wall enclosure is not a second invisible
        // ground wall. The legacy planar export keeps its existing contract.
        if (walking && s.tactical) continue;
        if (!walking && s.thin) continue;
        // Floors under the feet and lintels above the head stay passable.
        if (s.top <= footY + (walking && (s.stair || s.support) ? 0.22 : 0.08) || s.bottom >= footY + bodyHeight) continue;
        // Low stair risers meet feet and shins. Using shoulder width here
        // collides with a second riser before the foot can reach its next tread.
        const inset = walking && (s.stair || s.support) && s.top <= footY + 0.45 ? Math.max(0,bodyRadius - 0.08) : 0;
        let contact:{t:number;nx:number;nz:number}|null;
        if(bodyFootprint){
          // The foot-to-corner radius bounds every measured orientation. Cull
          // only solids outside that entire swept box, then use exact SAT for
          // nearby contact. Unlike entry(), this test never treats an existing
          // broad overlap as permission to skip a solid while escaping.
          const bound=growth+HALF_BODY,hx=s.hx-HALF_BODY+bound,hz=s.hz-HALF_BODY+bound;
          if(Math.max(pos.lx,pos.lx+move.lx)<s.x-hx||Math.min(pos.lx,pos.lx+move.lx)>s.x+hx
            ||Math.max(pos.lz,pos.lz+move.lz)<s.z-hz||Math.min(pos.lz,pos.lz+move.lz)>s.z+hz)continue;
          const low=inset>0,f=low?{minXM:-.08,maxXM:.08,minZM:-.08,maxZM:.08,yawRad:b.yaw}:bodyFootprint;
          const body=measuredBody({xM,zM,yM:footY},bodyHeight,f);
          const swept=sweepActorBoxes(body,{xM:xM+dx,zM:zM+dz,yM:footY},body,solidBody(b,s));
          if(!swept)contact={t:0,nx:0,nz:0};
          else if(swept.inside){
            const away=dx*swept.nx+dz*swept.nz;
            contact=away>(swept.depth>1e-8?0:-1e-9)?null:{t:0,nx:swept.nx,nz:swept.nz};
          }else contact=swept.hit&&swept.entry>=0?{t:swept.entry,nx:swept.entryNX,nz:swept.entryNZ}:null;
          if(contact&&(!hit||contact.t<hit.t)){hit={t:contact.t,nx:contact.nx,nz:contact.nz,overhead:walking&&s.bottom>footY+bodyHeight/2};continue;}
          continue;
        }
        contact = entry(pos.lx, pos.lz, move.lx, move.lz,
          growth||inset ? { ...s, hx: s.hx + growth - inset, hz: s.hz + growth - inset } : s);
        if (!contact || (hit && contact.t >= hit.t)) continue;
        const cos = Math.cos(b.yaw), sin = Math.sin(b.yaw);
        hit = { t: contact.t, nx: contact.nx * cos + contact.nz * sin, nz: -contact.nx * sin + contact.nz * cos,
          overhead: walking && s.bottom > footY + bodyHeight / 2 };
      }
    }
    if (!hit) { xM += dx; zM += dz; break; }
    blocked = true;
    if (hit.overhead) overheadBlocked = true; else otherBlocked = true;
    const t = Math.max(0, hit.t - SKIN / Math.hypot(dx, dz));
    xM += dx * t; zM += dz * t;
    dx *= 1 - t; dz *= 1 - t;
    const into = dx * hit.nx + dz * hit.nz;
    if (into < 0) { dx -= hit.nx * into; dz -= hit.nz * into; }
    else break;
  }
  // Explain only an actual winning upper-body contact. A normal wall must
  // not suggest that stowing equipment will create a passage through it.
  return { xM, zM, blocked, ...(overheadBlocked && !otherBlocked ? {blockedReason: 'low-clearance' as const} : {}) };
}

/** Legacy planar collision contract retained for tactical/older consumers. */
export function resolveBuildingMotion(ground: GroundWorld, from: Point, requested: Point, footY: number, openDoors: ReadonlySet<string> = CLOSED_DOORS,bodyRadiusM=HALF_BODY): Point & { blocked: boolean } {
  return resolveHorizontalMotion(ground, from, requested, footY, openDoors,false,1.9,bodyRadiusM);
}

/** Water supports a swimmer without a floor. Check its complete measured body
 * against the same source walls, doors, furniture and retained props, including
 * vertical travel. This grants neither terrain clearance nor water permission;
 * the swimming owner must check those and the mounted bridge meshes too. */
export function groundBodyVolumeClear(ground:GroundWorld,from:Point&{yM:number},to:Point&{yM:number},body:ActorBody,doors:ReadonlySet<string>=CLOSED_DOORS):boolean {
  if(!body.footprint||!isValidGroundBodyFootprint(body.footprint)||![from.xM,from.yM,from.zM,to.xM,to.yM,to.zM,body.heightM,body.radiusM].every(Number.isFinite)||body.heightM<=0||body.radiusM<=0)return false;
  const distance=Math.hypot(to.xM-from.xM,to.zM-from.zM);
  for(const b of buildingsFor(ground,doors)){
    if(Math.hypot(from.xM-b.x,from.zM-b.z)>b.radius+body.radiusM+distance)continue;
    if(!validMeasuredBuilding(b))return false;
    for(const s of b.solids){
      if(s.tactical)continue;
      const hit=sweepActorVolumes(from,to,body,solidBody(b,s));
      if(!hit||hit.hit||hit.inside)return false;
    }
  }
  return true;
}

/** Walking-only recovery from a measured body already intersecting a solid.
 * Every pre-existing overlap must make strictly less horizontal penetration
 * along its nearest exit normal; new contacts and malformed source geometry
 * still block. Swimming and other callers keep the strict volume query above. */
export function groundBodyVolumeRecoveryClear(ground:GroundWorld,from:Point&{yM:number},to:Point&{yM:number},body:ActorBody,doors:ReadonlySet<string>=CLOSED_DOORS):boolean {
  if(!body.footprint||!isValidGroundBodyFootprint(body.footprint)||![from.xM,from.yM,from.zM,to.xM,to.yM,to.zM,body.heightM,body.radiusM].every(Number.isFinite)||body.heightM<=0||body.radiusM<=0)return false;
  const distance=Math.hypot(to.xM-from.xM,to.zM-from.zM),dx=to.xM-from.xM,dz=to.zM-from.zM;
  for(const b of buildingsFor(ground,doors)){
    if(Math.hypot(from.xM-b.x,from.zM-b.z)>b.radius+body.radiusM+distance)continue;
    if(!validMeasuredBuilding(b))return false;
    for(const s of b.solids){
      if(s.tactical)continue;
      // The real sweep already reports its initial overlap. Reuse that fact
      // rather than repeating a zero-length volume sweep for every clear solid.
      const solid=solidBody(b,s),sweep=sweepActorVolumes(from,to,body,solid);
      if(!sweep)return false;
      if(!sweep.inside){
        if(sweep.hit)return false;
        continue;
      }
      // Existing penetration grants only a horizontal escape, never a shortcut
      // to another floor or through the top/bottom of the intersected object.
      if(Math.abs(to.yM-from.yM)>1e-8)return false;
      const before=sweepActorBoxes(from,to,body,solid),after=sweepActorBoxes(to,to,body,solid);
      const outward=before?dx*before.nx+dz*before.nz:0;
      if(!before?.inside||before.depth<=1e-8||!after||after.depth>=before.depth-1e-8
        ||outward<=1e-8)return false;
      // A long diagonal can reduce the minimum depth yet leave through a
      // different face. Require the nearest separating plane to be reached
      // before any other exit during this step. Short, still-overlapping steps
      // remain valid while they make strict progress toward that same escape.
      const nearestExit=before.depth/outward;
      if(sweep.leave<Math.min(1,nearestExit)-1e-8)return false;
    }
  }
  return true;
}

function supportAt(ground: GroundWorld, point: Point, footY: number, doors: ReadonlySet<string>, surfaces?: GroundWalkSurfaces): SupportPoint | null {
  const terrain = groundSurfaceYM(ground, point.xM, point.zM);
  let result: SupportPoint | null = terrain <= footY + 0.22 && terrain >= footY - 0.3 ? { yM: terrain, onStairs: false, terrain: true } : null;
  // A deck is eligible only beside the current feet, just like a real tread.
  // Being horizontally beneath a bridge never promotes a saved body onto it.
  for (const top of surfaces?.surfaceHeightsAt(point.xM, point.zM) ?? []) {
    if (Number.isFinite(top) && top <= footY + .22 + 1e-7 && top >= footY - .3 - 1e-7 && (!result || top > result.yM)) {
      result = { yM: top, onStairs: false, terrain: false, deck: true };
    }
  }
  for (const b of buildingsFor(ground, doors)) {
    if (Math.hypot(point.xM - b.x, point.zM - b.z) > b.radius) continue;
    const p = worldOffsetToSiteLocal(point.xM - b.x, point.zM - b.z, b.yaw);
    for (const s of nearbySupports(b,p.lx,p.lz)) if (Math.abs(p.lx - s.x) <= s.hx + 1e-7 && Math.abs(p.lz - s.z) <= s.hz + 1e-7
      && s.top <= footY + 0.22 + 1e-7 && s.top >= footY - 0.3 - 1e-7 && (!result || s.top > result.yM)) {
      result = { yM: s.top, onStairs: s.stairs, terrain: false };
    }
  }
  return result;
}

/** Loading or framing an accepted pose cannot replace its finite height.
 * New arrivals without a height still resolve their nearby terrain/floor. */
export function groundWalkHeight(ground: GroundWorld, point: Point & { yM?: number }, doors: ReadonlySet<string> = CLOSED_DOORS, surfaces?: GroundWalkSurfaces): number {
  if (Number.isFinite(point.yM)) return point.yM!;
  const terrain = groundSurfaceYM(ground, point.xM, point.zM);
  return supportAt(ground, point, terrain, doors, surfaces)?.yM ?? terrain;
}

/** A support discrepancy is a movement refusal, never permission to relocate
 * an accepted save. Rendering and admission can diagnose it independently. */
export function isGroundFootingSupported(ground: GroundWorld, point: Point & { yM: number },
  doors: ReadonlySet<string> = CLOSED_DOORS, surfaces?: GroundWalkSurfaces): boolean {
  return [point.xM, point.zM, point.yM].every(Number.isFinite)
    && supportAt(ground, point, point.yM, doors, surfaces) !== null;
}

/** Continuous supported walking: sample short steps, climb only a real tread,
 * and stop at an unsupported drop. Requested heights never enter this solver.
 * Standing height includes the actual figure and gear. Legacy callers retain
 * the 1.9 m height and 0.6 m horizontal defaults. Explicit route queries use
 * their required clearance radius; no caller body or saved feet are resized. */
export function resolveGroundWalk(ground: GroundWorld, from: Point & { yM: number }, requested: Point,
  doors: ReadonlySet<string> = CLOSED_DOORS, surfaces?: GroundWalkSurfaces, standingHeightM = 1.9,bodyRadiusM=HALF_BODY,bodyFootprint?:GroundBodyFootprint): Point & { yM: number; blocked: boolean; onStairs: boolean; blockedReason?: 'steep-grade' | 'low-clearance' } {
  if(bodyFootprint!==undefined&&(!isValidGroundBodyFootprint(bodyFootprint)||!Number.isFinite(standingHeightM)||standingHeightM<=0))return {...from,blocked:true,onStairs:false};
  if(!Number.isFinite(bodyRadiusM)||bodyRadiusM<=0)return {...from,blocked:true,onStairs:false};
  const bodyHeight = Number.isFinite(standingHeightM) && standingHeightM > 0 ? standingHeightM : 1.9;
  if (![from.xM, from.zM, from.yM, requested.xM, requested.zM].every(Number.isFinite)) return { ...from, blocked: true, onStairs: false };
  const initialSupport = supportAt(ground, from, from.yM, doors, surfaces);
  if (!initialSupport) return { ...from, blocked: true, onStairs: false };
  const dx = requested.xM - from.xM, dz = requested.zM - from.zM;
  // An idle avatar/camera frame is not a request to settle or migrate its save.
  if (dx === 0 && dz === 0) return { ...from, blocked: false, onStairs: false };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.04));
  let pose = { xM: from.xM, zM: from.zM, yM: initialSupport.yM }, blocked = false, onStairs = false;
  let blockedReason: 'steep-grade' | 'low-clearance' | undefined;
  for (let i = 0; i < steps; i++) {
    const target = { xM: pose.xM + dx / steps, zM: pose.zM + dz / steps };
    const support = supportAt(ground, target, pose.yM, doors, surfaces);
    if (!support) { blocked = true; break; }
    const motion = resolveHorizontalMotion(ground, pose, target, Math.min(pose.yM, support.yM), doors, true, bodyHeight,bodyRadiusM,bodyFootprint);
    const reached = supportAt(ground, motion, pose.yM, doors, surfaces);
    if (!reached) { blocked = true; break; }
    const previousSupport = supportAt(ground, pose, pose.yM, doors, surfaces);
    // Continuous sampling must not turn the short-step allowance into cliff
    // climbing. Natural ground and deck grades permit 40 degrees; floor edges and
    // stair treads retain their existing step-height and clearance admission.
    if (((previousSupport?.terrain && reached.terrain) || (previousSupport?.deck && reached.deck))
      && Math.abs(reached.yM - pose.yM) > Math.hypot(motion.xM - pose.xM, motion.zM - pose.zM) * Math.tan(40 * Math.PI / 180) + 1e-7) {
      // Explain this actual refusal to the player. The grade limit and reached
      // feet stay unchanged; an alternate approach still needs normal admission.
      blocked = true; blockedReason = 'steep-grade'; break;
    }
    // Match the existing floor/tread step allowance at the shins. Otherwise
    // the upslope deck under the front of the feet intersects the body box and
    // prevents walking a gentle arch. The measured head still meets the deck.
    const shinHeight = Math.min(.22, bodyHeight / 2);
    if (surfaces?.intersectsBody({ xM: motion.xM, zM: motion.zM, yM: reached.yM + shinHeight }, bodyFootprint?Math.max(bodyRadiusM,footprintRadius(bodyFootprint)):bodyRadiusM, bodyHeight - shinHeight)) {
      blocked = true; break;
    }
    // Thin upper slabs are ceilings too. A standing body cannot step up into
    // one simply because its center has found a higher walking surface.
    const lowCeiling = buildingsFor(ground, doors).some(b => {
      if (Math.hypot(motion.xM - b.x, motion.zM - b.z) > b.radius+Math.max(0,(bodyFootprint?Math.max(bodyRadiusM,footprintRadius(bodyFootprint)):bodyRadiusM)-HALF_BODY)) return false;
      const p = worldOffsetToSiteLocal(motion.xM - b.x, motion.zM - b.z, b.yaw);
      const pad=Math.max(0,(bodyFootprint?Math.max(bodyRadiusM,footprintRadius(bodyFootprint)):bodyRadiusM)-HALF_BODY)+QUERY_EDGE_M;
      return nearbySolids(b,p.lx-pad,p.lz-pad,p.lx+pad,p.lz+pad).some(s => {
        if(s.tactical||s.bottom<=reached.yM+.5||s.bottom>=reached.yM+bodyHeight)return false;
        if(bodyFootprint){
          // The foot-to-corner circle covers asymmetric gear, every facing
          // and the explicit margin. Distant slabs cannot touch that circle;
          // nearby ceilings still receive the same exact box-overlap check.
          const bound=footprintRadius(bodyFootprint);
          if(Math.abs(p.lx-s.x)>s.hx-HALF_BODY+bound+1e-7||Math.abs(p.lz-s.z)>s.hz-HALF_BODY+bound+1e-7)return false;
          const body=measuredBody({xM:motion.xM,zM:motion.zM,yM:reached.yM},bodyHeight,bodyFootprint),overlap=sweepActorBoxes(body,body,body,solidBody(b,s));return !!overlap?.inside&&overlap.depth>1e-8;
        }
        return Math.abs(p.lx-s.x)<s.hx+(bodyRadiusM-HALF_BODY)&&Math.abs(p.lz-s.z)<s.hz+(bodyRadiusM-HALF_BODY);
      });
    });
    if (lowCeiling) { blocked = true; blockedReason = 'low-clearance'; break; }
    pose = { xM: motion.xM, zM: motion.zM, yM: reached.yM };
    onStairs ||= reached.onStairs;
    blocked ||= motion.blocked;
    if (motion.blockedReason) blockedReason = motion.blockedReason;
  }
  return { ...pose, blocked, onStairs, ...(blockedReason ? { blockedReason } : {}) };
}
