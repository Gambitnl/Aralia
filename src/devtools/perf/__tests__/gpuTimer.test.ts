/**
 * GPU frame timing.
 *
 * The extension has four rules that a naive implementation breaks, and each of
 * them fails SILENTLY: a second open query is rejected, a result read too early
 * is garbage, a disjoint GPU reports a spike that never happened, and a browser
 * without the extension gets a zero that reads as "the GPU is free". Every case
 * below is one of those.
 */
import { describe, it, expect } from 'vitest';
import { GpuFrameTimer } from '../gpuTimer';
import { RollingMs } from '../frameStats';

const TIME_ELAPSED = 0x88bf;
const GPU_DISJOINT = 0x8fbb;
const QUERY_RESULT = 0x8866;
const QUERY_RESULT_AVAILABLE = 0x8867;

/** A WebGL2 context that behaves like a driver, with the timing under test. */
class FakeGl {
  readonly QUERY_RESULT = QUERY_RESULT;
  readonly QUERY_RESULT_AVAILABLE = QUERY_RESULT_AVAILABLE;

  open: number | null = null;
  created = 0;
  deleted = 0;
  disjoint = false;
  /** Nanoseconds each finished query will report, in the order they finish. */
  readonly ready = new Map<number, number>();
  /** Every begin/end, so a test can prove only one query is ever open. */
  readonly log: string[] = [];

  constructor(private readonly hasExtension = true) {}

  getExtension(name: string): unknown {
    if (!this.hasExtension) return null;
    if (name !== 'EXT_disjoint_timer_query_webgl2') return null;
    return { TIME_ELAPSED_EXT: TIME_ELAPSED, GPU_DISJOINT_EXT: GPU_DISJOINT };
  }

  getParameter(pname: number): unknown {
    return pname === GPU_DISJOINT ? this.disjoint : null;
  }

  createQuery(): WebGLQuery {
    this.created++;
    return this.created as unknown as WebGLQuery;
  }

  deleteQuery(): void {
    this.deleted++;
  }

  beginQuery(target: number, query: WebGLQuery): void {
    if (this.open !== null) throw new Error('a second query was opened while one was already open');
    if (target !== TIME_ELAPSED) throw new Error('wrong query target');
    this.open = query as unknown as number;
    // A real driver discards the old result when a query is reused. Without
    // this the fake hands back a recycled query's previous answer.
    this.ready.delete(this.open);
    this.log.push(`begin:${this.open}`);
  }

  endQuery(target: number): void {
    if (this.open === null) throw new Error('endQuery with nothing open');
    if (target !== TIME_ELAPSED) throw new Error('wrong query target');
    this.log.push(`end:${this.open}`);
    this.open = null;
  }

  getQueryParameter(query: WebGLQuery, pname: number): unknown {
    const id = query as unknown as number;
    if (pname === QUERY_RESULT_AVAILABLE) return this.ready.has(id);
    return this.ready.get(id) ?? 0;
  }

  /** Let the driver finish a query, in nanoseconds. */
  finish(id: number, ns: number): void {
    this.ready.set(id, ns);
  }
}

const rendererWith = (gl: unknown, extra: Record<string, unknown> = {}) => ({
  getContext: () => gl,
  ...extra,
});

/** One frame, driven the way the probe drives it: open, draw, close. */
const frame = (timer: GpuFrameTimer): number[] => {
  const results = timer.beginFrame();
  timer.endFrame();
  return results;
};

describe('GpuFrameTimer availability', () => {
  it('explains a browser that WITHHOLDS the clock, instead of reporting zero', () => {
    /* A missing extension is the common case, not an error: a precise GPU clock
     * fingerprints a machine, so browsers hide it. Reporting 0 ms would read as
     * "the GPU is free", which is the opposite of the truth. */
    const attempt = GpuFrameTimer.forRenderer(rendererWith(new FakeGl(false)));
    expect(attempt.timer).toBeNull();
    expect(attempt.reason).toBe('no-extension');
  });

  it('names WebGPU separately, because the reason is different', () => {
    const attempt = GpuFrameTimer.forRenderer(rendererWith(new FakeGl(), { isWebGPURenderer: true }));
    expect(attempt.timer).toBeNull();
    expect(attempt.reason).toBe('webgpu');
  });

  it('rejects a WebGL1 context, which has no query objects', () => {
    const attempt = GpuFrameTimer.forRenderer(rendererWith({ getExtension: () => null }));
    expect(attempt.reason).toBe('no-webgl2');
  });

  it('reports a renderer with no context at all', () => {
    expect(GpuFrameTimer.forRenderer(null).reason).toBe('no-context');
    expect(GpuFrameTimer.forRenderer({}).reason).toBe('no-context');
  });
});

