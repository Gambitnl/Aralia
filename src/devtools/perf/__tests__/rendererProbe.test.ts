/**
 * The renderer probe.
 *
 * These tests pin what makes the probe the ONE tracker instead of one more:
 * it finds a renderer nobody wired up, it counts a whole frame without
 * changing `renderer.info.autoReset` for the scene, it counts a frame once no
 * matter how many passes draw it, and it says so when it cannot measure GPU
 * time instead of reporting zero.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installPerfAutoProbe,
  instrumentRenderer,
  perfSessionForRenderer,
  rendererProbeInternals,
} from '../rendererProbe';
import { acquirePerfSession, clearPerfSessions, getPerfSession, getPerfSessions } from '../perfRegistry';

import { setPerfMeasurementEnabled } from '../perfControl';
import { clearPerfOverhead, perfOverheadSnapshot } from '../perfOverhead';

const { runAsAnimationFrame, wrapRenderer, wrapClass, reset } = rendererProbeInternals;

let clock = 0;

/** One display frame: every callback in it gets the same timestamp. */
function displayFrame(time: number, ...callbacks: Array<() => void>): void {
  clock = time;
  for (const cb of callbacks) runAsAnimationFrame(time, cb);
}

/** A WebGLRenderer as three r172 builds it: methods on the instance, reset inside render. */
function fakeWebGl(canvas: HTMLCanvasElement = document.createElement('canvas')) {
  const render = { frame: 0, calls: 0, triangles: 0, points: 0, lines: 0 };
  const info = {
    autoReset: true,
    render,
    memory: { geometries: 3, textures: 2 },
    programs: [{}, {}],
    reset() {
      render.calls = 0;
      render.triangles = 0;
      render.points = 0;
      render.lines = 0;
    },
  };
  canvas.width = 800;
  canvas.height = 600;
  return {
    isWebGLRenderer: true,
    info,
    domElement: canvas,
    getPixelRatio: () => 1,
    getContext: () => null,
    /** `render(draws, triangles)`: the draw work of one render call. */
    render(draws = 1, triangles = 100) {
      render.frame++;
      if (info.autoReset) info.reset();
      render.calls += draws;
      render.triangles += triangles;
    },
    dispose() {},
  };
}

/** A WebGPURenderer as three r172 builds it: methods on the class, no reset inside a call. */
class FakeRendererBase {
  isWebGPURenderer = true;
  info = {
    autoReset: true,
    render: { calls: 0, drawCalls: 0, triangles: 0, points: 0, lines: 0, frameCalls: 0 },
    compute: { calls: 0, frameCalls: 0 },
    memory: { geometries: 1, textures: 4 },
  };
  domElement = document.createElement('canvas');
  getPixelRatio() {
    return 2;
  }
  render(draws = 1, triangles = 100) {
    this.info.render.calls++;
    this.info.render.drawCalls += draws;
    this.info.render.triangles += triangles;
  }
  async renderAsync(draws = 1, triangles = 100) {
    this.render(draws, triangles);
  }
  compute() {
    this.info.compute.calls++;
  }
  async computeAsync() {
    this.compute();
  }
  dispose() {}
}
class FakeWebGpu extends FakeRendererBase {}

function inWindow(title: string): HTMLCanvasElement {
  const win = document.createElement('div');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', title);
  const canvas = document.createElement('canvas');
  win.appendChild(canvas);
  document.body.appendChild(win);
  return canvas;
}

