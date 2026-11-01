/** Mapper protocol tests use a small hydraulic fixture and the native receiving
 * refiner. Hydraulic numerical equivalence has its own solver tests. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RiverReceivingConfiguration, RiverViewFlowSnapshot } from '@/components/World3D/water/riverReceivingRefiner';

vi.mock('../riverLive', () => ({
  LiveFlowMapper: class {
    applyPatch(): void { /* No terrain edit needed for these protocol fixtures. */ }
    map(frame: { id: number; dtS: number }): unknown {
      const t0h = new Uint16Array(64), t1h = new Uint16Array(64), t2h = new Uint16Array(64);
      for (let k = 0; k < 16; k++) { t0h[k * 4] = 0x4133; t2h[k * 4 + 2] = 0x3c00; }
      // `timings`: the worker records its own stage times on the picture.
      return { id: frame.id, dtS: frame.dtS, simTime: frame.id, ms: 7, timings: {}, t0h, t1h, t2h,
        surface: new Float32Array(16).fill(0.1), sheet: {
          pos: new Float32Array([1,0.1,1,2,0.1,1,1,0.1,2,2,0.1,2]),
          nor: new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]), index: new Uint32Array([0,2,1,1,2,3]),
        } };
    }
  },
  liveSnapshotTransfer: (s: RiverViewFlowSnapshot) => [s.t0h.buffer, s.t1h.buffer, s.t2h.buffer,
    s.surface.buffer, s.sheet.pos.buffer, s.sheet.nor.buffer, s.sheet.index.buffer],
}));

type Packet = { type: string; snap: RiverViewFlowSnapshot & { id: number; dtS: number } };
const grid = { nx: 4, nz: 4, dx: 1, x0: 0, z0: 0 };
const config = (): RiverReceivingConfiguration => {
  const mask = new Uint8Array(64);
  for (let k = 0; k < 16; k++) mask[k * 4] = mask[k * 4 + 3] = 255;
  return { grid, mask, maskVersion: 1, configId: 'view-on', enabled: true };
};
const outputs: Packet[] = [];
let scope: { onmessage: ((event: { data: unknown }) => void) | null; postMessage: (packet: Packet, transfer: Transferable[]) => void };
let port: { onmessage: ((event: { data: unknown }) => void) | null };
const page = (data: unknown) => scope.onmessage!({ data });
const field = (id: number, dtS = 1) => port.onmessage!({ data: { type: 'frame', frame: { id, dtS } } });
const flush = () => vi.runOnlyPendingTimers();

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); outputs.length = 0;
  scope = { onmessage: null, postMessage: (packet, transfer) => outputs.push(structuredClone(packet, { transfer })) };
  port = { onmessage: null };
  vi.stubGlobal('WorkerGlobalScope', function WorkerGlobalScope() {});
  vi.stubGlobal('self', scope);
  await import('../riverMapWorker');
  page({ type: 'port', port });
  page({ type: 'receiving', receiving: config() });
  port.onmessage!({ data: { type: 'init', init: { grid } } });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('receiving mapper delivery', () => {
  it('keeps one unacknowledged snapshot and carries all elapsed time into the latest pending field', () => {
    field(1); flush();
    expect(outputs[0].snap.preparedReceiving?.mainStandingTriangles.length).toBeGreaterThan(0);
    expect(outputs[0].snap.sheet.pos.byteLength).toBeGreaterThan(0);
    field(2); field(3, 2); flush();
    expect(outputs).toHaveLength(1);
    page({ type: 'ack' }); flush();
    expect(outputs).toHaveLength(2);
    expect(outputs[1].snap).toMatchObject({ id: 3, dtS: 3 });
  });

  it('replaces ownership before refining and rejects work from the previous configuration', async () => {
    field(1); flush();
    const previous = outputs[0].snap.preparedReceiving;
    page({ type: 'receiving', receiving: { ...config(), mask: new Uint8Array(64), maskVersion: 2, configId: 'new-mask' } });
    field(2); page({ type: 'ack' }); flush();
    expect(outputs[1].snap.preparedReceiving).toMatchObject({ maskVersion: 2, configId: 'new-mask' });
    expect(outputs[1].snap.preparedReceiving?.mainStandingTriangles).toHaveLength(0);
    const { receivingSheetMatches } = await import('@/components/World3D/water/riverReceivingRefiner');
    expect(receivingSheetMatches(previous, 1, true, 'replacement-view')).toBe(false);
  });

  it('delivers the base field after invalid configuration, then recovers when disabled', () => {
    page({ type: 'receiving', receiving: { ...config(), grid: { ...grid, dx: 2 } } });
    field(1); flush();
    expect(outputs[0].type).toBe('snapshot');
    expect(outputs[0].snap.preparedReceiving).toBeUndefined();
    expect(outputs[0].snap.receivingError).toMatch(/grid differs/);
    expect(outputs[0].snap.sheet.pos.byteLength).toBe(48);
    page({ type: 'receiving', receiving: { ...config(), enabled: false, mask: null } });
    field(2); page({ type: 'ack' }); flush();
    expect(outputs[1].snap.receivingError).toBeUndefined();
    expect(outputs[1].snap.preparedReceiving).toBeUndefined();
  });

  it('keeps the ACK contract when native refinement throws', async () => {
    const { RiverReceivingRefiner } = await import('@/components/World3D/water/riverReceivingRefiner');
    vi.spyOn(RiverReceivingRefiner.prototype, 'refine').mockImplementation(() => { throw new Error('derived failure'); });
    field(1); flush(); field(2); flush();
    expect(outputs).toHaveLength(1);
    expect(outputs[0].snap).toMatchObject({ id: 1, receivingError: 'derived failure' });
    page({ type: 'ack' }); flush();
    expect(outputs[1].snap).toMatchObject({ id: 2, receivingError: 'derived failure' });
    expect(outputs[1].snap.t0h.byteLength).toBe(128);
  });
});
