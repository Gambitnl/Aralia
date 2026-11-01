/**
 * A measured surface.
 *
 * These tests pin the two things that make a home-made fps counter lie: the
 * baseline it measures against, and what it does with a gap that never
 * happened on screen. They also pin the renderer read, because three ships two
 * renderers whose counters do not share field names.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PerfSession, classifyBottleneck } from '../perfSession';
import {
  acquirePerfSession,
  releasePerfSession,
  getPerfSession,
  getPerfSessions,
  subscribePerfSessions,
  clearPerfSessions,
  setPerfSceneDiagnostics,
} from '../perfRegistry';

describe('matched page work',()=>{
  it('matches delayed browser reports and main-thread operations without counting worker execution',()=>{
    const s=new PerfSession('matched','Matched');s.frame(100);
    s.recordRenderWindow(100,110);s.recordOperation('reply',20,140);
    s.recordOperation('worker: geometry',600,145);
    s.frame(150);s.recordRenderWindow(150,160);s.frame(200);
    s.recordBrowserWork({startTime:160,duration:30,scripts:[{startTime:160,duration:30,invoker:'Worker.onmessage'}]});
    const a=s.snapshot(200).attribution!;expect(a.frames).toBe(2);expect(a.callbackMs).toBe(10);
    expect(a.outsideScriptMs).toBe(25);expect(a.unknownMs).toBe(15);
    expect(a.sources.some(row=>row.name.startsWith('worker:'))).toBe(false);
    s.suspend();s.recordPageWork('hidden task',220,290,'event');s.frame(300);s.frame(350);
    expect(s.snapshot(350).attribution?.outsideScriptMs).toBe(0);
  });
});

describe('PerfSession frames', () => {
  it('measures nothing from a single frame, instead of inventing a delta', () => {
    const s = new PerfSession('x', 'X');
    s.frame(1000);
    expect(s.snapshot(1000).frame.samples).toBe(0);
  });

  it('measures the gap BETWEEN frames', () => {
    const s = new PerfSession('x', 'X');
    s.frame(0);
    for (let i = 1; i <= 10; i++) s.frame(i * 20);
    expect(s.snapshot(200).frame.fps).toBeCloseTo(50, 3);
  });

  it('DISCARDS a gap no frame could have produced, and starts clean', () => {
    /* A backgrounded tab, a breakpoint, or a blocking dialog all resume with
     * one multi-second "frame". Keeping it would make the worst-frame reading
     * useless for the next full second, reporting a stall that nobody saw. */
    const s = new PerfSession('x', 'X');
    s.frame(0);
    s.frame(16);
    s.frame(9000); // came back from a background tab
    expect(s.snapshot(9000).frame.samples).toBe(0);

    s.frame(9016);
    s.frame(9032);
    expect(s.snapshot(9032).frame.samples).toBe(2);
    expect(s.snapshot(9032).frame.worstMs).toBeCloseTo(16, 3);
  });

  it('KEEPS span attribution when only the frame window is thrown away', () => {
    /* A rebuild is exactly when a surface records what the rebuild cost, and
     * then clears the frames because a two-second rebuild is not a frame.
     * Clearing both in one call deleted the number that explained the gap. */
    const s = new PerfSession('x', 'X');
    s.span('re-mesh', 1238);
    s.frame(0);
    s.frame(16);
    s.resetFrames();
    expect(s.snapshot().frame.samples).toBe(0);
    expect(s.snapshot().spans).toEqual([{ name: 're-mesh', ms: 1238 }]);

    s.reset();
    expect(s.snapshot().spans).toEqual([]);
  });

  it('reports a surface as stopped once it quits drawing', () => {
    const s = new PerfSession('x', 'X');
    s.frame(0);
    s.frame(16);
    expect(s.snapshot(20).live).toBe(true);
    expect(s.snapshot(3000).live).toBe(false);
  });
});

