import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebGpuPassTimer } from '../webGpuTimer';

function fixture(hold = false) {
  vi.stubGlobal('GPUBufferUsage', { QUERY_RESOLVE: 1, COPY_SRC: 2, COPY_DST: 4, MAP_READ: 8 });
  vi.stubGlobal('GPUMapMode', { READ: 1 });
  const descriptors: any[] = [], resources: any[] = [], releases: (() => void)[] = [];
  let counter = 1_000_000n;
  const device: any = {
    features: new Set(['timestamp-query']), queue: { submit: vi.fn() },
    createQuerySet: () => {
      const q = { values: new BigUint64Array(512), destroy: vi.fn() }; resources.push(q); return q;
    },
    createBuffer: () => {
      const b = { data: new BigUint64Array(512), destroy: vi.fn(), unmap: vi.fn(),
        getMappedRange: () => b.data.buffer,
        mapAsync: () => hold ? new Promise<void>(resolve => releases.push(resolve)) : Promise.resolve(),
      }; resources.push(b); return b;
    },
    createCommandEncoder() {
      const pass = (d: any) => {
        descriptors.push(d);
        const t = d.timestampWrites;
        if (t) {
          t.querySet.values[t.beginningOfPassWriteIndex] = counter;
          t.querySet.values[t.endOfPassWriteIndex] = counter + 2_000_000n;
          counter += 3_000_000n;
        }
        return { end() {} };
      };
      return { beginRenderPass: pass, beginComputePass: pass,
        resolveQuerySet: (q: any, _first: number, _count: number, b: any) => { b.data = q.values.slice(); },
        copyBufferToBuffer: (a: any, _offset: number, b: any) => { b.data = a.data.slice(); },
        finish: () => ({}),
      };
    },
  };
  return { device, descriptors, resources, releases };
}

