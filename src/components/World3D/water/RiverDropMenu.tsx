/** The river's interactive drop menu and inspection controls. Ratings describe
 * this simulation; each choice shows its draft and response to the current. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/10/2026, 01:34:06
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useState } from 'react';
import type { RiverHeatmapReading } from './riverPerformanceHeatmap';
import type { FreeLookOptions, FreeLookReading } from '@/components/DesignPreview/steps/sidebyside/oceanFreeLook';
type CameraMovementReading = FreeLookReading & { floorY: number | null; atFloor: boolean };
import { RIVER_DROP_PROFILES, type RiverDropKind } from '@/systems/world3d/river/riverDroppedObjects';
import { BTN_BASE, BTN_PRIMARY, BTN_SECONDARY } from '@/styles/buttonStyles';

export type RiverDropPlace = 'plunge-pool' | 'rapids' | 'island-pool';
export interface RiverDropMenuProps {
  cameraMovement: FreeLookOptions;
  onCameraMovementChange: (options: FreeLookOptions) => void;
  cameraMovementReading: () => CameraMovementReading | null;
  onDrop: (kind: RiverDropKind, place: RiverDropPlace) => number;
  onArm: (kind: RiverDropKind | null) => void;
  onClear: () => void; onWatch: () => void; count: () => number;
  onInspect: (ground: boolean, water: boolean, blockers: boolean) => void;
  treesVisible: boolean;
  onTreesVisibleChange: (on: boolean) => void;
  performanceHeatmap: boolean;
  onPerformanceHeatmapChange: (on:boolean)=>void;
  heatmapReading: ()=>RiverHeatmapReading | null;
  onRefreshHeatmap: ()=>void;
  waterOutlines: boolean;
  onWaterOutlinesChange: (enabled: boolean) => void;
  objects: () => Array<{ id: number; label: string }>;
  onFollow: (id: number | 'paper' | null) => void;
  following: number | 'paper' | null;
}
export const RiverDropMenu: React.FC<RiverDropMenuProps> = (props) => {
  const [kind, setKind] = useState<RiverDropKind>('rubber-duck');
  const [place, setPlace] = useState<RiverDropPlace>('plunge-pool');
  const [open, setOpen] = useState(true); const [armed, setArmed] = useState(false);
  const [count, setCount] = useState(0); const [message, setMessage] = useState('');
  const [ground, setGround] = useState(false); const [water, setWater] = useState(false); const [blockers, setBlockers] = useState(false);
  const [objects, setObjects] = useState<Array<{ id: number; label: string }>>([]);
  const [heatmap,setHeatmap]=useState<RiverHeatmapReading | null>(null);
  const [cameraReading, setCameraReading] = useState<CameraMovementReading | null>(null);
  useEffect(() => { const id = window.setInterval(() => setCameraReading(props.cameraMovementReading()), 250); return () => window.clearInterval(id); }, [props.cameraMovementReading]);
  const target = props.following === null ? '' : String(props.following);
  useEffect(() => { const id = window.setInterval(() => { setCount(props.count()); setObjects(props.objects()); setHeatmap(props.heatmapReading()); }, 500); return () => window.clearInterval(id); }, [props.count, props.objects, props.heatmapReading]);
  useEffect(() => {
    if (target && target !== 'paper' && !objects.some((o) => String(o.id) === target)) props.onFollow(null);
  }, [objects, target, props.onFollow]);
  useEffect(() => { props.onInspect(ground, water, blockers); }, [ground, water, blockers, props.onInspect]);
  const p = RIVER_DROP_PROFILES[kind];
  // Shared secondary button style. The panel keeps its compact padding and 12 px text.
  const button = `${BTN_BASE} ${BTN_SECONDARY} px-2 py-1 text-[12px]`;
  return <div className="absolute left-3 top-24 w-[285px] max-w-[calc(100%-1.5rem)] max-h-[calc(100%-10rem)] max-[600px]:fixed max-[600px]:z-50 max-[600px]:bottom-3 max-[600px]:top-auto max-[600px]:max-h-[65vh] overflow-y-auto rounded-md bg-slate-950/85 p-3 text-[12px] text-slate-100 shadow-lg">
    <div className="flex items-center justify-between"><strong>River controls</strong><button className={button} onClick={() => setOpen(!open)}>{open ? 'Collapse' : 'Expand'}</button></div>
    {open && <>
        <fieldset className="mt-2 space-y-2 rounded border border-slate-600 p-2">
          <legend className="px-1 font-semibold">Allowed camera movement</legend>
          <label className="flex gap-2"><input type="checkbox" checked={props.cameraMovement.heightSpeed} onChange={e => props.onCameraMovementChange({ ...props.cameraMovement, heightSpeed: e.target.checked })} />Scale speed with height</label>
          <label className="flex items-center justify-between gap-2">Fixed speed (m/s)<input aria-label="Fixed camera speed" type="number" min="0.1" max="5000" step="1" className="w-20 rounded border border-slate-500 bg-slate-900 p-1 disabled:opacity-50" disabled={props.cameraMovement.heightSpeed} value={props.cameraMovement.fixedSpeedMps} onChange={e => { const speed = e.target.valueAsNumber; if (Number.isFinite(speed) && speed >= 0.1 && speed <= 5000) props.onCameraMovementChange({ ...props.cameraMovement, fixedSpeedMps: speed }); }} /></label>
          <label className="flex gap-2"><input type="checkbox" checked={props.cameraMovement.limitFrameStep} onChange={e => props.onCameraMovementChange({ ...props.cameraMovement, limitFrameStep: e.target.checked })} />Cap keyboard travel on slow frames</label>
          <div className="space-y-1 text-[11px] text-sky-200" aria-label="Camera movement readout">
            <p>Current speed: {cameraReading ? cameraReading.speedMps.toFixed(1) + ' m/s' : 'waiting'} · Shift ×4</p>
            <p>Keyboard time used: {cameraReading ? Math.round(cameraReading.frameTimeScale * 100) + '%' : 'waiting'}{cameraReading && cameraReading.frameTimeScale < 0.99 ? ' — frame cap is slowing travel' : ''}</p>
            <p>{cameraReading ? cameraReading.floorY === null ? 'Height limits off' : 'Allowed height: Y ≥ ' + cameraReading.floorY.toFixed(2) + ' m' + (cameraReading.atFloor ? ' · at floor limit' : '') : 'Reading height limits…'}</p>
          </div>
          <p className="text-[10px] text-slate-400">Height scaling uses absolute world Y, not distance to the object. Switch it off for constant pan, wheel and flight speed. The frame cap limits keyboard travel to 100 ms per frame.</p>
        <label className="mt-2 flex gap-2"><input type="checkbox" checked={ground} onChange={(e) => setGround(e.target.checked)} />Allow below ground</label>
        <label className="mt-1 flex gap-2"><input type="checkbox" checked={water} onChange={(e) => setWater(e.target.checked)} />Allow below water</label>
        </fieldset>
      <label className="mt-2 block">Object<select aria-label="River object" value={kind} onChange={(e) => { setKind(e.target.value as RiverDropKind); setArmed(false); props.onArm(null); }} className="mt-1 w-full rounded border border-slate-500 bg-slate-900 p-1.5">
        {(Object.keys(RIVER_DROP_PROFILES) as RiverDropKind[]).map((k) => <option key={k} value={k}>{RIVER_DROP_PROFILES[k].label}</option>)}
      </select></label>
      <p className="mt-2 text-sky-200">{p.flotation}% flotation · {(p.draft * 100).toFixed(p.draft < 0.01 ? 1 : 0)} cm draft</p>
      <p className="mt-1 text-slate-300">{p.description}</p>
      <p className="mt-1 text-[10px] text-slate-400">Flotation = modeled proportion above water.</p>
      <label className="mt-2 block">Drop location<select aria-label="Drop location" value={place} onChange={(e) => setPlace(e.target.value as RiverDropPlace)} className="mt-1 w-full rounded border border-slate-500 bg-slate-900 p-1.5">
        <option value="plunge-pool">Waterfall plunge pool</option><option value="rapids">Rapids at the split</option><option value="island-pool">Original river pool</option>
      </select></label>
      <div className="mt-2 flex gap-2"><button className={`${BTN_BASE} ${BTN_PRIMARY} flex-1 px-2 py-1 text-[12px]`} onClick={() => {
        const n = props.onDrop(kind, place); setMessage(n ? `Dropped ${n} ${n === 1 ? 'object' : 'individual objects'}.` : 'No suitable wet spot here, or the 320-object limit is reached.');
      }}>Drop object</button><button className={button} onClick={() => { setArmed(!armed); props.onArm(armed ? null : kind); }}>{armed ? 'Cancel placement' : 'Click to place'}</button></div>
      {armed && <p className="mt-2 text-amber-200">Click visible river water to drop this object. Placement stays on until canceled.</p>}
      <div className="mt-2 flex gap-2"><button className={button} onClick={props.onWatch}>Watch objects</button><button className={button} onClick={() => { props.onClear(); setMessage('Dropped objects cleared.'); }}>Clear objects</button></div>
      <p className="mt-2" aria-live="polite">{count} objects in the river{message && ` · ${message}`}</p>
      <label className="mt-2 block">Select object to follow<select aria-label="Select object to follow" value={target} onChange={(e) => {
        props.onFollow(e.target.value === 'paper' ? 'paper' : e.target.value ? Number(e.target.value) : null);
      }} className="mt-1 w-full rounded border border-slate-500 bg-slate-900 p-1.5">
        <option value="">Free camera</option><option value="paper">Paper boat</option>
        {objects.map((o) => <option key={o.id} value={o.id}>{o.label} #{o.id}</option>)}
      </select></label>
      {target && <p className="mt-1 text-sky-200">Camera following the selected object. Drag to orbit; wheel to zoom.</p>}
      <div className="mt-3 border-t border-slate-600 pt-2">
        <strong>Camera and flow inspection</strong>

        <label className="mt-2 flex gap-2"><input type="checkbox" checked={props.treesVisible} onChange={(e) => props.onTreesVisibleChange(e.target.checked)} />Show trees</label>
        <label className="mt-1 flex gap-2"><input type="checkbox" checked={blockers} onChange={(e) => setBlockers(e.target.checked)} />Show flow obstacles</label>
        <label className="mt-1 flex gap-2"><input type="checkbox" checked={props.waterOutlines} onChange={(e) => props.onWaterOutlinesChange(e.target.checked)} />Water-body outlines</label>
        <label className="mt-2 flex gap-2"><input type="checkbox" checked={props.performanceHeatmap} onChange={(e)=>props.onPerformanceHeatmapChange(e.target.checked)} />Performance heatmap</label>
        {props.performanceHeatmap && <div className="mt-2 space-y-2 text-[11px] text-slate-300" aria-live="polite">
          <div className="flex items-center gap-2"><span>Lower cost</span><span aria-hidden="true" className="h-3 flex-1 rounded" style={{background:'linear-gradient(to right, transparent, rgba(255,0,0,.75))'}} /><span>Higher cost</span></div>
          <p>Red = GPU drawing time saved when that draw group is omitted. Colors are relative to this view. Clear areas may be unmeasured or uncertain.</p>
          <p>{!heatmap || heatmap.state==='waiting' ? 'Hold the camera still to scan.' : heatmap.state==='scanning' ? 'Measuring '+heatmap.completed+' / '+heatmap.total+' groups. Scanning temporarily adds load.' : heatmap.state==='ready' ? 'Scan complete. Move the camera or refresh after editing.' : heatmap.message}</p>
          {heatmap?.groups.filter(g=>g.savedMs!==null).sort((a,b)=>(b.savedMs??0)-(a.savedMs??0)).slice(0,4).map(g=><p key={g.id} className="text-red-200">{g.label}: {g.savedMs!.toFixed(2)} ms</p>)}
          <p>Shared draws tint their whole visible footprint. CPU work and the water simulation are unmeasured here; this is not an exact FPS-loss map.</p>
          <button type="button" className={button} onClick={props.onRefreshHeatmap}>Refresh measurement</button>
        </div>}
        {props.waterOutlines && <p className="mt-2 text-slate-300">Traces visible surface-water borders, including separate puddles, as water spreads or drains. Airborne falls and spray are excluded.</p>}
        {blockers && <p className="mt-2 text-slate-300">Red: bed above reference water. Amber: dry or shallow bed. Cyan: wet bed. Magenta outlines: solver rock barriers. Shown through water and terrain.</p>}
      </div>
    </>}
  </div>;
};