describe('PerfSession renderer read', () => {
  it('reads WebGL counters, including the program list length', () => {
    const s = new PerfSession('x', 'X');
    s.sampleRenderer({
      isWebGLRenderer: true,
      info: {
        render: { calls: 42, triangles: 1234, lines: 2, points: 3 },
        memory: { geometries: 7, textures: 5 },
        programs: [{}, {}, {}],
      },
      domElement: { width: 1600, height: 900 },
      getPixelRatio: () => 2,
    });
    const snap = s.snapshot();
    expect(snap.api).toBe('webgl');
    expect(snap.counters.drawCalls).toBe(42);
    expect(snap.counters.triangles).toBe(1234);
    expect(snap.counters.programs).toBe(3);
    expect(snap.surface).toEqual({ width: 1600, height: 900, dpr: 2 });
  });

  it('reads WebGPU counters, which name draws differently and add compute', () => {
    /* WebGPU's `render.calls` counts render PASSES, not draws, so reading the
     * WebGL field name off a WebGPU renderer silently reports the wrong number
     * rather than failing. */
    const s = new PerfSession('x', 'X');
    s.sampleRenderer({
      isWebGPURenderer: true,
      info: {
        render: { calls: 4, drawCalls: 300, triangles: 90000 },
        compute: { calls: 12 },
        memory: { geometries: 3, textures: 8 },
      },
    });
    const snap = s.snapshot();
    expect(snap.api).toBe('webgpu');
    expect(snap.counters.drawCalls).toBe(300);
    expect(snap.counters.computeCalls).toBe(12);
    expect(snap.counters.programs).toBeNull(); // WebGPU keeps no program list
  });

  it('survives a renderer that reports nothing', () => {
    const s = new PerfSession('x', 'X');
    expect(() => s.sampleRenderer(null)).not.toThrow();
    expect(() => s.sampleRenderer({})).not.toThrow();
    expect(s.snapshot().counters.drawCalls).toBe(0);
  });
});

describe('PerfSession capture', () => {
  it('reports the DISTRIBUTION, not just an average', () => {
    const s = new PerfSession('x', 'Volume');
    s.startRecording();
    s.frame(0);
    for (let i = 1; i <= 100; i++) s.frame(i * 10);
    s.frame(1000 + 200); // one long stall
    const report = s.stopRecording();

    expect(report).toContain('Volume');
    expect(report).toContain('p99');
    expect(report).toMatch(/1 frames over 33 ms/);
  });

  it('returns nothing when no capture was running', () => {
    expect(new PerfSession('x', 'X').stopRecording()).toBeNull();
  });
});

describe('PerfSession scene diagnostics', () => {
  it('keeps the component breakdown in snapshots and pasted reports', () => {
    const s = new PerfSession('world3d', 'World 3D');
    s.sampleRenderer({
      isWebGLRenderer: true,
      info: {
        render: { calls: 120, triangles: 1_500_000 },
        memory: { geometries: 12, textures: 4 },
        programs: [],
      },
    });
    s.setSceneDiagnostics({
      meshes: 20,
      instances: 800,
      triangles: 1_000_000,
      shadowMeshes: 6,
      shadowTriangles: 500_000,
      geometries: 8,
      materials: 3,
      families: [
        {
          family: 'trees',
          meshes: 6,
          instances: 700,
          triangles: 900_000,
          shadowMeshes: 2,
          shadowTriangles: 400_000,
        },
      ],
    });

    expect(s.snapshot().scene?.families[0].family).toBe('trees');
    expect(s.report()).toContain('1.50x rendered/main');
    expect(s.report()).toContain('trees');

    s.setSceneDiagnostics(null);
    expect(s.snapshot().scene).toBeNull();
  });
});

describe('perf registry', () => {
  beforeEach(() => clearPerfSessions());

  it('hands the same session to a second mount, so StrictMode makes only one', () => {
    const a = acquirePerfSession('water', 'Water');
    const b = acquirePerfSession('water', 'Water');
    expect(a).toBe(b);
    expect(getPerfSessions()).toHaveLength(1);
  });

  it('keeps the session until the LAST holder lets go', () => {
    acquirePerfSession('water', 'Water');
    acquirePerfSession('water', 'Water');
    releasePerfSession('water');
    expect(getPerfSession('water')).toBeDefined();
    releasePerfSession('water');
    expect(getPerfSession('water')).toBeUndefined();
  });

  it('tells the display when a surface appears or goes', () => {
    let calls = 0;
    const stop = subscribePerfSessions(() => calls++);
    acquirePerfSession('a', 'A');
    releasePerfSession('a');
    stop();
    acquirePerfSession('b', 'B');
    expect(calls).toBe(2); // and nothing after the unsubscribe
  });

  it('lets a scene probe attach diagnostics without importing the overlay', () => {
    acquirePerfSession('world3d', 'World 3D');
    setPerfSceneDiagnostics('world3d', {
      meshes: 1,
      instances: 10,
      triangles: 100,
      shadowMeshes: 1,
      shadowTriangles: 40,
      geometries: 1,
      materials: 1,
      families: [],
    });
    expect(getPerfSession('world3d')?.snapshot().scene?.triangles).toBe(100);
  });
});