afterEach(() => vi.unstubAllGlobals());
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('WebGpuPassTimer', () => {
  it('adds every physical pass to its logical render, without mutating native descriptors', async () => {
    const f = fixture(); const original = f.device.createCommandEncoder;
    const timer = WebGpuPassTimer.forRenderer({ backend: { device: f.device } })!;
    const d = { colorAttachments: [], label: 'native' };
    timer.begin(7, 0);
    const encoder = f.device.createCommandEncoder();
    encoder.beginRenderPass(d); encoder.beginRenderPass(d); // native render + mip
    timer.pause(); timer.begin(7, 1); encoder.beginComputePass({});
    timer.closeFrame(7);
    expect(timer.collect()).toEqual([]); // no synchronous readback in draw
    await flush();
    expect(timer.collect()).toEqual([{ frame: 7, totalMs: 6, passes: new Map([[0, 4], [1, 2]]) }]);
    expect(d).not.toHaveProperty('timestampWrites');
    timer.dispose(); expect(f.device.createCommandEncoder).toBe(original);
    expect(f.resources.every(r => r.destroy.mock.calls.length === 1)).toBe(true);
  });

  it('skips whole frames when its fixed readback pool is occupied, then recovers', async () => {
    const f = fixture(true); const timer = WebGpuPassTimer.forRenderer({ backend: { device: f.device } })!;
    for (let frame = 0; frame < 6; frame++) {
      timer.begin(frame, 0); f.device.createCommandEncoder().beginRenderPass({ colorAttachments: [] }); timer.closeFrame(frame);
    }
    expect(f.resources).toHaveLength(12); expect(f.releases).toHaveLength(4);
    expect(f.descriptors.filter(d => d.timestampWrites)).toHaveLength(4);
    f.releases.splice(0).forEach(resolve => resolve()); await flush();
    expect(timer.collect().map(r => r.frame)).toEqual([0, 1, 2, 3]);
    timer.begin(6, 0); f.device.createCommandEncoder().beginRenderPass({ colorAttachments: [] }); timer.closeFrame(6);
    f.releases.splice(0).forEach(resolve => resolve()); await flush();
    expect(timer.collect()[0].frame).toBe(6); timer.dispose();
  });

  it('rejects partial frames on existing timestamp ownership, overflow or reset counters', async () => {
    const f = fixture(); const timer = WebGpuPassTimer.forRenderer({ backend: { device: f.device } })!;
    timer.begin(0, 0); const encoder = f.device.createCommandEncoder();
    encoder.beginRenderPass({ colorAttachments: [] });
    const owned = { colorAttachments: [], timestampWrites: { querySet: { values: new BigUint64Array(2) }, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } };
    encoder.beginRenderPass(owned); timer.closeFrame(0); await flush(); expect(timer.collect()).toEqual([]);
    expect(f.descriptors.at(-1)).toBe(owned);
    timer.begin(1, 0); for (let i = 0; i < 257; i++) encoder.beginRenderPass({ colorAttachments: [] });
    timer.closeFrame(1); await flush(); expect(timer.collect()).toEqual([]);
    timer.begin(2, 0); encoder.beginRenderPass({ colorAttachments: [] });
    const writes = f.descriptors.at(-1).timestampWrites; writes.querySet.values[1] = 0n;
    timer.closeFrame(2); await flush(); expect(timer.collect()).toEqual([]); timer.dispose();
  });

  it('respects capability and owner boundaries, and ignores pending results after disposal', async () => {
    const f = fixture(true);
    expect(WebGpuPassTimer.forRenderer({ backend: { device: { features: new Set() } } })).toBeNull();
    expect(WebGpuPassTimer.forRenderer({ backend: { device: f.device, trackTimestamp: true } })).toBeNull();
    const timer = WebGpuPassTimer.forRenderer({ backend: { device: f.device } })!;
    expect(WebGpuPassTimer.forRenderer({ backend: { device: f.device } })).toBeNull();
    timer.begin(0, 0); f.device.createCommandEncoder().beginRenderPass({ colorAttachments: [] }); timer.closeFrame(0);
    timer.dispose(); f.releases.forEach(resolve => resolve()); await flush(); expect(timer.collect()).toEqual([]);
    const again = WebGpuPassTimer.forRenderer({ backend: { device: f.device } })!; expect(again).not.toBeNull(); again.dispose();
  });

  it('keeps drawing after partial GPU resource allocation fails', () => {
    const f = fixture(); f.device.createBuffer = vi.fn(() => { throw new Error('lost device'); });
    const timer = WebGpuPassTimer.forRenderer({ backend: { device: f.device } })!;
    for (let frame = 0; frame < 3; frame++) {
      expect(() => {
        timer.begin(frame, 0); f.device.createCommandEncoder().beginRenderPass({ colorAttachments: [] }); timer.closeFrame(frame);
      }).not.toThrow();
    }
    expect(f.device.createBuffer).toHaveBeenCalledOnce();
    expect(f.resources[0].destroy).toHaveBeenCalledOnce();
    expect(f.descriptors).toHaveLength(3); expect(timer.collect()).toEqual([]); timer.dispose();
  });

  it('captures paired offscreen sections separately and restores an open HUD frame', async () => {
    const f=fixture(),timer=WebGpuPassTimer.forRenderer({backend:{device:f.device}})!;
    const draw=()=>f.device.createCommandEncoder().beginRenderPass({colorAttachments:[]});
    timer.begin(20,7);draw();
    const pair=await timer.capture(section=>{section(0,()=>{draw();draw();});section(1,draw);});
    draw();timer.closeFrame(20);await flush();
    expect(pair).toEqual(new Map([[0,4],[1,2]]));
    expect(timer.collect()).toEqual([{frame:20,totalMs:4,passes:new Map([[7,4]])}]);
    timer.dispose();
  });
  it('returns unknown while a capture is pending and cancels on disposal', async () => {
    const f=fixture(true),timer=WebGpuPassTimer.forRenderer({backend:{device:f.device}})!;
    const draw=()=>f.device.createCommandEncoder().beginRenderPass({colorAttachments:[]});
    const pending=timer.capture(section=>section(0,draw));
    expect(await timer.capture(section=>section(0,draw))).toBeNull();
    timer.dispose();f.releases.forEach(release=>release());
    expect(await pending).toBeNull();
  });
  it('restores normal timestamp ownership after a diagnostic draw throws', async () => {
    const f=fixture(),timer=WebGpuPassTimer.forRenderer({backend:{device:f.device}})!;
    const draw=()=>f.device.createCommandEncoder().beginRenderPass({colorAttachments:[]});
    timer.begin(10,3);
    await expect(timer.capture(section=>section(0,()=>{draw();throw Error('draw failed');}))).rejects.toThrow('draw failed');
    draw();timer.closeFrame(10);await flush();
    expect(timer.collect()).toEqual([{frame:10,totalMs:2,passes:new Map([[3,2]])}]);timer.dispose();
  });

  it('keeps a dedicated diagnostic slot when all four HUD readbacks are busy', async () => {
    const f=fixture(true),timer=WebGpuPassTimer.forRenderer({backend:{device:f.device}})!;
    const draw=()=>f.device.createCommandEncoder().beginRenderPass({colorAttachments:[]});
    for(let frame=0;frame<4;frame++){timer.begin(frame,0);draw();timer.closeFrame(frame);}
    const pending=timer.capture(section=>{section(0,draw);section(1,draw);});
    expect(f.resources).toHaveLength(15);expect(f.releases).toHaveLength(5);
    f.releases.splice(0).forEach(release=>release());
    expect(await pending).toEqual(new Map([[0,2],[1,2]]));await flush();
    expect(timer.collect()).toHaveLength(4);
    // Repeated comparisons reuse the fifth slot rather than growing the pool.
    const second=timer.capture(section=>section(0,draw));expect(f.resources).toHaveLength(15);
    f.releases.splice(0).forEach(release=>release());expect(await second).toEqual(new Map([[0,2]]));timer.dispose();
  });
});
