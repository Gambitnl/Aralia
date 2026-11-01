/**
 * @file riverWorkerSpawn.ts
 * @description The ONE place that spawns the river worker threads (review task
 * C12, agora-9ed9.12).
 *
 * riverWorker.ts used to be spawned from two files: riverReachScene.ts (the
 * one-shot steady-field solve) and riverLiveClient.ts (the long-lived live
 * solver). Both now call these factories, so the worker URL, its module type and
 * any future spawn policy (naming, pooling, capability checks) have one owner.
 *
 * The literal `new Worker(new URL(...), { type: 'module' })` lines must stay in
 * this file: Vite discovers and bundles workers only from that literal form.
 * The message protocols are unchanged and still documented in riverWorker.ts
 * and riverMapWorker.ts.
 */
import type { WorkerFactory } from '@/workers/workerClient';

/** The flow solver: one-shot `{ seed, shape }` solves and `live-start` runs. */
export const spawnRiverWorker: WorkerFactory = () =>
  new Worker(new URL('./riverWorker.ts', import.meta.url), { type: 'module', name: 'river-solver' });

/** The live flow-map builder, paired with the live solver over a MessageChannel. */
export const spawnRiverMapWorker: WorkerFactory = () =>
  new Worker(new URL('./riverMapWorker.ts', import.meta.url), { type: 'module', name: 'river-map' });
