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
  reset();
  clearPerfSessions();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
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
