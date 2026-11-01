/**
 * Inspects seven reference-inspired forms carved into the native main rapids.
 * Ordinary inspection adds labels/cameras and uses the existing river water.
 * Explicit nativeGrid/filmStudy/legacy URLs retain the frozen neighboring rig.
 * Existing liquid geometry and optional markers use accepted solver snapshots.
 * The explicit native terrain test reuses RiverFlowSolver, wet-front expansion,
 * conservative airborne transfer and river materials on the actual drawn bed.
 * It is separate from the earlier contact prototype, not its cosmetic reskin.
 * Markers are diagnostic symbols, not enlarged drops or a liquid surface.
 * One worker advances the contact prototype in bounded fixed-tick batches.
 * The native test currently advances bounded CPU steps on the page; practical
 * runtime, overhangs and resolved impact remain unqualified.
 * Other courses retain their water while paused; there is no catch-up backlog.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 22:56:07
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx, components/DesignPreview/steps/water/WaterfallComparisonPanel.tsx, components/World3D/water/riverReachScene.ts
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { RiverTerrainCourse } from '@/systems/world3d/river/riverTerrainCourse';
import { createRiverTerrainFrame, terrainPointToLocal, terrainPointToWorld } from '@/systems/world3d/river/riverTerrainFrame';
import { fitRiverXEdges,riverCellX,riverIndexX } from '@/systems/world3d/river/riverRectGrid';
import { RiverTerrainCourseView } from './riverTerrainCourseView';
import { isWaterfallPresentation, isPackedWaterfallPresentation, unpackWaterfallPresentation, type WaterfallDisplaySnapshot } from '@/systems/world3d/river/waterfallPresentationSnapshot';
import { WaterfallContactView, type ContactSurfacePacket } from './waterfallContactView';
import { buildWaterfallComparisonLandscape } from './waterfallComparisonLandscape';
import { WaterfallAttachedFilmView, type AttachedFilmMode } from './waterfallAttachedFilmView';
import type { RiverWaterUniforms } from './riverWaterMaterial';
import { defaultRiverCourse } from '@/systems/world3d/river/riverReach';
import { WATERFALL, mainRapidsAt, MAIN_CHANNEL_S,riverReconstructionEnabled } from '@/systems/world3d/river/riverHeadwaters';
import { RECONSTRUCTION_FALLS,reconstructedRapidsAt } from '@/systems/world3d/river/riverRapidsReconstruction';
import type { ContactSnapshot, ContactVec3 } from '@/systems/world3d/river/waterfallContactFlow';
import type { RiverPose } from './riverReachScene';
import {fitWaterfallCamera} from './riverWaterfallCamera';
import type { TerrainComparisonWorkerRequest, TerrainComparisonWorkerResponse } from '@/systems/world3d/river/waterfallTerrainComparisons';

import { TERRAIN_COMPARISON_CASES, RAPIDS_WATERFALL_SEQUENCE, type TerrainComparisonId } from '@/systems/world3d/river/waterfallTerrainProfiles';

export type ComparisonId = TerrainComparisonId;
export interface ComparisonReading {
  physicalTime: number; sourceOn: boolean; running: boolean; failure: string | null; lastStepMilliseconds: number;
  cases: Array<{ id: ComparisonId; emittedVolume: number; storedVolume: number; arrivedVolume: number; closureError: number; contactCount: number; surfaceContactCounts: Record<string, number>; parcelCount: number }>;
  arrivals: unknown[];
}
interface ComparisonSnapshot { preparedSurface?: ContactSurfacePacket; snapshots: Array<{ id: ComparisonId; snapshot: WaterfallDisplaySnapshot }>; reading: ComparisonReading }
export type ComparisonDisplay = 'liquid' | 'markers' | 'native';
export interface ComparisonState { integrated?: boolean; display: ComparisonDisplay; nativeAligned?:boolean; nativeConforming?:boolean; selected: ComparisonId | null; native?: ReturnType<RiverTerrainCourse['receipt']>; liquid: { representedVolume: number; unresolvedVolume: number; surfaceVertices: number } | null; displayError: string | null; reading: ComparisonReading | null; wallSeconds: number; pace: number; markers: Record<string, { parcels: number; filmCells: number }>; loading: boolean; error: string | null }
// The same catalog drives the worker, signs and controls, so adding a course
// cannot silently leave its water or camera behind.
const ids = TERRAIN_COMPARISON_CASES.map(item => item.id);
const COURSE_SPACING = 64;

export class WaterfallTerrainComparisonView {
  readonly group = new THREE.Group();
  readonly diagnostic = new THREE.Scene();
  readonly water = new THREE.Group();
  // Frozen native-grid and film experiments keep their original measured bed.
  // The ordinary user scene inspects only the real main-channel terrain/water.
  private readonly integrated = !new URLSearchParams(location.search).has('nativeGrid')
    && !new URLSearchParams(location.search).has('filmStudy')
    && new URLSearchParams(location.search).get('comparisonLayout')!=='legacy';
  private display: ComparisonDisplay = 'liquid';
  // Candidate only: retain the world-grid baseline until physical, rendered
  // and runtime comparisons qualify this different domain orientation.
  private readonly nativeConforming = new URLSearchParams(location.search).get('nativeGrid')==='conforming';
  private readonly nativeAligned = this.nativeConforming||new URLSearchParams(location.search).get('nativeGrid')==='aligned';
  private readonly nativeCourses = new Map<ComparisonId,RiverTerrainCourseView>();
  private selected: ComparisonId | undefined;
  private liquid: WaterfallContactView | null = null;
  private liquidId: ComparisonId | undefined;
  private readonly attachedFilm = new WaterfallAttachedFilmView();
  private filmMode: AttachedFilmMode = 'native';
  private studySnapshot: ContactSnapshot | null = null;
  private displayError: string | null = null;
  private worker: Worker | null = null;
  private busy = false;
  private latestRequestId = 0;
  private active = false;
  private pending: TerrainComparisonWorkerRequest[] = [];
  private pendingFocus: {id?: ComparisonId; setPose: (pose: RiverPose) => void} | null = null;
  private accepted: ComparisonSnapshot | null = null;
  private preparedSurface: ContactSurfacePacket | undefined;
  private preparedId: ComparisonId | undefined;
  private error: string | null = null;
  private startWall = 0;
  private lastNotify = 0;
  private lastStepRequest = 0;
  private raise = 0;
  private initialized = false;
  private viewportAspect = 1;
  private overviewPoseSink?: (pose: RiverPose) => void;
  private readonly crest = defaultRiverCourse().at(WATERFALL.crestS);
  private readonly markers: ComparisonState['markers'] = {};
  private readonly terrain = new Map<ComparisonId, THREE.Group>();
  private readonly points = new Map<ComparisonId, {mesh: THREE.InstancedMesh; positions: number[]}>();
  constructor(private groundAt: (x: number, z: number) => number, private notify: (state: ComparisonState) => void, private uniforms: RiverWaterUniforms, private landscapeMaterial: THREE.MeshStandardNodeMaterial, private canopy?: THREE.InstancedMesh, private existingWaterAt?: (x:number,z:number)=>number, private recordOperation?: (name: string, ms: number) => void, private hostGroundGeometry:()=>readonly THREE.BufferGeometry[]=()=>[]) {
    // Terrain is part of the live scene immediately. Building the neighboring
    // landforms does not start the optional comparison water worker.
    this.initializeTerrain();
    this.group.add(this.attachedFilm.mesh);
  }
  /** Explicit developer comparison only. The saved sample never enters the
   * worker. Restoring native without a sample restores the retained live view. */
  filmStudy(mode: AttachedFilmMode, sample?: ContactSnapshot) {
    if (!new URLSearchParams(window.location.search).has('filmStudy')) throw Error('Film study requires opt-in URL');
    if (!['native','coupled','zero','bare'].includes(mode)) throw Error('Unknown film study mode');
    if (this.busy || this.accepted?.reading.running) throw Error('Pause and wait for the worker before film study');
    if (sample && this.selected !== 'langfossen') throw Error('Saved film study currently supports Langfossen only');
    this.filmMode = mode; this.studySnapshot = sample ?? null;
    this.syncLiquid();
    const snapshot = this.studySnapshot ?? this.accepted?.snapshots.find(s=>s.id===this.selected)?.snapshot;
    return {mode,time:snapshot?.receipt.time,filmVolume:snapshot?.receipt.filmVolume,
      source:'Presentation only; live worker remains paused',limits:'Conformal nonabsorbing coating on declared rough dielectric rock; exposed film sides keep native liquid optics'};
  }
  private world(id: ComparisonId, p: ContactVec3): ContactVec3 {
    const across = 62 + ids.indexOf(id) * COURSE_SPACING;
    const forward = p[0];
    return [this.crest.x + forward * this.crest.tx + (across + p[2]) * this.crest.tz, p[1] + this.raise,
      this.crest.z + forward * this.crest.tz - (across + p[2]) * this.crest.tx];
  }
  state(): ComparisonState {
    const wallSeconds = this.startWall ? (performance.now() - this.startWall) / 1000 : 0;
    const receipt = this.water.visible && this.liquid?.water.visible ? this.liquid.receipt() : null;
    return { integrated: this.integrated, display: this.display, nativeAligned:this.nativeAligned, nativeConforming:this.nativeConforming, selected: this.selected ?? null, displayError: this.displayError,
      native: this.display==='native'&&this.selected?this.nativeCourses.get(this.selected)?.course.receipt():undefined,
      liquid: receipt ? { representedVolume: receipt.representedVolume, unresolvedVolume: receipt.unresolvedSurfaceVolume, surfaceVertices: receipt.surfaceVertices } : null,
      reading: this.accepted?.reading ?? null, wallSeconds, pace: wallSeconds > 0 ? (this.accepted?.reading.physicalTime ?? 0) / wallSeconds : 0,
      markers: structuredClone(this.markers), loading: this.active && !this.accepted, error: this.error };
  }
  open(on: boolean): void {
    if(this.integrated){this.active=on;this.group.traverse(o=>{if(o.userData.landscapeLabel)o.visible=on;});this.publish(true);return;}
    if (on === this.active && this.worker) return;
    this.active = on; this.water.visible = on;
    if(!on)for(const view of this.nativeCourses.values())view.setRunning(false);
    this.group.traverse(object => { if (object.userData.landscapeLabel) object.visible = on; });
    this.syncLiquid();
    if (on && !this.worker) {
      this.startWall = performance.now();
      this.worker = new Worker(new URL('../../../systems/world3d/river/waterfallTerrainComparisons.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = event => {
        const started = performance.now();
        const message: TerrainComparisonWorkerResponse = event.data;
        // A fast old batch can finish just before a newer control reaches the
        // worker. Its reply must not overwrite that control or clear its busy flag.
        if (message.requestId !== this.latestRequestId) return;
        this.busy = false;
        // Browsers may deserialize the worker snapshot when data is first read.
        // Keep that cost visible separately from installing already-built water.
        const decoded = performance.now();
        this.recordOperation?.('Waterfall reply: read worker message', decoded-started);
        // Decode only the running display transport. Controls and failures still
        // carry full snapshots, and every record is restored before installation.
        let next: ComparisonSnapshot;
        try {
          next = message.type === 'error' ? message.retainedSnapshot : { ...message,
            snapshots: message.snapshots.map(item => ({ ...item, snapshot: isPackedWaterfallPresentation(item.snapshot) ? unpackWaterfallPresentation(item.snapshot) : item.snapshot })) };
        } catch (error) {
          // Keep the last accepted water visible and stop requesting steps if
          // transport validation fails. A broken message is not a dry snapshot.
          this.error = error instanceof Error ? error.message : String(error);
          this.publish(true);
          return;
        }
        this.recordOperation?.('Waterfall reply: unpack parcels', performance.now()-decoded);
        if (next) {
          if (message.type === 'snapshot' && message.workerTimings) {
            const timing = message.workerTimings;
            this.recordOperation?.('worker: waterfall command before send (total)', timing.totalMs);
            this.recordOperation?.('worker: waterfall physics and snapshot', timing.executeMs);
            this.recordOperation?.('worker: waterfall surface and checks', timing.surfaceMs);
            this.recordOperation?.('worker: waterfall packing', timing.packMs);
          }
          const id=next.snapshots[0]?.id;
          if(id!==this.preparedId){this.preparedSurface=undefined;this.preparedId=id;}
          if(next.preparedSurface){this.preparedSurface=next.preparedSurface;this.recordOperation?.('worker: waterfall geometry',next.preparedSurface.constructionMs);}
          this.accepted = next; this.apply(next);
        }
        if (message.type === 'error') this.error = message.error;
        const applied = performance.now();
        this.recordOperation?.('Waterfall reply: install water', applied-decoded);
        this.publish(true);
        this.recordOperation?.('Waterfall reply: update controls', performance.now()-applied);
        this.recordOperation?.('Waterfall reply: geometry and display', performance.now()-started);
      };
      this.worker.onerror = event => { this.busy = false; this.error = event.message; this.publish(true); };
      this.pending.push({ type: 'reset' });
    } else if (this.worker && !on) this.pending.push({ type: 'running', running: false });
    this.publish(true);
  }
  source(on: boolean): void { if(this.display==='native'&&this.selected){this.nativeCourses.get(this.selected)?.course.setSource(on);this.publish(true);return;}this.pending.push({ type: 'source', sourceOn: on }); }
  pause(on: boolean): void { if(this.display==='native'&&this.selected){this.nativeCourses.get(this.selected)?.setRunning(!on);this.publish(true);return;}this.pending.push({ type: 'running', running: !on }); }
  reset(): void { this.error = null; this.startWall = performance.now(); if(this.display==='native'&&this.selected){this.nativeCourses.get(this.selected)?.dispose();this.nativeCourses.delete(this.selected);this.displayError=null;this.syncLiquid();this.publish(true);return;}this.pending.push({ type: 'reset' }); }
  tick(): void {
    if(this.integrated)return;
    if(this.active&&this.display==='native'){
      this.ensureNative();if(this.selected)this.nativeCourses.get(this.selected)?.tick();this.publish(false);return;
    }
    if (this.active && this.liquid?.water.visible) this.liquid.present();
    if (this.studySnapshot) return;
    if (!this.worker || (this.busy && this.pending.length === 0)) return;
    // Controls are allowed through while a physical batch is pending. The worker
    // yields between ticks and cancels that batch when this newer command arrives.
    const now = performance.now();
    const running = this.active && this.accepted?.reading.running && !this.accepted.reading.failure && !this.error && !this.displayError;
    if (!running) this.lastStepRequest = now;
    // Use elapsed wall time only to request unchanged 1/120 s solver ticks.
    // Cap each request and discard excess backlog when the solver is too slow.
    const ticks = Math.min(4, Math.floor((now - this.lastStepRequest) * 120 / 1000));
    const request: TerrainComparisonWorkerRequest | null = this.pending.shift() ?? (running && ticks > 0 ? { type: 'step', ticks } : null);
    if (request?.type === 'step') this.lastStepRequest = now;
    if (request) { this.busy = true; this.worker.postMessage({ ...request, requestId: ++this.latestRequestId }); }
    this.publish(false);
  }
  private publish(force: boolean): void {
    const now = performance.now();
    // React reads at most four times per second. Controls can publish immediately.
    if (force || now - this.lastNotify >= 250) { this.lastNotify = now; this.notify(this.state()); }
  }
  private initializeTerrain(): void {
    if (!this.initialized) {
      if(this.integrated){
        for(const feature of RAPIDS_WATERFALL_SEQUENCE)this.buildTerrain(feature.id,{surfaces:[]});
        this.initialized=true;return;
      }
      const next = { snapshots: TERRAIN_COMPARISON_CASES.map(profile => ({id:profile.id,snapshot:{surfaces:profile.buildSurfaces()}})) };
      // Check every terrain footprint, not just the source point. The same lift
      // keeps every comparison pool datum equal while clearing existing river terrain.
      let highest = -Infinity;
      for (const item of next.snapshots) {
        const vertices = item.snapshot.surfaces.flatMap(surface => surface.vertices);
        const x0 = Math.min(0, ...vertices.map(p=>p[0])), x1 = Math.max(1, ...vertices.map(p=>p[0]));
        const z0 = Math.min(-12, ...vertices.map(p=>p[2])), z1 = Math.max(12, ...vertices.map(p=>p[2]));
        for (let u = 0; u <= 64; u++) for (let v = 0; v <= 48; v++) {
          const p: ContactVec3 = [x0 + (x1-x0)*u/64, 0, z0 + (z1-z0)*v/48];
          const w = this.world(item.id, p); highest = Math.max(highest, this.groundAt(w[0], w[2]));
        }
      }
      this.raise = Math.max(0, highest + 2 - 18);
      for (const item of next.snapshots) this.buildTerrain(item.id, item.snapshot);
      this.initialized = true;
      if (this.pendingFocus) { this.pendingFocus.setPose(this.pose(this.pendingFocus.id)); this.pendingFocus = null; }
    }
  }
  private apply(next: ComparisonSnapshot): void {
    for (const { id, snapshot } of next.snapshots) {
      // Liquid mode needs only counts. Build diagnostic marker buffers when
      // requested, rather than rebuilding thousands of hidden quads each reply.
      if (this.display !== 'markers' && !this.displayError) {
        this.markers[id]={parcels:snapshot.parcels.filter(p=>p.volume>0).length,filmCells:snapshot.film?.cells.filter(c=>c.volume>0).length??0};
        const old=this.points.get(id); if(old) old.mesh.visible=false;
        continue;
      }
      const positions: number[] = [], colors: number[] = [];
      const color = new THREE.Color();
      let parcels = 0, filmCells = 0;
      for (const parcel of snapshot.parcels) if (parcel.volume > 0) { positions.push(...this.world(id, parcel.position)); colors.push(.1, .9, 1); parcels++; }
      for (const cell of snapshot.film?.cells ?? []) if (cell.volume > 0) {
        positions.push(...this.world(id, cell.center));
        color.setHSL(.55 - Math.min(1, Math.log1p(cell.height * 100)) * .13, 1, .6); colors.push(color.r, color.g, color.b); filmCells++;
      }
      this.markers[id] = { parcels, filmCells };
      let points = this.points.get(id);
      const count = positions.length / 3;
      // WebGPU point primitives are one pixel: Three's PointsNodeMaterial
      // ignores point size. Camera-facing symbolic quads retain a visible fixed
      // pixel marker without changing any water position or physical volume.
      if (!points || points.mesh.instanceMatrix.count < count) {
        if (points) { points.mesh.removeFromParent(); points.mesh.geometry.dispose(); (points.mesh.material as THREE.Material).dispose(); points.mesh.dispose(); }
        const material = new THREE.MeshBasicNodeMaterial({ fog: false, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
        // r172 chooses a uniform matrix buffer from mesh.count at shader build.
        // Growing live counts with larger reserved capacity can exceed that path's
        // 64 KB limit. Keep a fixed draw capacity above its 1000-instance cutoff
        // so all batches use vertex attributes; unused slots have zero scale.
        const capacity = Math.max(1024, count * 2);
        const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1), material, capacity); mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
        mesh.instanceMatrix.array.fill(0);
        for (let k=0;k<capacity;k++) mesh.instanceMatrix.array[k*16+15] = 1;
        points = {mesh,positions}; this.points.set(id,points); this.diagnostic.add(mesh);
      }
      // Clear slots when source-off, reset or arrivals shrink the retained set.
      // The homogeneous one keeps zero-scale instances valid but invisible.
      for (let k=count;k<points.positions.length/3;k++) {
        points.mesh.instanceMatrix.array.fill(0,k*16,k*16+16);
        points.mesh.instanceMatrix.array[k*16+15] = 1;
      }
      points.positions = positions; points.mesh.visible = count > 0;
      for (let k=0;k<count;k++) { color.setRGB(colors[k*3],colors[k*3+1],colors[k*3+2]); points.mesh.setColorAt(k,color); }
      if (points.mesh.instanceColor) points.mesh.instanceColor.needsUpdate = true;
    }
    this.syncLiquid();
  }
  setDisplay(display: ComparisonDisplay): void {
    if(this.integrated)return;
    for(const view of this.nativeCourses.values()){view.setRunning(false);view.group.visible=false;}
    if(display==='native')this.pending.push({type:'running',running:false});
    this.display = display; this.displayError = null;
    if (this.accepted) this.apply(this.accepted); else this.syncLiquid();
    this.publish(true);
  }
  private syncLiquid(): void {
    if(this.integrated)return;
    for(const [id,view] of this.nativeCourses)view.group.visible=this.active&&this.display==='native'&&id===this.selected;
    if(this.display==='native'){
      this.liquid?.setVisible(false);this.attachedFilm.mesh.visible=false;
      for(const entry of this.points.values())entry.mesh.visible=false;
      this.ensureNative();return;
    }
    const snapshot = this.studySnapshot ?? this.accepted?.snapshots.find(item => item.id === this.selected)?.snapshot;
    const show = this.active && this.display === 'liquid' && !!snapshot && !this.displayError;
    this.liquid?.setVisible(false);
    this.attachedFilm.mesh.visible = false;
    if (show && snapshot && this.selected) {
      try {
        // Reuse one native liquid view, not seven large geometry allocations.
        // Its finite sheets and stored film retain their calculated volumes.
        // Later-contact parcels remain coarse samples, not resolved breakup.
        if (!this.liquid) {
          this.liquid = new WaterfallContactView(this.crest, this.uniforms);
          this.liquid.setRepresentation('local');
          this.liquid.setUnresolvedThicknessPolicy('report');
          this.water.add(this.liquid.water);
        }
        if (this.liquidId !== this.selected) {
          // Different courses can have the same clock. Clear interpolation and
          // geometry first so a paused selection cannot keep the previous water.
          this.liquid.clearSnapshot();
          const origin = this.world(this.selected, [0, 0, 0]);
          this.liquid.water.matrix.setPosition(...origin);
          this.liquid.water.matrixWorldNeedsUpdate = true;
          this.liquidId = this.selected;
        }
        this.liquid.setAttachedFilmStudy(this.filmMode);
        // The accepted worker packet matches this exact physical clock. Retain it
        // through pause/source controls; study fixtures keep the original path.
        const prepared=!this.studySnapshot && this.preparedId===this.selected && this.preparedSurface?.time===snapshot.receipt.time ? this.preparedSurface : undefined;
        this.liquid.update(snapshot,prepared); this.liquid.setVisible(true);
        // Paused/control replies carry the complete optical-study input. Running
        // native water needs only its prepared surface and display coordinates.
        if (!isWaterfallPresentation(snapshot)) this.attachedFilm.update(snapshot, this.filmMode, p=>this.world(this.selected!,p));
        else if (this.filmMode !== 'native') throw Error('Pause for complete optical study snapshot');
      } catch (error) {
        this.displayError = error instanceof Error ? error.message : String(error);
        this.liquid?.setVisible(false);
        // Keep the failed inspection state available instead of allowing unseen
        // water to advance after its presentation has failed. Reset stays explicit.
        this.pending.push({ type: 'running', running: false });
      }
    }
    // Markers expose the retained records when liquid cannot be drawn. They are
    // explicitly diagnostic symbols; the worker pauses without discarding water.
    for (const [id, points] of this.points) points.mesh.visible = (this.display === 'markers' || !!this.displayError && id === this.selected) && points.positions.length > 0;
  }
  private ensureNative():void {
    if(!this.active||!this.initialized||!this.selected||this.display!=='native'||this.displayError||this.nativeCourses.has(this.selected))return;
    try{
      const id=this.selected;
      // Read the actual drawn triangles from all neighboring landforms. Their
      // shared mountain shoulders can cross this course's world-aligned grid.
      const geometries:THREE.BufferGeometry[]=[...this.hostGroundGeometry()];
      for(const group of this.terrain.values())for(const object of group.children){const mesh=object as THREE.Mesh;if(mesh.isMesh&&mesh.name.startsWith('valley-waterfall-landscape-'))geometries.push(mesh.geometry);}
      const corners=[[-12,-20],[-12,20],[90,-20],[90,20]].map(([x,z])=>this.world(id,[x,0,z]));
      const dx=.5,x0=Math.floor(Math.min(...corners.map(p=>p[0]))/dx)*dx,z0=Math.floor(Math.min(...corners.map(p=>p[2]))/dx)*dx;
      const grid:{x0:number;z0:number;dx:number;nx:number;nz:number;xEdges?:number[]}={x0,z0,dx,nx:Math.ceil((Math.max(...corners.map(p=>p[0]))-x0)/dx),nz:Math.ceil((Math.max(...corners.map(p=>p[2]))-z0)/dx)};
      const origin=this.world(id,[0,0,0]);
      const frame=this.nativeAligned?createRiverTerrainFrame([origin[0],origin[2]],[this.crest.tx,this.crest.tz]):undefined;
      // Same cell count, cell size and area as the baseline. The rectangle
      // turns around the course center, so its outer footprint DOES change.
      // This is not a downstream/outlet parity claim or a cut-cell lip solver.
      if(frame){grid.x0=39-grid.nx*dx/2;grid.z0=-grid.nz*dx/2;}
      // Include the actual native valley under/beside the added mountain.
      // The first course's rotated grid has a corner beyond its mountain tile;
      // leaving out the host ground produced a legitimate uncovered-bed stop.
      // Expand indexed triangles and retain only those intersecting this grid.
      const values:number[]=[],x1=grid.x0+grid.nx*dx,z1=grid.z0+grid.nz*dx;
      for(const geometry of geometries){const p=geometry.getAttribute('position'),index=geometry.getIndex(),count=index?.count??p.count;
        for(let k=0;k<count;k+=3){const ids=[0,1,2].map(v=>index?index.getX(k+v):k+v),points=ids.map(v=>{const q:[number,number,number]=[p.getX(v),p.getY(v),p.getZ(v)];return frame?terrainPointToLocal(frame,q):q;}),xs=points.map(q=>q[0]),zs=points.map(q=>q[2]);
          if(Math.max(...xs)<grid.x0||Math.min(...xs)>x1||Math.max(...zs)<grid.z0||Math.min(...zs)>z1)continue;
          for(const q of points)values.push(...q);
        }
      }
      if(this.nativeConforming){
        // Fit actual drawn straight cliff planes, not guessed release points.
        // The solver transports through the whole physical cell before the
        // shared face transfers ownership. Unsupported close cuts reject.
        const targets:number[]=[];
        for(let k=0;k<values.length;k+=9){const xs=[values[k],values[k+3],values[k+6]],ys=[values[k+1],values[k+4],values[k+7]];
          if(Math.max(...xs)-Math.min(...xs)<1e-4&&Math.max(...ys)-Math.min(...ys)>.35)targets.push(Math.max(...xs));}
        grid.xEdges=fitRiverXEdges(grid,targets);
      }
      const profile=TERRAIN_COMPARISON_CASES.find(p=>p.id===id)!;
      const sourceCells=new Set<number>();
      for(const span of profile.streamSpans??[{z0:-5,z1:5}])for(let z=span.z0+dx/8;z<span.z1;z+=dx/4){const world=this.world(id,[-6,0,z]),p=frame?terrainPointToLocal(frame,world):world,i=riverIndexX(grid,p[0]),j=Math.floor((p[2]-grid.z0)/dx);sourceCells.add(j*grid.nx+i);}
      const course=new RiverTerrainCourse(Float32Array.from(values),grid,[...sourceCells],frame?[1,0]:[this.crest.tx,this.crest.tz],undefined,undefined,!!frame);
      const view=new RiverTerrainCourseView(course,this.uniforms,frame);this.nativeCourses.set(id,view);this.water.add(view.group);
    }catch(error){this.displayError=String(error);}
  }
  private buildTerrain(id: ComparisonId, snapshot: Pick<ContactSnapshot, 'surfaces'>): void {
    const group = new THREE.Group(); this.group.add(group); this.terrain.set(id, group);
    const entry = TERRAIN_COMPARISON_CASES.find(item => item.id === id)!;
    if(!this.integrated)group.add(buildWaterfallComparisonLandscape(entry, p => this.world(id,p), this.groundAt, this.landscapeMaterial, ids.indexOf(id), ids.length, this.canopy, this.existingWaterAt));
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 176;
    const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, 768, 176);
    ctx.textAlign = 'center'; ctx.fillStyle = '#d8bc91'; ctx.font = '24px sans-serif'; ctx.fillText(`WATERFALL LANDSCAPE ${ids.indexOf(id)+1} / ${ids.length}`, 384, 38);
    ctx.fillStyle = '#fff4da'; ctx.font = 'bold 42px sans-serif'; ctx.fillText(entry.label, 384, 94, 730);
    ctx.fillStyle = '#e2d7c8'; ctx.font = '26px sans-serif'; ctx.fillText(`Norway reference ${entry.clipAt} · terrain model`, 384, 140);
    const texture = new THREE.CanvasTexture(canvas); const label = new THREE.Sprite(new THREE.SpriteNodeMaterial({ map: texture, transparent: true, fog: false, depthTest: false })); if(this.integrated){
      const full=riverReconstructionEnabled()?RECONSTRUCTION_FALLS.find(f=>f.id===id):undefined;
      const feature=RAPIDS_WATERFALL_SEQUENCE.find(f=>f.id===id)!,p=mainRapidsAt(MAIN_CHANNEL_S+(full?full.startM+full.runM/2:feature.start+feature.length/2));
      label.position.set(p.x,this.groundAt(p.x,p.z)+4,p.z);label.scale.set(12,2.75,1);
    }else{label.position.set(...this.world(id, [0, 85, 0])); label.scale.set(24, 5.5, 1);} label.visible = this.active; label.userData.landscapeLabel = true; group.add(label);
  }
  pose(id?: ComparisonId): RiverPose {
    if(this.integrated){
      if(riverReconstructionEnabled()){
        const f=RECONSTRUCTION_FALLS.find(item=>item.id===id);
        if(!f)return {pos:[900,1000,1700],look:[900,-650,-30],fov:65};
        // Fit the actual crest and toe in physical world coordinates. The
        // old24m eye could not show a250m face or700m sloping cascade.
        const points:Array<[number,number,number]>=[];
        for(const t of [0,.25,.5,.75,1])for(const n of [-f.halfWidthM,0,f.halfWidthM]){
          const p=reconstructedRapidsAt(f.startM+t*f.runM),x=p.x+p.tz*n,z=p.z-p.tx*n;
          points.push([x,this.groundAt(x,z),z]);
        }
        const p=reconstructedRapidsAt(f.startM+f.runM/2);
        // The Sisters reference is seen from below. The previous elevated eye
        // looked down its broad face and hid the steep rock structure. Other
        // references keep their existing inspection direction.
        return fitWaterfallCamera(points,[p.tx,p.tz],this.viewportAspect,id==='seven-sisters'?-.4:.48);
      }
      const feature=RAPIDS_WATERFALL_SEQUENCE.find(f=>f.id===id);
      const p=mainRapidsAt(MAIN_CHANNEL_S+(feature?feature.start+feature.length/2:190));
      const y=this.groundAt(p.x,p.z);
      // The neighboring valley flank can stand well above the carved bed.
      // Place the eye above actual land at the eye, rather than inside it.
      // Look back up the channel from its clear bed. A near-vertical eye
      // flattened the small shelves into texture; a flank eye hid them in trees.
      // Fit the newly deep gorge rather than reusing the miniature's eye.
      // Looking from beyond its toe exposes the unequal ledges together.
      const distance=feature?.id==='storfossen'?feature.length*.9:24;
      const ex=p.x+distance*p.tx+4*p.tz,ez=p.z+distance*p.tz-4*p.tx;
      const eye=Math.max(y+(feature?.id==='storfossen'?26:10),this.groundAt(ex,ez)+7);
      // The far-flank overview hid the carved course behind its own forest.
      // Look down over the connected valley, retaining the source and old
      // offshoot. Widen the vertical field in narrow panes to keep both ends.
      const overviewFov=Math.min(100,THREE.MathUtils.radToDeg(2*Math.atan(
        Math.tan(THREE.MathUtils.degToRad(22))*Math.max(1,2.7/this.viewportAspect))));
      return feature?{pos:[ex,eye,ez],look:[p.x,y+1,p.z],fov:48}
        :{pos:[50,340,105],look:[50,10,25],fov:overviewFov};
    }
    if (!id) {
      // Fit the real landforms, including their signs and ground skirts. A
      // fixed camera clipped the last course, especially in narrower panes.
      // Include the original crest in the same frame; no water state changes.
      const bounds = new THREE.Box3();
      for (const course of ids) for (const x of [-24, 85]) for (const y of [14, 90]) for (const z of [-26, 26]) bounds.expandByPoint(new THREE.Vector3(...this.world(course, [x,y,z])));
      bounds.expandByPoint(new THREE.Vector3(this.crest.x, WATERFALL.crestBed, this.crest.z));
      bounds.expandByPoint(new THREE.Vector3(this.crest.x, WATERFALL.poolLevel, this.crest.z));
      const center = bounds.getCenter(new THREE.Vector3());
      const verticalHalfAngle = THREE.MathUtils.degToRad(31);
      const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * this.viewportAspect);
      const direction = new THREE.Vector3(this.crest.tx, .45, this.crest.tz).normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right);
      // Fit each box corner in camera space rather than a bounding sphere:
      // the long row should fill the pane without excessive empty sky.
      let distance = 1;
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new THREE.Vector3(x, y, z).sub(center);
        const towardCamera = offset.dot(direction);
        distance = Math.max(distance, towardCamera + Math.abs(offset.dot(right)) * 1.15 / Math.tan(horizontalHalfAngle),
          towardCamera + Math.abs(offset.dot(up)) * 1.15 / Math.tan(verticalHalfAngle));
      }
      const position = center.clone().addScaledVector(direction, distance);
      return { pos: position.toArray() as ContactVec3, look: center.toArray() as ContactVec3, fov: 62 };
    }
    const selected = id ?? ids[Math.floor(ids.length / 2)];
    const surfaces = TERRAIN_COMPARISON_CASES.find(item => item.id === selected)?.buildSurfaces() ?? [];
    const end = Math.max(30, ...surfaces.flatMap(surface => surface.vertices.map(point => point[0])));
    const center = end * .5;
    // Frame the full seven-course row; selecting a name moves in to its actual
    // footprint, including the longer gorge and horsetail slopes.
    return { pos: this.world(selected, id ? [center + 130, 110, -45] : [250, 140, -12]),
      look: this.world(selected, [center, id ? 62 : 45, id ? 0 : -32]), fov: 62 };
  }
  focus(id: ComparisonId | undefined, setPose: (pose: RiverPose) => void): void {
    if(this.integrated){this.selected=id;this.overviewPoseSink=setPose;this.publish(true);setPose(this.pose(id));return;}
    if (this.selected !== id) {
      for(const view of this.nativeCourses.values())view.setRunning(false);
      this.studySnapshot = null; this.filmMode = 'native';
      this.selected = id; this.displayError = null; this.error = null;
      this.pending.push(id ? {type:'select',id} : {type:'running',running:false});
    }
    this.syncLiquid(); this.publish(true);
    // Terrain establishes its ground clearance before the worker starts, so
    // the land is inspectable even while the existing water is paused.
    if (this.initialized) setPose(this.pose(id)); else this.pendingFocus = {id,setPose};
  }
  focusWater(setPose: (pose: RiverPose) => void): void {
    if(this.integrated){setPose(this.pose(this.selected));return;}
    if (!this.selected) return;
    if(this.display==='native'){
      const view=this.nativeCourses.get(this.selected),course=view?.course;if(!course)return;
      const s=course.solver,g=s.grid,points:THREE.Vector3[]=[];
      const point=(p:[number,number,number])=>new THREE.Vector3(...(view?.frame?terrainPointToWorld(view.frame,p):p));
      // Camera framing only: all positive water stays in physics and drawing.
      for(let c=0;c<s.h.length;c++)if(s.h[c]>.001)points.push(point([riverCellX(g,c%g.nx),s.bed[c]+s.h[c],g.z0+(Math.floor(c/g.nx)+.5)*g.dx]));
      for(const p of course.spill.snapshot().packets)points.push(point(p.position));
      if(!points.length){setPose(this.pose(this.selected));return;}
      const bounds=new THREE.Box3().setFromPoints(points),center=bounds.getCenter(new THREE.Vector3()),radius=Math.max(3,bounds.getSize(new THREE.Vector3()).length()*.5),distance=radius/Math.sin(THREE.MathUtils.degToRad(22))*1.15;
      // Look uphill from the downstream side. A mostly across-valley view
      // landed inside the neighboring mountain and hid the inspected water.
      const side=ids.indexOf(this.selected)===0?-1:1;
      setPose({pos:[center.x+distance*(this.crest.tx*.85+this.crest.tz*side*.35),center.y+distance*.55,center.z+distance*(this.crest.tz*.85-this.crest.tx*side*.35)],look:center.toArray() as [number,number,number],fov:44});return;
    }
    const snapshot = this.studySnapshot ?? this.accepted?.snapshots.find(item => item.id === this.selected)?.snapshot;
    if (!snapshot) return;
    // Numerical tails can reach the basin while almost all water is still at
    // the crest. Frame records containing 99% of owned volume for this close-up.
    // This affects only the camera: every water record stays in the simulation
    // and draw. The named course buttons still show the entire terrain.
    const records = snapshot.parcels.filter(p => p.volume > 0).map(p => ({position:p.position,volume:p.volume}));
    for (const cell of snapshot.film?.cells ?? []) if (cell.volume > 0) records.push({position:cell.center,volume:cell.volume});
    records.sort((a,b)=>b.volume-a.volume);
    const target = records.reduce((sum,p)=>sum+p.volume,0)*.99;
    const positions: ContactVec3[] = []; let framedVolume=0;
    for (const record of records) { positions.push(record.position); framedVolume+=record.volume; if(framedVolume>=target)break; }
    if (!positions.length) { setPose(this.pose(this.selected)); return; }
    const bounds = new THREE.Box3().setFromPoints(positions.map(p => new THREE.Vector3(...p)));
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(5, size.length() * .5);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(22)) * 1.15;
    setPose({pos:this.world(this.selected,[center.x + distance*.92,center.y + distance*.12,center.z - distance*.38]),
      look:this.world(this.selected,[center.x,center.y,center.z]),fov:44});
  }
  draw(renderer: THREE.WebGPURenderer, camera: THREE.Camera): void {
    const perspective = camera as THREE.PerspectiveCamera;
    const previousAspect=this.viewportAspect;
    if (Number.isFinite(perspective.aspect) && perspective.aspect > 0) this.viewportAspect = perspective.aspect;
    if (!this.active) return;
    if(this.integrated){
      // Refit a complete reference extent when the pane changes shape.
      // Original staged close views keep their chosen eye. No water restarts.
      if((!this.selected||riverReconstructionEnabled())&&Math.abs(previousAspect-this.viewportAspect)>1e-5)this.overviewPoseSink?.(this.pose(this.selected));
      return;
    }
    const size = renderer.getSize(new THREE.Vector2());
    const position = new THREE.Vector3(), viewPosition = new THREE.Vector3(), scale = new THREE.Vector3(), matrix = new THREE.Matrix4();
    for (const {mesh,positions} of this.points.values()) {
      if (!mesh.visible) continue;
      for (let k=0;k<positions.length/3;k++) {
        position.fromArray(positions,k*3); viewPosition.copy(position).applyMatrix4(camera.matrixWorldInverse);
        const pixelWidth = 2*Math.max(.001,-viewPosition.z)*Math.tan(THREE.MathUtils.degToRad(perspective.fov)/2)/Math.max(1,size.y);
        scale.setScalar(pixelWidth*5); matrix.compose(position,camera.quaternion,scale); mesh.setMatrixAt(k,matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    const autoClear = renderer.autoClear; renderer.autoClear = false;
    renderer.render(this.diagnostic, camera); renderer.autoClear = autoClear;
  }
  dispose(): void {
    for(const view of this.nativeCourses.values())view.dispose();this.nativeCourses.clear();
    this.worker?.terminate(); this.worker = null;
    this.attachedFilm.dispose();
    this.liquid?.dispose(); this.liquid = null; this.water.removeFromParent(); this.water.clear();
    for (const root of [this.group, this.diagnostic]) root.traverse(object => {
      const mesh = object as THREE.Mesh; mesh.geometry?.dispose();
      if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose();
      const material = (object as THREE.Sprite).material;
      for (const entry of Array.isArray(material) ? material : material ? [material] : []) { (entry as THREE.SpriteNodeMaterial).map?.dispose(); entry.dispose(); }
    });
    this.group.removeFromParent(); this.group.clear(); this.diagnostic.clear();
  }
}