describe('classifyBottleneck', () => {
  it('calls a vsync-locked scene with headroom what it is, NOT cpu bound', () => {
    /* The bug this test exists for.
     *
     * A scene locked at 60 fps has a 16.7 ms frame because the display says so.
     * Judged on GPU share alone, 2 ms of GPU work looks like 12% of the frame,
     * and the obvious reading — "the other 88% must be the CPU" — is wrong: the
     * CPU used 3 ms and the machine spent the rest idle. Reporting "CPU bound"
     * sends someone to optimize a CPU that was doing nothing. */
    const v = classifyBottleneck(2, 3, 16.7)!;
    expect(v.kind).toBe('headroom');
    // Unmeasured time is not proof of spare capacity, even near a refresh interval.
    expect(v.label).toContain('not spare capacity');
  });

  it('calls it GPU bound when the GPU fills the frame', () => {
    const v = classifyBottleneck(15, 4, 16.7)!;
    expect(v.kind).toBe('gpu');
  });

  it('calls it CPU bound when the CPU fills the frame', () => {
    const v = classifyBottleneck(3, 28, 33)!;
    expect(v.kind).toBe('cpu');
  });

  it('calls it mixed when both sides are busy and neither clearly wins', () => {
    const v = classifyBottleneck(12, 14, 16.7)!;
    expect(v.kind).toBe('mixed');
  });

  it('still reports headroom when a SLOW frame has both sides idle', () => {
    /* 12 ms of GPU and 14 ms of CPU inside a 30 ms frame leaves half the frame
     * doing nothing. The frame is slow, but neither side is the reason — a
     * 30 Hz display or a throttle is. Blaming a side here would be a guess. */
    expect(classifyBottleneck(12, 14, 30)!.kind).toBe('headroom');
  });

  it('REFUSES to blame the CPU when CPU work was never measured', () => {
    // Without the CPU side there is no evidence for a CPU claim, only for a GPU
    // one. Saying "unknown" is the honest answer, and it is a real state: the
    // reading arrives a frame before the first CPU sample does.
    expect(classifyBottleneck(2, null, 16.7)!.kind).toBe('unknown');
    expect(classifyBottleneck(15, null, 16.7)!.kind).toBe('gpu');
  });

  it('says nothing at all without a GPU reading', () => {
    expect(classifyBottleneck(null, 5, 16.7)).toBeNull();
    expect(classifyBottleneck(5, 5, 0)).toBeNull();
  });
});

describe('visible timing continuity', () => {
  it('observes suspension without hidden callbacks and rejects delayed GPU results', () => {
    const s = new PerfSession('late-gpu', 'Late GPU');
    s.frame(100, false); s.frame(120, false);
    const oldFrame = s.currentFrame;
    s.suspend();
    s.recordGpu([{ frame: oldFrame, ms: 80 }]);
    s.recordCpuFrame(80);
    s.frame(500, false);
    s.recordGpu([{ frame: oldFrame, ms: 80 }]);
    expect(s.snapshot(500).gpu.meanMs).toBeNull();
    expect(s.snapshot(500).cpuMs).toBeNull();
    expect(s.snapshot(500).frame.samples).toBe(0);
    s.frame(520, false);
    s.recordGpu([{ frame: s.currentFrame, ms: 4 }]);
    expect(s.snapshot(520).gpu.meanMs).toBe(4);
  });
  it('discards hidden callbacks and the first resumed interval even below one second', () => {
    const s = new PerfSession('visibility', 'Visibility');
    s.frame(100, false); s.frame(120, false); s.recordCpuFrame(75);
    s.frame(400, true);
    expect(s.snapshot(400).frame.samples).toBe(0);
    expect(s.snapshot(400).cpuMs).toBeNull();
    s.frame(600, false);
    expect(s.snapshot(600).frame.samples).toBe(0);
    s.frame(620, false);
    expect(s.snapshot(620).frame.meanMs).toBe(20);
  });
  it('clears stale CPU and pass evidence after a large suspension gap', () => {
    const s = new PerfSession('gap', 'Gap');
    s.frame(100, false); s.recordCpuFrame(500); s.frame(120, false);
    s.frame(2000, false);
    expect(s.snapshot(2000).cpuMs).toBeNull();
    expect(s.snapshot(2000).stallLog).toEqual([]);
    s.frame(2020, false);
    expect(s.snapshot(2020).frame.meanMs).toBe(20);
  });
});

