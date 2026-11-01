import { describe, it, expect, vi } from 'vitest';
import {
  createWorkerClient,
  runWorkerTask,
  liveWorkerCount,
  type WorkerFactory,
} from '../workerClient';

/**
 * Fake in-memory Worker implementation for testing lifecycle, messaging,
 * errors, and termination.
 */
class TestWorker {
  onmessage: ((ev: { data: any }) => void) | null = null;
  onerror: ((ev: { message: string }) => void) | null = null;
  onmessageerror: ((ev: any) => void) | null = null;
  postedMessages: any[] = [];
  terminated = false;

  postMessage(msg: any) {
    this.postedMessages.push(msg);
  }

  simulateMessage(data: any) {
    queueMicrotask(() => this.onmessage?.({ data }));
  }

  simulateError(message: string) {
    queueMicrotask(() => this.onerror?.({ message }));
  }

  terminate() {
    this.terminated = true;
  }
}

describe('workerClient', () => {
  it('ignores saved callbacks from a retired worker generation', () => {
    const baseline = liveWorkerCount();
    const workers: TestWorker[] = [];
    const received = vi.fn();
    const errors = vi.fn();
    const client = createWorkerClient({
      factory: () => {
        const worker = new TestWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
      onMessage: received,
      onError: errors,
    });
    const oldMessage = workers[0].onmessage!;
    const oldError = workers[0].onerror!;
    const oldMessageError = workers[0].onmessageerror!;
    oldError({ message: 'first crash' });
    client.post({ resume: true });
    oldMessage({ data: 'obsolete result' });
    oldMessageError({ message: 'obsolete decode failure' });
    oldError({ message: 'obsolete crash' });
    expect(received).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(workers[1].terminated).toBe(false);
    expect(client.worker).toBe(workers[1]);
    expect(workers[0].onmessage).toBeNull();
    client.dispose();
    expect(liveWorkerCount()).toBe(baseline);
  });

  it('initializes each generation before its first request and warms without posting', () => {
    const workers: TestWorker[] = [];
    const client = createWorkerClient<{ type: string }, unknown>({
      factory: () => {
        const worker = new TestWorker();
        workers.push(worker);
        return worker as unknown as Worker;
      },
      lazy: true,
      onMessage: vi.fn(),
      onSpawn: (post) => post({ type: 'init' }),
    });
    client.start();
    expect(workers[0].postedMessages).toEqual([{ type: 'init' }]);
    client.post({ type: 'load' });
    workers[0].onerror!({ message: 'crash' });
    client.start();
    client.post({ type: 'retry' });
    expect(workers[1].postedMessages).toEqual([{ type: 'init' }, { type: 'retry' }]);
    client.dispose();
    client.start();
    expect(workers).toHaveLength(2);
  });

  it('releases the worker when initialization throws before returning a client', () => {
    const baseline = liveWorkerCount();
    const worker = new TestWorker();
    expect(() => createWorkerClient({
      factory: () => worker as unknown as Worker,
      onMessage: vi.fn(),
      onSpawn: () => { throw new Error('init failed'); },
    })).toThrow('init failed');
    expect(worker.terminated).toBe(true);
    expect(liveWorkerCount()).toBe(baseline);
  });

  it('tracks liveWorkerCount through createWorkerClient lifecycle', () => {
    const baseline = liveWorkerCount();
    let workerInstance: TestWorker | null = null;
    const factory: WorkerFactory = () => {
      workerInstance = new TestWorker();
      return workerInstance as unknown as Worker;
    };

    const client = createWorkerClient({
      factory,
      onMessage: vi.fn(),
    });

    expect(liveWorkerCount()).toBe(baseline + 1);
    expect(client.disposed).toBe(false);
    expect(workerInstance).not.toBeNull();
    expect(workerInstance!.terminated).toBe(false);

    client.dispose();
    expect(client.disposed).toBe(true);
    expect(workerInstance!.terminated).toBe(true);
    expect(liveWorkerCount()).toBe(baseline);

    // Idempotent dispose
    client.dispose();
    expect(liveWorkerCount()).toBe(baseline);
  });

  it('posts and receives typed messages', async () => {
    let workerInstance: TestWorker | null = null;
    const onMessage = vi.fn();
    const client = createWorkerClient<{ cmd: string }, { result: number }>({
      factory: () => {
        workerInstance = new TestWorker();
        return workerInstance as unknown as Worker;
      },
      onMessage,
    });

    client.post({ cmd: 'compute' });
    expect(workerInstance!.postedMessages).toEqual([{ cmd: 'compute' }]);

    workerInstance!.simulateMessage({ result: 42 });
    await new Promise((r) => setTimeout(r, 10));

    expect(onMessage).toHaveBeenCalledWith({ result: 42 });
    client.dispose();
  });

  it('formats and prefixes errors via onError', async () => {
    let workerInstance: TestWorker | null = null;
    const onError = vi.fn();
    const client = createWorkerClient({
      factory: () => {
        workerInstance = new TestWorker();
        return workerInstance as unknown as Worker;
      },
      onMessage: vi.fn(),
      onError,
      errorPrefix: '[test-worker]',
    });

    workerInstance!.simulateError('out of bounds memory access');
    await new Promise((r) => setTimeout(r, 10));

    expect(onError).toHaveBeenCalledWith('[test-worker]: out of bounds memory access');
    client.dispose();
  });

  it('supports lazy spawn on first post()', () => {
    const baseline = liveWorkerCount();
    let spawned = false;
    const client = createWorkerClient({
      factory: () => {
        spawned = true;
        return new TestWorker() as unknown as Worker;
      },
      onMessage: vi.fn(),
      lazy: true,
    });

    expect(spawned).toBe(false);
    expect(liveWorkerCount()).toBe(baseline);

    client.post({ test: true });
    expect(spawned).toBe(true);
    expect(liveWorkerCount()).toBe(baseline + 1);

    client.dispose();
    expect(liveWorkerCount()).toBe(baseline);
  });

  it('respawns worker lazily on next post() after worker death (onerror)', async () => {
    const baseline = liveWorkerCount();
    let instanceCount = 0;
    let currentWorker: TestWorker | null = null;
    const client = createWorkerClient({
      factory: () => {
        instanceCount++;
        currentWorker = new TestWorker();
        return currentWorker as unknown as Worker;
      },
      onMessage: vi.fn(),
    });

    expect(instanceCount).toBe(1);
    expect(liveWorkerCount()).toBe(baseline + 1);
    const firstWorker = currentWorker!;

    // Simulate crash
    firstWorker.simulateError('worker crash');
    await new Promise((r) => setTimeout(r, 10));

    // First worker terminated and cleaned up from live count
    expect(firstWorker.terminated).toBe(true);
    expect(liveWorkerCount()).toBe(baseline);

    // Calling post() respawns a fresh worker
    client.post({ resume: true });
    expect(instanceCount).toBe(2);
    expect(currentWorker).not.toBe(firstWorker);
    expect(liveWorkerCount()).toBe(baseline + 1);

    client.dispose();
    expect(liveWorkerCount()).toBe(baseline);
  });
});

describe('runWorkerTask', () => {
  it('resolves one-shot task and cleans up worker', async () => {
    const baseline = liveWorkerCount();
    let workerInstance: TestWorker | null = null;

    const promise = runWorkerTask<
      { seed: number },
      { type: string; value?: string; progress?: number },
      string
    >({
      factory: () => {
        workerInstance = new TestWorker();
        return workerInstance as unknown as Worker;
      },
      request: { seed: 123 },
      handle: (msg, settle) => {
        if (msg.type === 'progress') {
          // ignore progress
        } else if (msg.type === 'done') {
          settle.resolve(msg.value!);
        }
      },
    });

    expect(liveWorkerCount()).toBe(baseline + 1);
    expect(workerInstance!.postedMessages).toEqual([{ seed: 123 }]);

    workerInstance!.simulateMessage({ type: 'progress', progress: 0.5 });
    workerInstance!.simulateMessage({ type: 'done', value: 'hello' });

    const result = await promise;
    expect(result).toBe('hello');
    expect(workerInstance!.terminated).toBe(true);
    expect(liveWorkerCount()).toBe(baseline);
  });

  it('rejects on handle error and terminates worker', async () => {
    const baseline = liveWorkerCount();
    let workerInstance: TestWorker | null = null;

    const promise = runWorkerTask({
      factory: () => {
        workerInstance = new TestWorker();
        return workerInstance as unknown as Worker;
      },
      request: { start: true },
      handle: (msg: { error?: string }, settle) => {
        if (msg.error) settle.reject(new Error(msg.error));
      },
    });

    workerInstance!.simulateMessage({ error: 'failed compute' });

    await expect(promise).rejects.toThrow('failed compute');
    expect(workerInstance!.terminated).toBe(true);
    expect(liveWorkerCount()).toBe(baseline);
  });

  it('rejects when worker emits error event', async () => {
    const baseline = liveWorkerCount();
    let workerInstance: TestWorker | null = null;

    const promise = runWorkerTask({
      factory: () => {
        workerInstance = new TestWorker();
        return workerInstance as unknown as Worker;
      },
      request: {},
      errorPrefix: '[task-runner]',
      handle: () => {},
    });

    workerInstance!.simulateError('fatal worker crash');

    await expect(promise).rejects.toThrow('[task-runner]: fatal worker crash');
    expect(workerInstance!.terminated).toBe(true);
    expect(liveWorkerCount()).toBe(baseline);
  });

  it('aborts when signal is triggered', async () => {
    const baseline = liveWorkerCount();
    const controller = new AbortController();

    const promise = runWorkerTask({
      factory: () => new TestWorker() as unknown as Worker,
      request: {},
      signal: controller.signal,
      handle: () => {},
    });

    controller.abort();

    await expect(promise).rejects.toThrow('Worker task aborted');
    expect(liveWorkerCount()).toBe(baseline);
  });

  it('terminates worker and cleans up live count when postMessage throws synchronously', async () => {
    const baseline = liveWorkerCount();
    let terminated = 0;
    const worker = {
      postMessage() {
        throw new Error('simulated DataCloneError');
      },
      terminate() {
        terminated++;
      },
      onmessage: null,
      onerror: null,
      onmessageerror: null,
    };

    const promise = runWorkerTask({
      factory: () => worker as unknown as Worker,
      request: {},
      handle: () => {},
    });

    await expect(promise).rejects.toThrow('simulated DataCloneError');
    expect(terminated).toBe(1);
    expect(liveWorkerCount()).toBe(baseline);
  });
});

// Feature-specific wording is optional; all original default-message tests above
// still run against the unchanged default contract.
describe('one-shot feature error wording', () => {
  it.each(['onerror', 'onmessageerror'] as const)('formats %s and still terminates exactly once', async (eventName) => {
    const baseline = liveWorkerCount();
    const worker = new TestWorker();
    const formatter = vi.fn(() => 'Atlas preparation worker failed.');
    const promise = runWorkerTask({
      factory: () => worker as unknown as Worker,
      request: {},
      formatError: formatter,
      handle: () => {},
    });
    const event = { message: '' };
    worker[eventName]!(event);
    await expect(promise).rejects.toThrow('Atlas preparation worker failed.');
    expect(formatter).toHaveBeenCalledExactlyOnceWith(event);
    expect(worker.terminated).toBe(true);
    expect(liveWorkerCount()).toBe(baseline);
  });
});
