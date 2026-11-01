/**
 * Accounts for the time between actual rendered frames on one shared clock.
 * Browser reports can arrive late. Keep a small timeline so their script and
 * rendering intervals can explain recent gaps without adding overlapping work.
 * GPU time overlaps this timeline and is deliberately not subtracted from it.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/10/2026, 14:31:23
 * Dependents: devtools/perf/diagnose.ts, devtools/perf/perfSession.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type WorkSource = 'operation' | 'event' | 'animation' | 'browser' | 'task';
type Range = { start: number; end: number };
type Work = Range & { name: string; kind: 'script' | 'rendering'; source: WorkSource };
export interface FrameAttributionReading {
  frames: number;
  windowMs: number;
  meanFrameMs: number;
  callbackMs: number;
  outsideScriptMs: number;
  browserRenderingMs: number;
  unknownMs: number;
  browserCoverage: 'long-animation-frame' | 'longtask' | 'unavailable';
  /** Exclusive portions after clipping to these frames and removing overlaps. */
  sources: { name: string; ms: number; source: WorkSource }[];
}

/** Chrome's script duration starts at startTime, before executionStart/compilation. */
export interface BrowserFrameTiming {
  startTime: number; duration: number; styleAndLayoutStart?: number;
  scripts?: { startTime?: number; executionStart?: number; duration: number;
    invoker?: string; invokerType?: string; sourceURL?: string; sourceFunctionName?: string }[];
}

function valid(start: number, end: number): boolean {
  return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start;
}

/** Union, rather than sum, keeps nested handlers and browser reports honest. */
function union(ranges: Range[]): Range[] {
  const result: Range[] = [];
  for (const range of ranges.slice().sort((a,b) => a.start-b.start)) {
    const last = result[result.length-1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else result.push({ ...range });
  }
  return result;
}
const duration = (ranges: Range[]) => ranges.reduce((sum,r) => sum+r.end-r.start,0);
function clipped(range: Range, frames: Range[]): Range[] {
  return frames.map(f => ({start: Math.max(f.start,range.start), end: Math.min(f.end,range.end)}))
    .filter(r => r.end > r.start);
}
function subtract(ranges: Range[], claimed: Range[]): Range[] {
  let result = ranges;
  for (const c of claimed) result = result.flatMap(r => {
    if (c.end <= r.start || c.start >= r.end) return [r];
    const rest: Range[] = [];
    if (c.start > r.start) rest.push({start:r.start,end:c.start});
    if (c.end < r.end) rest.push({start:c.end,end:r.end});
    return rest;
  });
  return result;
}

export class FrameAttribution {
  private frames: Range[] = [];
  private callbacks: Range[] = [];
  private work: Work[] = [];
  private cutoff = 0;
  browserCoverage: FrameAttributionReading['browserCoverage'] = 'unavailable';

  recordFrame(start: number, end: number): void {
    // A debugger/suspension-sized gap is not a sample of visible throughput.
    if (!valid(start,end) || end-start > 1000 || start < this.cutoff) return;
    this.frames.push({start,end});
    if (this.frames.length > 180) this.frames.shift();
    this.callbacks = this.callbacks.filter(r => r.end > end-4000);
    this.work = this.work.filter(r => r.end > end-4000);
  }
  recordCallback(start: number, end: number): void {
    if (!valid(start,end) || end <= this.cutoff) return;
    const merged={start:Math.max(start,this.cutoff),end};
    // A completed RAF body covers the render calls just recorded inside it.
    // Coalesce them now, so a many-pass scene cannot evict valid recent frame
    // coverage merely by filling the bounded callback ring with nested calls.
    let last=this.callbacks[this.callbacks.length-1];
    while(last && last.end >= merged.start && last.start <= merged.end){
      this.callbacks.pop();merged.start=Math.min(merged.start,last.start);merged.end=Math.max(merged.end,last.end);
      last=this.callbacks[this.callbacks.length-1];
    }
    this.callbacks.push(merged);
    if (this.callbacks.length > 360) this.callbacks.shift();
  }
  recordWork(name: string, start: number, end: number, source: WorkSource, kind: Work['kind'] = 'script'): void {
    if (!valid(start,end) || end <= this.cutoff) return;
    // A delayed observer and buffered report may deliver the same interval twice.
    if (this.work.some(w => w.start===start && w.end===end && w.name===name && w.source===source)) return;
    this.work.push({name,start:Math.max(start,this.cutoff),end,source,kind});
    if (this.work.length > 512) this.work.shift();
  }
  recordBrowserFrame(entry: BrowserFrameTiming): void {
    const end = entry.startTime+entry.duration;
    if (!valid(entry.startTime,end)) return;
    for (const script of entry.scripts ?? []) {
      const start = script.startTime ?? script.executionStart;
      if (start === undefined) continue;
      const file = (script.sourceURL ?? '').split(/[?#]/)[0].split('/').pop();
      const name = script.sourceFunctionName === 'performWorkUntilDeadline' || /react-dom|scheduler/i.test(file ?? '')
        ? 'React updates and scheduling'
        : [script.invoker ?? script.invokerType ?? 'script',script.sourceFunctionName,file && `in ${file}`].filter(Boolean).join(' ');
      this.recordWork(name,Math.max(entry.startTime,start),Math.min(end,start+script.duration),'browser');
    }
    if (entry.styleAndLayoutStart && entry.styleAndLayoutStart > 0) {
      // This is the browser's rendering-phase tail, including style/layout and
      // related rendering work. It is not an isolated paint or GPU duration.
      this.recordWork('Browser rendering phase',Math.max(entry.startTime,entry.styleAndLayoutStart),end,'browser','rendering');
    }
  }
  read(now: number): FrameAttributionReading | null {
    const frames = this.frames.filter(f => f.end <= now && f.end > now-1000);
    if (!frames.length) return null;
    const frameRanges = union(frames), windowMs = duration(frameRanges), count = frames.length;
    const callbacks = union(this.callbacks.flatMap(c => clipped(c,frameRanges)));
    let claimed = callbacks;
    let outside = 0, rendering = 0;
    const sources = new Map<string, {name:string;ms:number;source:WorkSource}>();
    // Direct instrumentation wins over page-wide browser evidence. Within one
    // source prefer the narrower child, so an aggregate cannot hide its phases.
    const priority = {operation:0,event:1,animation:2,browser:3,task:4};
    for (const w of this.work.slice().sort((a,b) => priority[a.source]-priority[b.source] || (a.end-a.start)-(b.end-b.start))) {
      const pieces = subtract(clipped(w,frameRanges),claimed), ms = duration(pieces);
      if (ms <= 0) continue;
      claimed = union([...claimed,...pieces]);
      if (w.kind === 'rendering') rendering += ms; else outside += ms;
      const key = w.source+':'+w.name, row = sources.get(key) ?? {name:w.name,ms:0,source:w.source};
      row.ms += ms; sources.set(key,row);
    }
    const callbackMs = duration(callbacks);
    return { frames:count,windowMs,meanFrameMs:windowMs/count,
      callbackMs:callbackMs/count,outsideScriptMs:outside/count,browserRenderingMs:rendering/count,
      unknownMs:Math.max(0,windowMs-callbackMs-outside-rendering)/count,browserCoverage:this.browserCoverage,
      sources:[...sources.values()].map(s=>({...s,ms:s.ms/count})).sort((a,b)=>b.ms-a.ms) };
  }
  clear(at = 0): void {
    this.frames=[];this.callbacks=[];this.work=[];this.cutoff=Math.max(this.cutoff,at);
  }
}
