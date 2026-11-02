/** Offers camera access and honest controls for the signed river study area.
 * Frozen evidence has state controls, while an eligible selected shallow-water
 * pool has a source gate. The labels never turn local evidence into acceptance.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 11:20:35
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import {RIVER_EXPERIMENTS} from '@/systems/world3d/river/riverExperimentCatalog';
import type {ExperimentStationReading} from './riverExperimentStations';
import {BTN_BASE,BTN_SECONDARY} from '@/styles/buttonStyles';
export function RiverExperimentPanel(props:{reading:ExperimentStationReading;onSelect:(id:string|null)=>void;onArea:()=>void;onFocus:()=>void;onState:(state:string)=>void;onSource:(on:boolean)=>void;onRunning:(on:boolean)=>void;onClose:()=>void}){
  const study=RIVER_EXPERIMENTS.find(s=>s.id===props.reading.id);
  // Shared secondary button style. The panel keeps its compact padding and inherited 12 px text.
  const button=`${BTN_BASE} ${BTN_SECONDARY} px-2 py-1`;
  return <aside className="absolute right-3 top-3 max-h-[85%] w-72 overflow-auto rounded-md border border-amber-700/60 bg-slate-950/90 p-3 text-xs text-slate-100">
    <div className="flex items-center justify-between gap-2"><strong>Water experiments</strong><button className={button} onClick={props.onClose}>Return to river</button></div><button className={`mt-2 ${button}`} onClick={props.onArea}>All basins</button>
    <label className="mt-2 block">Study<select aria-label="Water experiment" className="mt-1 w-full rounded border border-slate-500 bg-slate-900 p-1.5" value={props.reading.id??''} onChange={e=>props.onSelect(e.target.value||null)}><option value="">None selected</option>{RIVER_EXPERIMENTS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {study&&<><p className="mt-2 font-semibold text-amber-200">{study.status} · {study.mode==='stored'?'stored state; stopped':props.reading.pool?.running?'running':'stopped'}</p><p className="mt-2">{study.summary}</p><p className="mt-2 text-slate-300">{study.limitation}</p><button className={`mt-2 ${button}`} onClick={props.onFocus}>Focus basin</button></>}
    {props.reading.pool&&<><p className="mt-2 font-mono">t={props.reading.pool.physicalSeconds.toFixed(2)} s · stored {props.reading.pool.storedVolume.toFixed(3)} m³ · out {props.reading.pool.outVolume.toFixed(3)} m³</p><p className="mt-1">{props.reading.pool.realtimeStatus} · lag {props.reading.pool.lagSeconds.toFixed(2)} s · last physics {props.reading.pool.lastCpuMs.toFixed(2)} ms / map {props.reading.pool.lastMapUploadMs.toFixed(2)} ms</p><div className="mt-2 flex gap-2"><button className={button} onClick={()=>props.onSource(!props.reading.pool!.sourceOn)}>Source {props.reading.pool.sourceOn?'off':'on'}</button><button className={button} onClick={()=>props.onRunning(!props.reading.pool!.running)}>{props.reading.pool.running?'Pause':'Resume'}</button></div><details className="mt-2"><summary>Native source identity and receipt</summary><pre className="mt-2 whitespace-pre-wrap break-all text-[10px]">{JSON.stringify({sourceIdentity:props.reading.sourceIdentity??'unavailable',...props.reading.pool},null,2)}</pre></details></>}
    {props.reading.loading&&<p className="mt-2">Loading this study only…</p>}
    {props.reading.error&&<p role="alert" className="mt-2 text-orange-300">{props.reading.error}</p>}
    {props.reading.capture&&<><p className="mt-2">Diagnostic occupied boundary · {study?.displayScale}× display magnification · physical time {props.reading.capture.time===null?'not recorded':props.reading.capture.time+' s'}</p><label className="mt-2 block">Stored state<select aria-label="Stored experiment state" className="mt-1 w-full rounded border border-slate-500 bg-slate-900 p-1.5" value={props.reading.state??''} onChange={e=>props.onState(e.target.value)}>{props.reading.capture.states.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><details className="mt-2"><summary>Source identity and measured receipt</summary><pre className="mt-2 whitespace-pre-wrap break-all text-[10px]">{JSON.stringify({captureSha256:props.reading.capture.captureSha256,solverSources:props.reading.capture.solverSources,receipt:props.reading.capture.receipt},null,2)}</pre></details></>}
    <p className="mt-3 text-slate-400">Main river controls remain separate. Stored water never runs. Only the selected live pool may calculate.</p>
  </aside>;
}
