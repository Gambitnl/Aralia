/** Measures delivered water motion separately from rendered FPS. A smooth camera
 * can still show slow physics. This observer never schedules or skips solver work. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/10/2026, 07:26:21
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

interface PaceState {
  selected: string | null;
  display?: 'liquid'|'markers'|'native';
  native?: {time:number;running:boolean;failure:string|null};
  reading: { physicalTime: number; running: boolean; failure: string | null; lastStepMilliseconds: number } | null;
}

export function createWaterfallPaceMeter() {
  let selected: string | null = null;
  let display:PaceState['display'];
  const samples: Array<{ at: number; time: number }> = [];
  const read = (state: PaceState, now: number): string => {
    // Native water has its own accepted clock. A stale contact-worker reply
    // must not label a running native course as missing or paused, and changing
    // solver modes starts a fresh delivered-time observation on the same course.
    const reading = state.display==='native' ? state.native ? {
      physicalTime:state.native.time,running:state.native.running,failure:state.native.failure,lastStepMilliseconds:NaN,
    } : null : state.reading;
    if (selected !== state.selected||display!==state.display) { selected = state.selected;display=state.display;samples.length = 0; }
    if (!selected) { samples.length = 0; return 'No comparison waterfall selected'; }
    if (!reading) { samples.length=0;return 'Waiting for physical water state'; }
    if (reading.failure) { samples.length = 0; return `Stopped: ${reading.failure}`; }
    if (!reading.running) { samples.length = 0; return 'Paused; physical speed is not measured'; }
    if (![now, reading.physicalTime].every(Number.isFinite)) { samples.length = 0; return 'Physical speed unavailable'; }
    const last = samples.at(-1);
    // Course resets, clock rollback and resume start a new observation. Paused
    // time must never make a healthy solver appear artificially slow.
    if (last && (now <= last.at || reading.physicalTime < last.time)) samples.length = 0;
    samples.push({ at: now, time: reading.physicalTime });
    while (samples.length > 2 && samples[1].at <= now - 2000) samples.shift();
    const first = samples[0], wall = (now - first.at) / 1000;
    if (wall < .5) return 'Collecting physical speed…';
    const elapsed = reading.physicalTime - first.time;
    const step = Number.isFinite(reading.lastStepMilliseconds) ? ` · last worker tick ${reading.lastStepMilliseconds.toFixed(1)} ms` : '';
    return `${(elapsed / wall).toFixed(3)}× real time · ${elapsed.toFixed(3)} s water / ${wall.toFixed(1)} s wall${step}`;
  };
  // Only an explicit hidden/zero-area transition resets this clock. A long
  // visible stall still belongs in the speed measurement, however slow it is.
  return Object.assign(read, { suspend: () => { samples.length = 0; } });
}