describe('lightweight frame reading', () => {
  it('agrees with the panel across active, stopped and resumed readings', () => {
    const s = new PerfSession('small-reading', 'Small reading');
    s.frame(100, false); s.frame(120, false);
    for (const now of [120, 619, 620]) {
      const small = s.frameReading(now), full = s.snapshot(now);
      expect(small.frame).toEqual(full.frame);
      expect(small.live).toBe(now < 620);
      expect(small.live).toBe(full.live);
    }
    s.suspend();
    expect(s.frameReading(650).live).toBe(false);
    expect(s.frameReading(650).frame.samples).toBe(0);
    s.frame(680, false); s.frame(700, false);
    expect(s.frameReading(700).frame.meanMs).toBe(20);
    expect(s.frameReading(700).live).toBe(true);
  });
});

describe('between-frame operations',()=>{
  it('reports actual per-call costs with expiry, invalid-value and reset guards',()=>{
    const s=new PerfSession('ops','Operations');
    s.recordOperation('Waterfall reply',280,1000);s.recordOperation('Waterfall reply',300,1100);
    s.recordOperation('Waterfall reply',NaN,1101);s.recordOperation('Waterfall reply',-2,1102);
    expect(s.snapshot(1200).operations).toEqual([{name:'Waterfall reply',samples:2,meanMs:290,p95Ms:300,worstMs:300,totalMs:580,callsPerSecond:1,ageMs:100}]);
    expect(s.snapshot(3101).operations).toEqual([]);
    s.resetFrames();expect(s.snapshot(1200).operations).toEqual([]);
    s.suspend();s.recordOperation('hidden',500,1300);expect(s.snapshot(1400).operations).toEqual([]);
  });
});

describe('severe frame history', () => {
  it('retains sustained 3 FPS from startup after rolling operations expire', () => {
    const s = new PerfSession('severe', 'Severe');
    s.frame(100, false);
    s.recordCpuFrame(20);
    s.recordOperation('reply', 280, 420);
    s.recordOperation('old work', 10, 90);
    s.frame(433, false);
    for (let t=766;t<=2098;t+=333) s.frame(t, false);
    const records=s.snapshot(5000).severeFrames!;
    expect(records).toHaveLength(5);
    expect(records[0].frameMs).toBe(333);
    expect(records[0].cpuMs).toBe(20);
    expect(records[0].operations).toEqual([{name:'reply',ms:280,overlapMs:280}]);
    expect(s.snapshot(5000).operations).toEqual([]);
    records[0].operations[0].ms=999;
    expect(s.snapshot(5000).severeFrames![0].operations[0].ms).toBe(280);
  });
  it('excludes hidden/resumed gaps, preserves prior evidence, and clears on explicit reset', () => {
    const s = new PerfSession('severe-hidden', 'Severe');
    s.frame(100,false); s.frame(400,false);
    s.frame(800,true); s.frame(1200,false); s.frame(1220,false);
    expect(s.snapshot(1220).severeFrames!.map(r=>r.frameMs)).toEqual([300]);
    s.frame(5000,false);
    expect(s.snapshot(5000).severeFrames!.map(r=>r.frameMs)).toEqual([3780,300]);
    expect(s.snapshot(5000).severeFrames![0].notes).toContain('Gap over one second: possible suspension or page stall; excluded from rolling FPS.');
    expect(s.snapshot(5000).frame.samples).toBe(0);
    expect(s.report()).toContain("300.0 ms interval");
    s.reset(); expect(s.snapshot(5000).severeFrames).toEqual([]);
  });
  it('retains the worst five with partial overlapping operation context', () => {
    const s = new PerfSession('severe-worst', 'Severe');
    let at=100; s.frame(at,false);
    for(const dt of [110,120,130,140,150,160]) {at+=dt;s.frame(at,false);}
    s.recordOperation('cross-frame',100,at+50); at+=170;s.frame(at,false);
    const records=s.snapshot(at).severeFrames!;
    expect(records.map(r=>r.frameMs)).toEqual([170,160,150,140,130]);
    expect(records[0].operations).toEqual([{name:'cross-frame',ms:100,overlapMs:50}]);
  });
});

