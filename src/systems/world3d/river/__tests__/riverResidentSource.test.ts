/** The resident GPU path takes a retarded source change at a step boundary,
 * like the CPU path, instead of the per-step synchronized fallback (2026-10-21).
 * The fake device changes no water; it only runs whole steps of maxDt. */
import { describe, expect, it } from 'vitest';
import { LiveRiver } from '../riverLive';
import type { RiverGpuResidentExecutor } from '../riverGpuResident';
import type { RiverGpuExecutor } from '../riverGpuStep';

describe('resident GPU source history', () => {
  it('ends an interval at the next released source change and never synchronizes for it', async () => {
    const live = new LiveRiver(20260928, true);
    live.warmNoise();
    live.startDry();
    const requested: { at: number; duration: number }[] = [];
    const execute: RiverGpuResidentExecutor = async input => {
      const dt = input.maxDt, span = input.duration ?? 0.2;
      const steps = Math.min(input.slots, Math.max(1, Math.ceil(span / dt - 1e-9)));
      requested.push({ at: live.simTime, duration: span });
      const journal = new Float32Array(steps * 8);
      for (let k = 0; k < steps; k++) journal.set([dt, 1, 0, 0, (k + 1) * dt, 0, 0, 0], k * 8);
      return { records: new Uint32Array(0), journal, steps, duration: steps * dt, inVolume: input.discharge * steps * dt, outVolume: 0,
        lastMaxSpeed: 1, awakeCells: 0, uploadBytes: 0, elapsedMs: 0 };
    };
    const synchronized: RiverGpuExecutor = async () => { throw Error('source history must not synchronize'); };
    const status = live.flood.source;
    const change = status.changes.find(c => c.timeS > live.simTime - status.flightDelayS);
    expect(change).toBeDefined();
    const arrival = change!.timeS + status.flightDelayS;
    while (live.simTime < arrival + 0.5) await live.advanceResidentOnGpu(execute, synchronized, 24);
    expect(live.residentSynchronization).toBeNull();
    // One interval ends exactly at the arrival; no interval spans it.
    expect(requested.some(r => Math.abs(r.at + r.duration - arrival) < 1e-9)).toBe(true);
    for (const r of requested) expect(r.at < arrival - 1e-9 && r.at + r.duration > arrival + 1e-9).toBe(false);
  }, 240000);
});
