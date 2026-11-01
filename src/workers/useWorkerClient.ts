/**
 * @file useWorkerClient.ts
 * @description React wrapper around createWorkerClient (review task C12).
 *
 * The worker is created when the component mounts and ALWAYS terminated when
 * it unmounts, so leaving a screen cannot leak a worker. The latest onMessage /
 * onError callbacks are read through refs, so re-renders do not respawn the
 * worker. React StrictMode's mount-unmount-mount in development creates and
 * disposes one extra worker; that is expected and is what proves cleanup works.
 */
import { useEffect, useRef, useState } from 'react';
import { createWorkerClient, type WorkerClient, type WorkerFactory } from './workerClient';

export interface UseWorkerClientOptions<Res> {
  factory: WorkerFactory;
  onMessage: (msg: Res) => void;
  onError?: (message: string) => void;
  errorPrefix?: string;
  /** When false, no worker is created (and any existing one is disposed). */
  enabled?: boolean;
}

/** Returns the live client, or null before mount / while disabled. */
export function useWorkerClient<Req, Res>(opts: UseWorkerClientOptions<Res>): WorkerClient<Req> | null {
  const onMessageRef = useRef(opts.onMessage);
  const onErrorRef = useRef(opts.onError);
  onMessageRef.current = opts.onMessage;
  onErrorRef.current = opts.onError;

  // The factory is captured at first enable; a factory is a fixed spawn line,
  // so changing it between renders is not supported (it would be a new feature).
  const factoryRef = useRef(opts.factory);
  const enabled = opts.enabled ?? true;
  const errorPrefix = opts.errorPrefix;
  const [client, setClient] = useState<WorkerClient<Req> | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const c = createWorkerClient<Req, Res>({
      factory: factoryRef.current,
      onMessage: (msg) => onMessageRef.current(msg),
      onError: (message) => onErrorRef.current?.(message),
      errorPrefix,
    });
    setClient(c);
    return () => {
      c.dispose();
      setClient((current) => (current === c ? null : current));
    };
  }, [enabled, errorPrefix]);

  return client;
}