describe('browser attribution of sustained severe frames', () => {
  it('attaches reports delivered before and after a severe interval without relying on a relative stall', () => {
    const s = new PerfSession('browser-severe', 'Water');
    s.frame(100,false);
    s.recordSevereBrowserFrame(110,200,[{name:'worker reply',ms:180}]);
    s.frame(433,false);
    s.recordSevereBrowserFrame(420,100,[{name:'React work',ms:65}]);
    s.frame(766,false);
    const [first,second]=s.snapshot(766).severeFrames!;
    expect(first.browserFrames.map(r=>r.overlapMs)).toEqual([200,13]);
    expect(second.browserFrames.map(r=>r.overlapMs)).toEqual([87]);
    expect(second.browserFrames[0].parts[0].ms).toBe(65);
    expect(s.report()).toContain('65.0 ms/report');
    expect(s.report()).toContain('page-wide');
  });
  it('deduplicates replayed reports and owns the nested report data', () => {
    const s=new PerfSession('browser-copies','Water');s.frame(100,false);s.frame(400,false);
    const parts=[{name:'render callback',ms:250}];
    s.recordSevereBrowserFrame(110,280,parts);parts[0].ms=999;
    s.recordSevereBrowserFrame(110,280,parts);
    const records=s.snapshot(400).severeFrames!;
    expect(records[0].browserFrames).toHaveLength(1);
    expect(records[0].browserFrames[0].parts[0].ms).toBe(250);
    records[0].browserFrames[0].parts[0].ms=888;
    expect(s.snapshot(400).severeFrames![0].browserFrames[0].parts[0].ms).toBe(250);
  });
  it('bounds retained reports, rejects invalid clocks and does not invent hidden-frame records', () => {
    const s=new PerfSession('browser-bounded','Water');s.frame(100,false);s.frame(900,false);
    for(let start=101;start<121;start++)s.recordSevereBrowserFrame(start,60,[{name:'script',ms:20},{name:'invalid',ms:NaN}]);
    expect(s.snapshot(900).severeFrames![0].browserFrames).toHaveLength(5);
    expect(s.snapshot(900).severeFrames![0].browserFrames[0].parts).toHaveLength(1);
    s.recordSevereBrowserFrame(NaN,300,[]);s.recordSevereBrowserFrame(100,-1,[]);
    s.frame(1000,true);s.recordSevereBrowserFrame(1100,500,[]);s.frame(1700,false);s.frame(1900,false);
    expect(s.snapshot(1900).severeFrames!.find(r=>r.atMs===1900)?.browserFrames).toEqual([]);
    s.reset();s.recordSevereBrowserFrame(110,280,[]);s.frame(2000,false);s.frame(2300,false);
    expect(s.snapshot(2300).severeFrames![0].browserFrames).toEqual([]);
  });
});

describe('scene work retained with severe frames', () => {
  it('sums only this frame, owns retained values and does not carry stale stages forward', () => {
    const s = new PerfSession('scene-stages', 'Water');
    s.frame(100, false);
    s.span('Original waterfall display', 190);
    s.span('Original waterfall display', 10);
    s.span('invalid', NaN);
    s.recordCpuFrame(250); s.frame(433, false);
    s.frame(800, false);
    const records = s.snapshot(800).severeFrames!;
    expect(records.find(r => r.atMs === 433)?.spans).toEqual([{ name: 'Original waterfall display', ms: 200 }]);
    expect(records.find(r => r.atMs === 800)?.spans).toEqual([]);
    records.find(r => r.atMs === 433)!.spans![0].ms = 999;
    expect(s.report()).toContain('Original waterfall display 200.0 ms');
    s.span('before suspension', 50); s.suspend();
    s.span('hidden', 100); s.frame(900, false); s.frame(1200, false);
    expect(s.snapshot(1200).severeFrames!.find(r => r.atMs === 1200)?.spans).toEqual([]);
  });
});
