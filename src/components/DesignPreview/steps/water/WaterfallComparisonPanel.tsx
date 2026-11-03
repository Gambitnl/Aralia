/** Controls the neighboring diagnostic waterfalls without changing the river. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 21:59:08
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
import { TERRAIN_COMPARISON_CASES, RAPIDS_WATERFALL_SEQUENCE } from '@/systems/world3d/river/waterfallTerrainProfiles';
import type { ComparisonDisplay, ComparisonId, ComparisonState } from '@/components/World3D/water/waterfallTerrainComparisonView';

/**
 * Keep the latest comparison reading beside its panel. Every accepted update
 * remains available, including while the panel is closed. Only subscribed
 * readouts render again; the river's unrelated editing controls stay intact.
 * This changes UI notification ownership, never water stepping or display.
 */
export function createComparisonReadings(initial: ComparisonState) {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish: (next: ComparisonState) => {
      if (next === current) return;
      current = next;
      for (const listener of listeners) listener();
    },
  };
}

export function WaterfallComparisonPanel({ readings, onDisplay, onCloseUp, onFocus, onSource, onPause, onReset, onClose }: {
  readings: ReturnType<typeof createComparisonReadings>; onCloseUp: () => void; onDisplay: (display: ComparisonDisplay) => void; onFocus: (id?: ComparisonId) => void; onSource: (on: boolean) => void;
  onPause: (paused: boolean) => void; onReset: () => void; onClose: () => void;
}) {
  const state = React.useSyncExternalStore(readings.subscribe, readings.getSnapshot, readings.getSnapshot);
  const reading = state.reading;
  const sourceOn=state.native?.sourceOn??reading?.sourceOn;
  const running=state.native?.running??reading?.running;
  const selected = state.selected ?? undefined;
  // This URL selects the separate complete-course candidate. Its label must
  // not describe the historical miniatures or imply reference acceptance.
  const referenceCourse = new URLSearchParams(window.location.search).get('riverCourse') === 'references';
  const profile = TERRAIN_COMPARISON_CASES.find(item => item.id === selected);
  const [minimized,setMinimized] = React.useState(false);
  const details = React.useRef<HTMLDetailsElement>(null);
  const focus = (id?: ComparisonId): void => { onFocus(id); };
  if(state.integrated&&minimized)return <button type="button" onClick={()=>setMinimized(false)} className="absolute top-3 left-3 z-30 rounded border border-cyan-700 bg-slate-950/95 px-3 py-2 text-xs text-cyan-100">Show terrain controls{profile?` · ${profile.label}`:''}</button>;
  // Integrated inspection follows the existing main river. Diagnostic water
  // buttons would start another source/system, so they belong only to legacy.
  if(state.integrated)return <section className="absolute top-3 left-3 right-3 z-30 max-h-[45%] overflow-auto rounded-lg border border-cyan-700 bg-slate-950/95 p-3 text-xs text-slate-100" aria-label="Integrated waterfall terrain">
    <div className="flex justify-between gap-3"><h3>Seven falls in the main rapids</h3><div className="flex gap-3"><button type="button" onClick={()=>setMinimized(true)}>Minimize controls</button><button type="button" onClick={onClose}>Close</button></div></div>
    <div className="mt-2 flex flex-wrap gap-2"><button type="button" className="rounded border px-2 py-1" onClick={()=>focus()}>Whole sequence</button>{RAPIDS_WATERFALL_SEQUENCE.map((f,i)=><button type="button" key={f.id} aria-pressed={selected===f.id} className={`rounded border px-2 py-1 ${selected===f.id?'border-cyan-300 bg-cyan-950':'border-slate-600'}`} onClick={()=>focus(f.id)}>{i+1}. {f.label}</button>)}</div>
    <p className="mt-2">{referenceCourse ? 'Reference-height course candidate. Faithful reconstruction remains under verification.' : 'Seven miniature reference forms cut into the existing river bed.'} Water comes from the original upstream source; these controls only move the camera.</p>
    {selected&&<p className="mt-2">{profile?.label}: {RAPIDS_WATERFALL_SEQUENCE.find(f=>f.id===selected)?.form}. Native flow, finite water contact and travel through the complete sequence remain under verification.</p>}
    <p className="mt-2 text-amber-200">Dry rock is intentional until simulated water arrives. No per-fall source or drawn water ribbon. The recessed plunge is a height-field notch; overhang underside physics remains unfinished.</p>
  </section>;
  // Hiding controls leaves this course, its water and the camera intact. Close
  // still exits the comparison; it must not be required merely to see the crest.
  if (minimized) return <button type="button" onClick={()=>setMinimized(false)} className="absolute top-3 left-3 z-30 rounded border border-cyan-700 bg-slate-950/95 px-3 py-2 text-xs text-cyan-100">Show waterfall controls{profile ? ` · ${profile.label}` : ''}</button>;
  return <section className="absolute top-3 left-3 right-3 z-30 max-h-[65%] overflow-auto rounded-lg border border-cyan-700 bg-slate-950/95 p-3 text-xs text-slate-100" aria-label="Waterfall comparisons">
    <div className="flex justify-between gap-3"><h3 className="text-base font-semibold">Waterfall landscapes</h3><div className="flex gap-3"><button onClick={()=>setMinimized(true)} type="button">Minimize controls</button><button onClick={onClose} type="button">Close</button></div></div>
    <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-8"><button className="rounded border border-slate-600 px-2 py-1" aria-pressed={selected === undefined} type="button" onClick={() => focus()}>Overview — original + seven</button>{TERRAIN_COMPARISON_CASES.map((item, index) => <button className={`rounded border px-2 py-1 text-left ${selected === item.id ? 'border-cyan-300 bg-cyan-950' : 'border-slate-600'}`} aria-pressed={selected === item.id} key={item.id} type="button" onClick={() => focus(item.id)}>{index + 1}. {item.label}</button>)}</div>
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Terrain water system">
      <button disabled={!selected} type="button" aria-pressed={state.display==='native'} onClick={()=>{onDisplay('native');onPause(false);}} className="rounded border border-cyan-400 bg-cyan-950 px-3 py-2 disabled:opacity-40">Run native river water — terrain test</button>
      <button type="button" aria-pressed={state.display==='liquid'} onClick={()=>onDisplay('liquid')} className="rounded border border-slate-600 px-3 py-2">Experimental contact water</button>
      <button type="button" aria-pressed={state.display==='markers'} onClick={()=>onDisplay('markers')} className="rounded border border-slate-600 px-3 py-2">Experimental state markers</button>
    </div>
    {state.display==='native'&&<div className="mt-2 rounded border border-cyan-800 bg-cyan-950/40 p-2">
      <p>Native river solver and water material on the drawn landscape. Starts dry; the upstream source supplies all water. CPU test; GPU migration is still unqualified.</p>
      {/* The guard checks centers only. The finite-width bank audit failed,
          so a closed ledger and clear centers must not read as solid contact. */}
      {state.nativeAligned&&<p className="mt-1 text-amber-200">{state.nativeConforming?'Terrain-conforming cell candidate':'Course-aligned grid diagnostic'}: not accepted. Stops if a water center enters the drawn rock; this does not check the whole water volume. {state.nativeConforming?'Cell widths, volumes, currents and point contact use measured terrain boundaries. Finite-width water still overlaps some banks.':'Same cell count and equations; rotated outer footprint.'} Full contact, downstream boundaries and all seven courses need qualification.</p>}
      <p className="mt-1 text-amber-200">Shallow-water storage and conservative airborne spill. Full impact pressure, overhang undersides and the original waterfall’s aeration plume remain unfinished.</p>
      <button type="button" onClick={()=>{onCloseUp();setMinimized(true);}} className="mt-2 rounded border border-cyan-300 px-3 py-2">Inspect native flow</button>
      <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={()=>onSource(!sourceOn)} className="rounded border border-cyan-600 px-2 py-1">{sourceOn?'Stop native source':'Start native source'}</button><button type="button" onClick={()=>onPause(!!running)} className="rounded border border-cyan-600 px-2 py-1">{running?'Pause native water':'Run native water'}</button><button type="button" onClick={onReset} className="rounded border border-slate-600 px-2 py-1">Reset native test (paused)</button></div>
      {state.native&&<p className="mt-2 font-mono">{state.native.time.toFixed(2)} s · admitted {state.native.inVolume.toFixed(3)} m³ · wet {state.native.wetVolume.toFixed(3)} · airborne {state.native.airVolume.toFixed(3)} · out {state.native.outVolume.toFixed(3)} · closure {state.native.closure.toExponential(2)} m³ · {state.native.cells} cells · {state.native.faces} exposed edges</p>}
      {(state.native?.failure||state.displayError)&&<p role="alert" className="mt-2 text-red-200">Stopped: {state.native?.failure??state.displayError}</p>}
    </div>}
    <details ref={details} hidden={state.display==='native'} className="mt-2"><summary className="cursor-pointer text-cyan-200">Experimental water controls and terrain details</summary>
    <div className="mt-3 flex gap-2" role="group" aria-label="Water presentation">{(['liquid', 'markers'] as const).map(mode => <button key={mode} type="button" aria-pressed={state.display === mode} onClick={() => onDisplay(mode)} className={`rounded border px-3 py-2 ${state.display === mode ? 'border-cyan-300 bg-cyan-950' : 'border-slate-600'}`}>{mode === 'liquid' ? 'Liquid surfaces' : 'State markers'}</button>)}</div>
    <p className="mt-2">{state.display === 'native'?'Native terrain test is selected above. The details below describe the separate contact prototype.':state.display === 'liquid' ? selected ? 'Experimental contact solver and reconstructed sheets. Some optical settings are shared with the river; this is a different water system.' : 'All seven solid landscapes are beside the original. Select a name to move closer.' : 'Dots show water state, not droplet size. Cyan: particles. Blue to green: depth on the first contact surface.'}</p>
    {state.displayError && <p role="alert" className="mt-2 text-amber-200">Liquid view unavailable; state markers retained. {state.displayError}</p>}
    <p className="mt-2 text-slate-300">Seven plain rock landforms: shelves, seven narrow chutes, a recessed plunge, twin falls, wide terraces, a gully and a long slope. The shapes are reference-inspired, not surveyed replicas.</p>

    {selected && <><button type="button" className="mt-3 rounded border border-cyan-300 bg-cyan-950 px-3 py-2" onClick={()=>{onCloseUp();if(details.current)details.current.open=false;}}>Inspect main flow</button><p className="mt-1 text-slate-300">Camera frames 99% of the water volume without hiding geometry. Select the course name to see the whole landscape.</p></>}
    {profile && <p className="mt-3 rounded bg-slate-800 p-2"><strong>{profile.label} · {profile.clipAt}</strong><br />{profile.description}</p>}
    <div className="mt-3 flex gap-2"><button disabled={!selected} className="rounded border border-cyan-700 px-2 py-1 disabled:opacity-40" type="button" onClick={() => onSource(!reading?.sourceOn)}>{reading?.sourceOn ? 'Stop source' : 'Start source'}</button><button disabled={!selected} className="rounded border border-cyan-700 px-2 py-1 disabled:opacity-40" type="button" onClick={() => onPause(!!reading?.running)}>{reading?.running ? 'Pause water' : 'Run existing water'}</button><button disabled={!selected} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-40" type="button" onClick={onReset}>Reset selected (paused)</button></div>
    {state.loading && <p className="mt-2">Preparing existing comparison water…</p>}
    <p className="mt-3 font-mono">Selected physical clock {reading?.physicalTime.toFixed(3) ?? '0.000'} s · inspection open {state.wallSeconds.toFixed(1)} s (includes pauses)</p>
    <p className="mt-2 text-amber-200">Only the selected course runs. Switching pauses and keeps its water; returning resumes from that state when you press Run. Each course has its own clock. The original waterfall is unchanged.</p>
    {(reading?.failure || state.error) && <p role="alert" className="mt-3 rounded border border-red-400 bg-red-950 p-2 text-red-200">Stopped. Last accepted water state is preserved. Reason: {reading?.failure ?? state.error}</p>}
    <details className="mt-3"><summary className="cursor-pointer text-cyan-200">Accounting and model limits</summary>
    {state.liquid && <p className="mt-2 font-mono">Liquid represented {state.liquid.representedVolume.toPrecision(5)} m³ · unresolved {state.liquid.unresolvedVolume.toExponential(2)} m³ · {state.liquid.surfaceVertices} surface vertices</p>}
    <p className="mt-1">Fixed tick: 1/120 s. Up to four ticks per worker reply, stopping between ticks after 8 ms; no accumulated catch-up. Last complete worker tick: {reading?.lastStepMilliseconds.toFixed(1) ?? '0'} ms.</p>
    <p className="mt-2">Same total source: 1.5 m³/s, 10 m total wet inlet width, 0.7 m deep. Split inlets divide that flow across the recorded streams. Independent pool accounting; no connection to the main river.</p>
    <p className="mt-2">Sloped banks and shelf tops share the same drawn shape and water contact. Vertical cliff sides, undersides and basin interiors still lack collision and basin pressure. Only the first rock surface simulates spreading water. All other surfaces use contact particles, including neighboring lanes at the same height. Liquid mode draws finite source and release sheets, stored film and coarse parcels for the selected course. State markers show every positive record through rock, including tiny amounts. Both views read the same accepted state.</p>
    {reading?.cases.map(item => <div className="mt-3 border-t border-slate-700 pt-2" key={item.id}><strong>{TERRAIN_COMPARISON_CASES.find(profile => profile.id === item.id)?.label ?? item.id}</strong><p className="font-mono">Emitted {item.emittedVolume.toPrecision(5)} · stored {item.storedVolume.toPrecision(5)} · arrived {item.arrivedVolume.toPrecision(5)} m³</p><p className="font-mono">Closure {item.closureError.toExponential(2)} m³ · contacts {item.contactCount}</p><p>Drawn: {state.markers[item.id]?.parcels ?? 0} particles; {state.markers[item.id]?.filmCells ?? 0} wet film cells.</p><p>Surface contacts: {Object.entries(item.surfaceContactCounts).map(([id, count]) => `${id}: ${count}`).join(', ') || 'none yet'}</p></div>)}
    <p className="mt-3 text-amber-200">Coarse prototype: the first contact surface uses depth-averaged flow. Other surfaces constrain particle centers. Split streams do not yet have equally detailed flow. No air coupling, free-flight pressure, viscosity or resolved breakup. Liquid surfaces preserve modeled volume but do not resolve overlapping water or improve the solver. This view helps inspect behavior; it does not establish physical correctness.</p>
    </details>
    </details>
  </section>;
}