describe('GpuFrameTimer measurement', () => {
  const start = () => {
    const gl = new FakeGl();
    const timer = GpuFrameTimer.forRenderer(rendererWith(gl)).timer!;
    expect(timer).toBeTruthy();
    return { gl, timer };
  };

  it('keeps exactly ONE query open, which the extension requires', () => {
    // FakeGl throws on a second open, so twenty frames without a throw is the
    // proof. Results are fed back each frame, as a live driver would.
    const { gl, timer } = start();
    for (let i = 0; i < 20; i++) {
      timer.beginFrame();
      const open = gl.open;
      timer.endFrame();
      if (open !== null) gl.finish(open, 3_000_000);
    }
    expect(gl.open).toBeNull(); // every frame closed its own query
    const begins = gl.log.filter((e) => e.startsWith('begin')).length;
    const ends = gl.log.filter((e) => e.startsWith('end')).length;
    expect(begins).toBe(ends);
  });

  it('closes the query INSIDE the frame, never across the frame boundary', () => {
    /* The whole accuracy of this timer sits here. A query left open across the
     * boundary also measures the GPU idling until the display's vertical blank,
     * so every vsync-locked scene reports GPU time equal to frame time and the
     * number stops telling you anything. */
    const { gl, timer } = start();
    timer.beginFrame();
    expect(gl.log).toEqual(['begin:1']);
    timer.endFrame();
    expect(gl.log).toEqual(['begin:1', 'end:1']);
    expect(gl.open).toBeNull(); // nothing open while the browser presents
  });

  it('STOPS opening queries once the pool is full, then resumes', () => {
    /* This is the stalled-driver case: nothing ever comes back. The timer must
     * skip frames rather than allocate forever, and must pick up again the
     * moment a result lands. */
    const { gl, timer } = start();
    for (let i = 0; i < 12; i++) frame(timer);
    expect(gl.created).toBe(8);

    gl.finish(1, 2_000_000);
    expect(timer.beginFrame()).toEqual([2]);
    expect(gl.open).not.toBeNull(); // the freed query went straight back to work
    timer.endFrame();
  });

  it('reports nothing until the driver has an answer', () => {
    /* The result of a frame is never ready in that frame. A reader that assumed
     * otherwise would report the previous query's leftover value. */
    const { timer } = start();
    expect(frame(timer)).toEqual([]);
    expect(frame(timer)).toEqual([]);
    expect(frame(timer)).toEqual([]);
  });

  it('converts a finished query from nanoseconds to milliseconds', () => {
    const { gl, timer } = start();
    frame(timer); // query 1 covers this frame
    gl.finish(1, 4_500_000); // 4.5 ms, reported a frame or two later
    expect(frame(timer)).toEqual([4.5]);
  });

  it('delivers several results at once after a lag, in order', () => {
    const { gl, timer } = start();
    for (let i = 0; i < 4; i++) frame(timer);
    gl.finish(1, 1_000_000);
    gl.finish(2, 2_000_000);
    gl.finish(3, 3_000_000);
    expect(frame(timer)).toEqual([1, 2, 3]);
  });

  it('DISCARDS every in-flight result when the GPU goes disjoint', () => {
    /* A disjoint means the GPU was interrupted — a mode switch, another process
     * taking the device. The elapsed times then measure the interruption, not
     * the scene, and reporting them would put a phantom spike on the graph. */
    const { gl, timer } = start();
    const opened: number[] = [];
    const runFrame = () => {
      timer.beginFrame();
      opened.push(gl.open!);
      timer.endFrame();
    };

    for (let i = 0; i < 3; i++) runFrame();
    gl.finish(opened[0], 900_000_000); // an absurd 900 ms, the disjoint artifact
    gl.finish(opened[1], 5_000_000);

    gl.disjoint = true;
    expect(timer.beginFrame()).toEqual([]);
    const duringDisjoint = gl.open!;
    timer.endFrame();

    // And it recovers: honest frames after the interruption report normally.
    gl.disjoint = false;
    timer.beginFrame();
    const afterDisjoint = gl.open!;
    timer.endFrame();
    gl.finish(duringDisjoint, 4_000_000);
    gl.finish(afterDisjoint, 6_000_000);
    expect(frame(timer)).toEqual([4, 6]);
  });

  it('STOPS allocating queries rather than leaking one per frame', () => {
    /* The results never arrive in this test, which is what a stalled driver
     * looks like. An implementation that made a query per frame would allocate
     * GPU objects forever. */
    const { gl, timer } = start();
    for (let i = 0; i < 200; i++) frame(timer);
    expect(gl.created).toBeLessThanOrEqual(8);
  });

  it('releases every query it made', () => {
    const { gl, timer } = start();
    for (let i = 0; i < 5; i++) frame(timer);
    timer.dispose();
    expect(gl.deleted).toBe(gl.created);
    expect(gl.open).toBeNull();
  });

  it('goes quiet after disposal instead of touching a dead context', () => {
    const { timer } = start();
    frame(timer);
    timer.dispose();
    expect(frame(timer)).toEqual([]);
  });
});

describe('RollingMs', () => {
  it('reads nothing before any sample', () => {
    expect(new RollingMs().read()).toEqual({ meanMs: 0, p95Ms: 0, worstMs: 0, samples: 0 });
  });

  it('keeps the worst reading, which a mean would bury', () => {
    const s = new RollingMs();
    for (let i = 0; i < 99; i++) s.push(2);
    s.push(40);
    const r = s.read();
    expect(r.meanMs).toBeLessThan(3);
    expect(r.worstMs).toBe(40);
  });

  it('drops the oldest sample past its capacity', () => {
    const s = new RollingMs(3);
    s.push(9);
    s.push(1);
    s.push(1);
    s.push(1);
    expect(s.read()).toMatchObject({ samples: 3, worstMs: 1 });
  });
});