beforeEach(() => {
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  setPerfMeasurementEnabled(true);
  reset();
  clearPerfSessions();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('matched callback attribution',()=>{
  it('counts later synchronous render submissions without counting the asynchronous wait',()=>{
    const r=fakeWebGl(),original=r.render.bind(r);r.render=(...args)=>{original(...args);clock+=3;};
    document.body.append(r.domElement);instrumentRenderer(r,{id:'async-submission'});
    clock=100;runAsAnimationFrame(100,()=>{r.render();clock=105;});
    clock=120;r.render(); // a continuation after waiting, outside the RAF body
    clock=150;runAsAnimationFrame(150,()=>{r.render();clock=155;});
    const a=getPerfSession('async-submission')!.snapshot(clock).attribution!;
    expect(a.callbackMs).toBe(8);expect(a.unknownMs).toBe(42);r.domElement.remove();
  });
  it('reports unavailable coverage when the browser rejects its timing observer',()=>{
    const original=globalThis.PerformanceObserver;
    class RejectedObserver { static supportedEntryTypes=['long-animation-frame'];observe(){throw Error('denied');}disconnect(){} }
    try {
      setPerfMeasurementEnabled(false);vi.stubGlobal('PerformanceObserver',RejectedObserver);
      installPerfAutoProbe();setPerfMeasurementEnabled(true);
      const r=fakeWebGl();document.body.append(r.domElement);instrumentRenderer(r,{id:'denied-observer'});
      clock=100;runAsAnimationFrame(100,()=>{r.render();clock=105;});
      clock=150;runAsAnimationFrame(150,()=>{r.render();clock=155;});
      expect(getPerfSession('denied-observer')!.snapshot(clock).attribution?.browserCoverage).toBe('unavailable');
      r.domElement.remove();
    } finally { setPerfMeasurementEnabled(false);vi.stubGlobal('PerformanceObserver',original);setPerfMeasurementEnabled(true); }
  });
  it('captures other animation callbacks outside this surface on the same clock',()=>{
    const r=fakeWebGl();document.body.append(r.domElement);instrumentRenderer(r,{id:'matched-probe'});
    clock=100;runAsAnimationFrame(100,()=>{r.render();clock=110;});
    clock=130;runAsAnimationFrame(130,function otherPageWork(){clock=140;});
    clock=150;runAsAnimationFrame(150,()=>{r.render();clock=155;});
    const a=getPerfSession('matched-probe')!.snapshot(clock).attribution!;
    expect(a.callbackMs).toBe(10);expect(a.outsideScriptMs).toBe(10);expect(a.unknownMs).toBe(30);
    expect(a.sources[0].name).toContain('otherPageWork');r.domElement.remove();
  });
});

describe('renderer probe: counting a frame', () => {
  it('adds up EVERY pass of a frame and leaves autoReset alone', () => {
    /* A post-processed scene renders several times per frame. Three clears
     * its counters at the start of each render, so a reader of `gl.info`
     * sees only the last pass. The old PerfProbe fixed that by turning
     * autoReset off, which broke any scene that read `gl.info` itself. */
    const r = fakeWebGl();
    instrumentRenderer(r, { id: 'post', label: 'Post' });

    for (let i = 0; i < 3; i++) {
      displayFrame(i * 16, () => {
        r.render(40, 10_000); // scene pass
        r.render(1, 2); // fullscreen quad
      });
    }

    const snap = getPerfSession('post')!.snapshot(clock);
    expect(snap.counters.drawCalls).toBe(41);
    expect(snap.counters.triangles).toBe(10_002);
    expect(snap.counters.renderCalls).toBe(2);
    expect(r.info.autoReset).toBe(true);
    // A scene reading gl.info after a frame still sees three's own numbers.
    expect(r.info.render.calls).toBe(1);
  });

  it('counts a frame ONCE however many callbacks draw into it', () => {
    const r = fakeWebGl();
    instrumentRenderer(r, { id: 'once' });
    for (let i = 0; i <= 10; i++) {
      // Two animation-frame callbacks in one display frame share a timestamp.
      displayFrame(i * 20, () => r.render(), () => r.render());
    }
    expect(getPerfSession('once')!.snapshot(clock).frame.fps).toBeCloseTo(50, 3);
  });

  it('keeps an await continuation inside the frame that started it', () => {
    /* An async compute chain resumes outside the animation-frame callback.
     * Counting that as a new frame would double the frame rate. */
    const r = fakeWebGl();
    instrumentRenderer(r, { id: 'cont' });
    for (let i = 0; i <= 10; i++) {
      displayFrame(i * 20, () => r.render(5, 50));
      clock = i * 20 + 4; // resumed 4 ms later, outside any callback
      r.render(5, 50);
    }
    const snap = getPerfSession('cont')!.snapshot(clock);
    expect(snap.frame.fps).toBeCloseTo(50, 3);
    expect(snap.counters.drawCalls).toBe(10);
  });

  it('reads WebGPU counters that three never resets, as per-frame deltas', () => {
    /* WebGPURenderer r172 resets `info` only inside its own animation loop.
     * A page with its own requestAnimationFrame loop never resets it, so the
     * raw counters grow forever. */
    const r = new FakeWebGpu();
    wrapClass(FakeWebGpu.prototype);
    instrumentRenderer(r, { id: 'gpu' });
    for (let i = 0; i < 4; i++) {
      displayFrame(i * 16, () => {
        r.compute();
        r.compute();
        r.render(300, 90_000);
      });
    }
    const snap = getPerfSession('gpu')!.snapshot(clock);
    expect(snap.api).toBe('webgpu');
    expect(snap.counters.drawCalls).toBe(300);
    expect(snap.counters.triangles).toBe(90_000);
    expect(snap.counters.computeCalls).toBe(2);
    expect(snap.surface.dpr).toBe(2);
  });

  it('counts a nested call once (computeAsync calls compute)', () => {
    const r = new FakeWebGpu();
    wrapClass(FakeWebGpu.prototype);
    instrumentRenderer(r, { id: 'nested' });
    for (let i = 0; i < 3; i++) {
      displayFrame(i * 16, () => {
        void r.computeAsync();
        void r.renderAsync(10, 10);
      });
    }
    const snap = getPerfSession('nested')!.snapshot(clock);
    expect(snap.counters.computeCalls).toBe(1);
    expect(snap.counters.renderCalls).toBe(1);
    expect(snap.counters.drawCalls).toBe(10);
  });

  it('says WebGPU has no GPU clock instead of reporting zero', () => {
    const r = new FakeWebGpu();
    wrapClass(FakeWebGpu.prototype);
    instrumentRenderer(r, { id: 'noclock' });
    displayFrame(0, () => r.render());
    displayFrame(16, () => r.render());
    const gpu = getPerfSession('noclock')!.snapshot(clock).gpu;
    expect(gpu.meanMs).toBeNull();
    expect(gpu.unavailable).toBe('webgpu');
  });

  it('measures CPU from the top of the callback, not from the render call', () => {
    const r = fakeWebGl();
    instrumentRenderer(r, { id: 'cpu' });
    for (let i = 0; i < 4; i++) {
      const t = i * 20;
      clock = t;
      runAsAnimationFrame(t, () => {
        clock = t + 6; // six ms of scene updates before the render call
        r.render();
        clock = t + 7;
      });
    }
    // Each frame's CPU runs from the callback's start to the callback's END:
    // the 6 ms of scene updates before the draw and the 1 ms after it. (Until
    // 2026-09-29 it stopped at the last render call and read 6.)
    expect(getPerfSession('cpu')!.snapshot(clock).cpuMs).toBeCloseTo(7, 3);
  });

  it('never breaks a render when a counter read throws', () => {
    const r = fakeWebGl();
    let drawn = 0;
    const original = r.render;
    r.render = function countedRender(this: unknown, draws?: number, triangles?: number) {
      drawn++;
      return original.call(this, draws, triangles);
    };
    instrumentRenderer(r, { id: 'broken' });
    Object.defineProperty(r.info, 'render', {
      get() {
        throw new Error('bad counters');
      },
    });
    expect(() => displayFrame(0, () => r.render())).not.toThrow();
    expect(drawn).toBe(1);
  });
});

describe('renderer probe: finding surfaces nobody wired', () => {
  it('names an unwired canvas after the window it sits in', () => {
    const r = fakeWebGl(inWindow('Water'));
    wrapRenderer(r);
    displayFrame(0, () => r.render());
    displayFrame(16, () => r.render());
    const session = getPerfSession('auto:water');
    expect(session).toBeDefined();
    expect(session!.label).toBe('Water');
    expect(session!.snapshot(clock).origin).toBe('auto');
    expect(perfSessionForRenderer(r)).toBe(session);
  });

  it('ignores a one-off render, which is a bake and not a surface', () => {
    const r = fakeWebGl(inWindow('Swatches'));
    wrapRenderer(r);
    displayFrame(0, () => r.render());
    expect(getPerfSessions()).toHaveLength(0);
  });

  it('ignores a renderer whose canvas is not on the page', () => {
    const r = fakeWebGl(document.createElement('canvas'));
    wrapRenderer(r);
    for (let i = 0; i < 5; i++) displayFrame(i * 16, () => r.render());
    expect(getPerfSessions()).toHaveLength(0);
  });

  it('gives two canvases in one window two sessions, not one', () => {
    const a = fakeWebGl(inWindow('Fluid'));
    const b = fakeWebGl(document.createElement('canvas'));
    document.querySelector('[role="dialog"]')!.appendChild(b.domElement);
    wrapRenderer(a);
    wrapRenderer(b);
    for (let i = 0; i < 3; i++) displayFrame(i * 16, () => a.render(), () => b.render());
    expect(getPerfSessions().map((s) => s.id).sort()).toEqual(['auto:fluid', 'auto:fluid-2']);
  });

  it('takes a stable id from markup around the canvas', () => {
    const host = document.createElement('div');
    host.setAttribute('data-perf-id', 'river');
    host.setAttribute('data-perf-label', 'River');
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    document.body.appendChild(host);
    const r = fakeWebGl(canvas);
    wrapRenderer(r);
    displayFrame(0, () => r.render());
    displayFrame(16, () => r.render());
    const session = getPerfSession('river');
    expect(session?.label).toBe('River');
    expect(session?.snapshot(clock).origin).toBe('named');
  });

  it('finds a WebGLRenderer through three\'s devtools event', () => {
    installPerfAutoProbe();
    const r = fakeWebGl(inWindow('Golem'));
    const hook = (window as unknown as { __THREE_DEVTOOLS__: EventTarget }).__THREE_DEVTOOLS__;
    // three's WebGLRenderer constructor dispatches exactly this.
    hook.dispatchEvent(new CustomEvent('observe', { detail: r }));
    displayFrame(0, () => r.render());
    displayFrame(16, () => r.render());
    expect(getPerfSession('auto:golem')).toBeDefined();
  });
});

describe('renderer probe: names and lifetime', () => {
  it('hands a released name back to automatic naming', () => {
    const r = fakeWebGl(inWindow('Dungeon'));
    const release = instrumentRenderer(r, { id: 'dungeon3d', label: 'Dungeon 3D' });
    displayFrame(0, () => r.render());
    expect(getPerfSession('dungeon3d')).toBeDefined();

    release();
    expect(getPerfSession('dungeon3d')).toBeUndefined();
    displayFrame(16, () => r.render());
    displayFrame(32, () => r.render());
    expect(getPerfSession('auto:dungeon')).toBeDefined();
  });

  it('drops the session when the renderer is disposed', () => {
    const r = fakeWebGl(inWindow('Town'));
    instrumentRenderer(r, { id: 'town3d' });
    displayFrame(0, () => r.render());
    expect(getPerfSession('town3d')).toBeDefined();
    r.dispose();
    expect(getPerfSession('town3d')).toBeUndefined();
  });

  it('shares one session between a PerfProbe name and a manual acquirer', () => {
    // PreviewVolumeGround acquires "volume" for its spans AND names its canvas
    // "volume"; both must land in one session.
    const manual = acquirePerfSession('volume', 'Land');
    const r = fakeWebGl();
    instrumentRenderer(r, { id: 'volume', label: 'Volume Ground' });
    displayFrame(0, () => r.render());
    expect(getPerfSession('volume')).toBe(manual);
    manual.span('settle', 3);
    displayFrame(16, () => r.render());
    expect(manual.snapshot(clock).spans).toEqual([{ name: 'settle', ms: 3 }]);
    expect(manual.snapshot(clock).counters.renderCalls).toBe(1);
  });
});

describe('renderer measurement bypass', () => {
  it('keeps native draws and resumes with fresh timing after a long bypass', () => {
    const r = fakeWebGl();
    instrumentRenderer(r, { id: 'bypass', label: 'Bypass' });
    displayFrame(16, () => r.render());
    displayFrame(32, () => r.render());
    expect(getPerfSession('bypass')).toBeDefined();
    setPerfMeasurementEnabled(false);
    expect(getPerfSession('bypass')).toBeUndefined();
    displayFrame(5032, () => r.render(3,300));
    expect(r.info.render.calls).toBe(3);
    expect(getPerfSession('bypass')).toBeUndefined();
    setPerfMeasurementEnabled(true);
    displayFrame(5048, () => r.render());
    displayFrame(5064, () => r.render());
    const resumed = getPerfSession('bypass')!.snapshot(clock);
    expect(resumed.frame.meanMs).toBe(16);
    expect(resumed.frame.worstMs).toBe(16);
  });

  it('bypasses graphics clocks without swallowing or duplicating native failures', () => {
    const r = new FakeWebGpu();
    const failure = new Error('native upload failed');
    const writeBuffer = vi.fn(() => { throw failure; });
    const withDevice = Object.assign(r, { backend: { device: { queue: { writeBuffer } } } });
    instrumentRenderer(withDevice, { id: 'upload-bypass' });
    displayFrame(16, () => r.render());
    clearPerfOverhead();
    setPerfMeasurementEnabled(false);
    const clockSpy = vi.spyOn(performance, 'now');
    clockSpy.mockClear();
    expect(() => withDevice.backend.device.queue.writeBuffer()).toThrow(failure);
    expect(writeBuffer).toHaveBeenCalledOnce();
    expect(clockSpy).not.toHaveBeenCalled();
    expect(perfOverheadSnapshot(clock)).toEqual([]);
  });
});

describe('slow WebGPU upload evidence', () => {
  it('retains the three slowest writes with exact ranges and allocation age', () => {
    const r = new FakeWebGpu();
    let delay = 0;
    const nativeWrite = vi.fn(function (this: unknown, ..._args: unknown[]) { clock += delay; return 'receipt'; });
    const nativeCreate = vi.fn((desc: {label: string; size: number}) => { clock += 2; return {...desc}; });
    const device = {
      createBuffer: nativeCreate,
      queue: {writeBuffer: nativeWrite},
    };
    instrumentRenderer(Object.assign(r,{backend:{device}}),{id:'write-evidence'});
    displayFrame(16,()=>r.render());
    displayFrame(32,()=>{
      r.render();
      const buffer=device.createBuffer({label:'water positions',size:64});
      delay=5; expect(device.queue.writeBuffer(buffer,0,new Float32Array(16),2,3)).toBe('receipt');
      delay=6; device.queue.writeBuffer(buffer,0,new DataView(new ArrayBuffer(64)),3,8);
      delay=7; device.queue.writeBuffer(buffer,0,new ArrayBuffer(64),4);
      delay=8; device.queue.writeBuffer(buffer,0,new Float32Array(16),4);
    });
    displayFrame(220,()=>r.render());
    const session=getPerfSession('write-evidence')!;
    const severe=session.snapshot(clock).severeFrames![0];
    expect(severe.notes).toHaveLength(3);
    expect(severe.notes![0]).toContain('8.0 ms, 48 bytes of 64');
    expect(severe.notes![1]).toContain('7.0 ms, 60 bytes of 64');
    expect(severe.notes![2]).toContain('6.0 ms, 8 bytes of 64');
    expect(severe.notes![0]).toContain('water positions');
    expect(severe.notes![0]).toContain('allocated 18 ms before write');
    expect(severe.parts.find(p=>p.name==='buffer upload')?.ms).toBe(26);
    expect(session.snapshot(clock).costs.lastTenSeconds.bufferBytes).toBe(128);
    expect(nativeWrite).toHaveBeenCalledTimes(4);
    expect(nativeCreate).toHaveBeenCalledOnce();
    severe.notes![0]='mutated';
    expect(session.snapshot(clock).severeFrames![0].notes![0]).toContain('water positions');
  });

  it('keeps existing-buffer age unknown and does not leak notes into later frames', () => {
    const r=new FakeWebGpu();
    const device={queue:{writeBuffer(..._args: unknown[]){clock+=120;}}};
    instrumentRenderer(Object.assign(r,{backend:{device}}),{id:'unknown-age'});
    displayFrame(16,()=>r.render());
    displayFrame(32,()=>{r.render();device.queue.writeBuffer({size:32},0,new Uint8Array(32));});
    displayFrame(200,()=>r.render());
    displayFrame(380,()=>r.render());
    const frames=getPerfSession('unknown-age')!.snapshot(clock).severeFrames!;
    expect(frames.find(f=>f.atMs===200)?.notes?.[0]).toContain('allocation age unknown');
    expect(frames.find(f=>f.atMs===380)?.notes).toEqual([]);
  });
});
