/**
 * Host-side client for staged, off-thread 3D world entry. It owns the world-gen
 * worker, posts a request, and streams the two stages back to the consumer —
 * rebuilding the (cheap) loader closure from the worker's `ground` data on
 * Stage A, and patching props into that same ground on Stage B.
 *
 * These are protocol unit tests: a fully controllable fake worker lets each
 * message be delivered by hand, so correlation, supersession, and disposal are
 * deterministic. Loader correctness lives in groundChunkLoaderStaged.test.ts.
 *
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */
import { describe, it, expect } from 'vitest';
import { createWorldGenClient } from '../createWorldGenClient';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { PropInstance } from '@/systems/worldforge/props/propSchema';

/** A fake Worker whose messages are delivered manually via `emit`. */
class FakeWorker {
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  sent: Array<{ type: string; id: number; req?: unknown }> = [];
  terminated = false;
  postMessage(msg: { type: string; id: number; req?: unknown }) {
    this.sent.push(msg);
  }
  emit(data: unknown) {
    this.onmessage?.({ data });
  }
  terminate() {
    this.terminated = true;
  }
}

const cannedGround = (): GroundWorld => ({ props: [], buildings: [] } as unknown as GroundWorld);
const cannedProps = (): PropInstance[] => ([{ defId: 'crate' }] as unknown as PropInstance[]);
const req = { wfSeed: 42, entryCellId: 7, centerPx: [10, 20] as [number, number], hour: 12 };

describe('createWorldGenClient', () => {
  it('posts a generate request and streams Stage A (with a rebuilt loader) then Stage B', () => {
    const fw = new FakeWorker();
    const client = createWorldGenClient(() => fw as unknown as Worker);
    const calls: string[] = [];
    let stageA: { ground: GroundWorld; local: unknown; region: unknown; loader: unknown } | null = null;
    let stageBGround: GroundWorld | null = null;

    client.generate(req, {
      onStageA: (r) => { stageA = r; calls.push('A'); },
      onStageB: (g) => { stageBGround = g; calls.push('B'); },
    });

    // The client posted a correlated generate request carrying the payload.
    expect(fw.sent).toHaveLength(1);
    expect(fw.sent[0].type).toBe('generate');
    expect(fw.sent[0].req).toEqual(req);
    const id = fw.sent[0].id;

    const ground = cannedGround();
    fw.emit({ type: 'stageA', id, ground, local: { L: 1 }, region: { R: 1 } });
    fw.emit({ type: 'stageB', id, props: cannedProps() });

    expect(calls).toEqual(['A', 'B']);
    // Stage A rebuilt a loader from the ground and passed the artifacts through.
    expect(typeof stageA!.loader).toBe('function');
    expect(stageA!.local).toEqual({ L: 1 });
    expect(stageA!.region).toEqual({ R: 1 });
    expect(stageA!.ground).toBe(ground);
    // Stage B patched props INTO the same ground object the scene already holds.
    expect(stageBGround).toBe(ground);
    expect(stageBGround!.props).toEqual(cannedProps());
  });

  it('ignores responses from a superseded request (only the latest id is live)', () => {
    const fw = new FakeWorker();
    const client = createWorldGenClient(() => fw as unknown as Worker);
    const first: string[] = [];
    const second: string[] = [];

    client.generate(req, { onStageA: () => first.push('A'), onStageB: () => first.push('B') });
    const id1 = fw.sent[0].id;
    client.generate({ ...req, entryCellId: 9 }, { onStageA: () => second.push('A'), onStageB: () => second.push('B') });
    const id2 = fw.sent[1].id;
    expect(id2).not.toBe(id1);

    // Late replies from the first (superseded) request must be dropped.
    fw.emit({ type: 'stageA', id: id1, ground: cannedGround(), local: {}, region: {} });
    fw.emit({ type: 'stageB', id: id1, props: cannedProps() });
    // The live request's replies are delivered.
    fw.emit({ type: 'stageA', id: id2, ground: cannedGround(), local: {}, region: {} });
    fw.emit({ type: 'stageB', id: id2, props: cannedProps() });

    expect(first).toEqual([]);
    expect(second).toEqual(['A', 'B']);
  });

  it('after dispose, delivers no callbacks and terminates the worker', () => {
    const fw = new FakeWorker();
    const client = createWorldGenClient(() => fw as unknown as Worker);
    const calls: string[] = [];

    client.generate(req, { onStageA: () => calls.push('A'), onStageB: () => calls.push('B') });
    const id = fw.sent[0].id;
    client.dispose();

    fw.emit({ type: 'stageA', id, ground: cannedGround(), local: {}, region: {} });
    fw.emit({ type: 'stageB', id, props: cannedProps() });

    expect(calls).toEqual([]);
    expect(fw.terminated).toBe(true);
  });

  it('forwards a progress message for the live request via onProgress', () => {
    const fw = new FakeWorker();
    const client = createWorldGenClient(() => fw as unknown as Worker);
    const stages: string[] = [];

    client.generate(req, {
      onStageA: () => {},
      onStageB: () => {},
      onProgress: (s) => stages.push(s),
    });
    const id = fw.sent[0].id;
    fw.emit({ type: 'progress', id, stage: 'town' });

    expect(stages).toEqual(['town']);
  });

  it('reports a worker error for the live request via onError', () => {
    const fw = new FakeWorker();
    const client = createWorldGenClient(() => fw as unknown as Worker);
    let errMsg: string | null = null;

    client.generate(req, { onStageA: () => {}, onStageB: () => {}, onError: (m) => { errMsg = m; } });
    const id = fw.sent[0].id;
    fw.emit({ type: 'error', id, message: 'village entry failed: boom' });

    expect(errMsg).toBe('village entry failed: boom');
  });
});
