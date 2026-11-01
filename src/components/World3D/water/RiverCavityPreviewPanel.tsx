/**
 * The experimental clone's inspection controls. Stored observations are labeled
 * explicitly so an unfinished cavity experiment cannot appear to be live proof.
 * It drives the existing river view, never creates another renderer or worker.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/10/2026, 13:35:46
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useRef, useState } from 'react';
import type { RiverReachView } from './riverReachScene';
import { loadCavityPreview, type CavityPreviewData } from './riverCavityPreview';

export function RiverCavityPreviewPanel({ view }: { view: RiverReachView | null }) {
  const [data, setData] = useState<CavityPreviewData | null>(null);
  const [message, setMessage] = useState('No stored experiment loaded.');
  const [study, setStudy] = useState(false);
  const studyActive = useRef(false);
  const focusOnEntry = useRef(false);
  const [frame, setFrame] = useState(0);
  const [reload, setReload] = useState(0);
  const returnCamera = useRef<{ pos: number[]; quat: number[]; fov: number; time: number | null } | null>(null);
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.delete('riverPreview');
  useEffect(() => {
    const controller = new AbortController();
    setMessage('Loading stored experiment…');
    void loadCavityPreview(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setData(result); setFrame(0); setMessage(result.message);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) { setData(null); setMessage(`Unavailable: ${error instanceof Error ? error.message : String(error)}`); }
    });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (!view || !study || !data) return;
    const snapshot = data.snapshots[frame];
    view.showCavityStudy(data.terrain, snapshot?.positions ?? [], snapshot?.timeSeconds ?? 0);
    if (focusOnEntry.current) { view.focusCavityPatch(data.terrain); focusOnEntry.current = false; }
    return () => view.hideCavityStudy();
  }, [view, study, data, frame]);
  const compare = (on: boolean): void => {
    if (!view) return;
    // Save once on entry, even if repeated clicks arrive before React paints.
    // Returning restores the full camera lens and cannot overwrite later movement.
    if (on) {
      if (!studyActive.current) focusOnEntry.current = true;
      if (!studyActive.current) returnCamera.current = { pos: view.camera.position.toArray(), quat: view.camera.quaternion.toArray(), fov: view.camera.fov, time: view.pinnedTime };
    } else if (studyActive.current) {
      view.hideCavityStudy();
      const saved = returnCamera.current;
      if (saved) { view.camera.position.fromArray(saved.pos); view.camera.quaternion.fromArray(saved.quat); view.camera.fov = saved.fov; view.camera.updateProjectionMatrix(); view.pinnedTime = saved.time; view.camera.updateMatrixWorld(); view.mirrorPlaneFromCamera(); }
    }
    studyActive.current = on;
    setStudy(on);
  };
  return <aside aria-label="Bank cavity experimental preview" className="max-h-[40vh] w-full shrink-0 overflow-auto border border-amber-400 bg-slate-950 p-3 text-xs text-slate-100 md:h-full md:max-h-full md:w-80">
    <strong className="text-sm text-amber-300">Experimental cloned river · bank cavity</strong>
    <p className="mt-1">2 m × 2 m bank patch · x 36–38, z 22–24</p>
    <a className="mt-2 block text-sky-300 underline" href={currentUrl.toString()}>Back to current river</a>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="rounded border px-2 py-1" onClick={() => compare(false)}>Ordinary cloned river</button>
      <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={!view || !data} onClick={() => compare(true)}>Frozen captured patch</button>
      <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={!view} onClick={() => view?.focusCavityPatch(study ? data?.terrain : undefined)}>Focus patch</button>
      <button type="button" className="rounded border px-2 py-1" onClick={() => { compare(false); setReload(n => n + 1); }}>Reload experiment</button>
    </div>
    <p className="mt-3" role="status">{data?.status ?? 'UNAVAILABLE'} · {message}</p>
    <p className="mt-2">{study ? 'Frozen native geometry study. Surrounding cloned terrain is hidden because it has not been certified against this captured input.' : 'Ordinary river copy. Its worker and editing state belong to this page.'}</p>
    <p className="mt-2 text-slate-300">Stored triangles are observations, not live cavity physics. Water uses the native material and cloned river shading; appearance is not a qualification result.</p>
    {data && <p className="mt-2">{data.snapshots.length} stored observations · {data.terrain.length / 9} captured solid triangles</p>}
    {data && data.snapshots.length === 0 && <p className="mt-2 text-amber-200">Preparation only: no accepted wet state is available.</p>}
    {study && data && data.snapshots.length > 0 && <label className="mt-3 block">Stored observation {frame + 1}/{data.snapshots.length}: {data.snapshots[frame].label} · {data.snapshots[frame].timeSeconds.toFixed(3)} s
      <input aria-label="Stored observation" className="mt-2 w-full" type="range" min={0} max={data.snapshots.length - 1} step={1} value={frame} onChange={event => setFrame(Number(event.target.value))} />
      <span className="block break-all">State: {data.snapshots[frame].stateId}</span>
    </label>}
  </aside>;
}
