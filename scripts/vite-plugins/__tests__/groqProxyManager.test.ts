/**
 * Groq dev-proxy key loader — auto-start resilience.
 *
 * The Vite dev server IS the "Local proxy" for Groq. It reads the API key from
 * Windows Credential Manager on first use and caches it. This suite pins the one
 * behavior that decides whether the proxy "auto-starts correctly": a missing key
 * must be cached only briefly. Immediate retries would repeatedly launch an
 * expensive credential process, while permanent caching would keep the proxy
 * keyless until the whole dev server restarts.
 *
 * The loader takes its reader by injection, so these run with a plain fake and
 * never touch Credential Manager or PowerShell.
 */
import { describe, expect, it, vi } from 'vitest';
import { createGroqKeyLoader, groqProxyManager } from '../groqProxyManager';

// ============================================================================
// Credential loader behavior
// ============================================================================
// These tests use an injected reader and clock so they can prove caching, shared
// concurrency, cooldown throttling, and recovery without reading a real secret.
// ============================================================================

describe('createGroqKeyLoader', () => {
  // A valid key should make later requests independent of Credential Manager.
  it('reads the key once and caches a successful result', async () => {
    const readKey = vi.fn().mockResolvedValue('gsk_realkey');
    const getKey = createGroqKeyLoader(readKey);

    expect(await getKey()).toBe('gsk_realkey');
    expect(await getKey()).toBe('gsk_realkey');
    // A cached success means the (expensive) credential read runs exactly once.
    expect(readKey).toHaveBeenCalledTimes(1);
  });

  // Simultaneous startup traffic should share one expensive external process.
  it('shares one in-flight read across concurrent first callers', async () => {
    const readKey = vi.fn().mockResolvedValue('gsk_realkey');
    const getKey = createGroqKeyLoader(readKey);

    const [a, b] = await Promise.all([getKey(), getKey()]);
    expect(a).toBe('gsk_realkey');
    expect(b).toBe('gsk_realkey');
    expect(readKey).toHaveBeenCalledTimes(1);
  });

  // Missing-key traffic should wait for the retry window instead of hammering.
  it('throttles sequential null reads during the missing-key cooldown', async () => {
    let currentTime = 10_000;
    const readKey = vi.fn().mockResolvedValue(null);
    const getKey = createGroqKeyLoader(readKey, {
      missingKeyRetryDelayMs: 1_000,
      now: () => currentTime,
    });

    // The first request performs the expensive read and starts the cooldown.
    expect(await getKey()).toBeNull();
    expect(readKey).toHaveBeenCalledTimes(1);

    // Sequential callers during the cooldown reuse the negative result without
    // launching another process, even immediately before the retry deadline.
    expect(await getKey()).toBeNull();
    currentTime += 999;
    expect(await getKey()).toBeNull();
    expect(readKey).toHaveBeenCalledTimes(1);
  });

  // A temporary miss must self-heal after the bounded retry window expires.
  it('retries after the cooldown and caches a recovered key', async () => {
    let currentTime = 20_000;
    // The first read finds no key; the first read after the deadline succeeds.
    const readKey = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValue('gsk_realkey');
    const getKey = createGroqKeyLoader(readKey, {
      missingKeyRetryDelayMs: 1_000,
      now: () => currentTime,
    });

    expect(await getKey()).toBeNull();
    expect(readKey).toHaveBeenCalledTimes(1);

    // The retry deadline restores access to Credential Manager, allowing the
    // proxy to self-heal without a dev-server restart.
    currentTime += 1_000;
    expect(await getKey()).toBe('gsk_realkey');
    expect(readKey).toHaveBeenCalledTimes(2);

    // And once a real key is in hand, it stays cached.
    expect(await getKey()).toBe('gsk_realkey');
    expect(readKey).toHaveBeenCalledTimes(2);
  });

  // Credential Manager's empty output has the same meaning as no result at all.
  it('treats an empty string like a missing read and throttles it', async () => {
    let currentTime = 30_000;
    const readKey = vi
      .fn()
      .mockResolvedValueOnce('')
      .mockResolvedValue('gsk_realkey');
    const getKey = createGroqKeyLoader(readKey, {
      missingKeyRetryDelayMs: 500,
      now: () => currentTime,
    });

    expect(await getKey()).toBeNull();
    expect(await getKey()).toBeNull();
    expect(readKey).toHaveBeenCalledTimes(1);

    // Empty output follows the same temporary recovery path as null output.
    currentTime += 500;
    expect(await getKey()).toBe('gsk_realkey');
    expect(readKey).toHaveBeenCalledTimes(2);
  });

  // A transient reader exception must not poison future credential attempts.
  it('does not cache a thrown read; a later call can still succeed', async () => {
    const readKey = vi
      .fn()
      .mockRejectedValueOnce(new Error('cred read exploded'))
      .mockResolvedValue('gsk_realkey');
    const getKey = createGroqKeyLoader(readKey);

    await expect(getKey()).rejects.toThrow('cred read exploded');
    expect(await getKey()).toBe('gsk_realkey');
    expect(readKey).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// Local process launch boundary
// ============================================================================
// These tests pin the narrow browser-to-server contract. The test injects a
// fake launcher, so no process is created and no credential is read.
// ============================================================================

describe('groqProxyManager proxy start route', () => {
  const captureMiddleware = (startProxy: (port: number) => Promise<void>) => {
    let middleware: ((req: object, res: object, next: () => void) => Promise<void>) | undefined;

    groqProxyManager(vi.fn(), startProxy).configureServer({
      middlewares: {
        use: (handler) => {
          middleware = async (req, res, next) => {
            await handler(req, res, next);
          };
        },
      },
    });

    return () => middleware!;
  };

  const createJsonRequest = (proxyUrl: string, overrides: Record<string, unknown> = {}) => ({
    url: '/__groq/start',
    method: 'POST',
    headers: {
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    socket: { remoteAddress: '127.0.0.1' },
    on: (event: string, callback: (chunk?: Buffer) => void) => {
      if (event === 'data') callback(Buffer.from(JSON.stringify({ proxyUrl })));
      if (event === 'end') callback();
    },
    ...overrides,
  });

  it('starts the fixed proxy launcher with the validated loopback port', async () => {
    const startProxy = vi.fn().mockResolvedValue(undefined);
    const getMiddleware = captureMiddleware(startProxy);
    const response = { writeHead: vi.fn(), end: vi.fn() };

    await getMiddleware()(
      createJsonRequest('http://localhost:8787/v1'),
      response,
      vi.fn(),
    );

    expect(startProxy).toHaveBeenCalledWith(8787);
    expect(response.writeHead).toHaveBeenCalledWith(202, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ ok: true, port: 8787 }));
  });

  it('rejects a remote target before it reaches the process launcher', async () => {
    const startProxy = vi.fn().mockResolvedValue(undefined);
    const getMiddleware = captureMiddleware(startProxy);
    const response = { writeHead: vi.fn(), end: vi.fn() };

    await getMiddleware()(
      createJsonRequest('https://api.groq.com/openai/v1'),
      response,
      vi.fn(),
    );

    expect(startProxy).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
  });

  it('rejects a cross-origin browser request even when its target is loopback', async () => {
    const startProxy = vi.fn().mockResolvedValue(undefined);
    const getMiddleware = captureMiddleware(startProxy);
    const response = { writeHead: vi.fn(), end: vi.fn() };

    await getMiddleware()(
      createJsonRequest('http://localhost:8787/v1', {
        headers: {
          origin: 'http://malicious.example',
          host: 'localhost:3000',
          'content-type': 'application/json',
        },
      }),
      response,
      vi.fn(),
    );

    expect(startProxy).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'application/json' });
  });
});

// ============================================================================
// Middleware failure boundary
// ============================================================================
// Credential-reader exceptions must become a controlled server response. The
// response deliberately omits exception details so no secret can cross to the UI.
// ============================================================================

describe('groqProxyManager credential failures', () => {
  // Browser callers receive a stable retry signal, never internal exception text.
  it('returns a generic retryable response when the credential reader rejects', async () => {
    const loadKey = vi.fn().mockRejectedValue(new Error('private credential-reader detail'));
    let middleware: ((req: object, res: object, next: () => void) => Promise<void>) | undefined;

    // Capture the middleware through the same registration path Vite uses, while
    // wrapping its runtime promise so the test waits for the final response.
    groqProxyManager(loadKey).configureServer({
      middlewares: {
        use: (handler) => {
          middleware = async (req, res, next) => {
            await handler(req, res, next);
          };
        },
      },
    });

    const response = {
      writeHead: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    // Exercise a real proxy route: before this repair the rejected key promise
    // escaped before the existing upstream-request try/catch could respond.
    await middleware!({ url: '/__groq/v1/chat/completions', headers: {} }, response, next);

    expect(response.writeHead).toHaveBeenCalledWith(503, { 'Content-Type': 'application/json' });
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({
      error: 'Groq credential store is temporarily unavailable; retry shortly',
    }));
    expect(response.end.mock.calls[0]?.[0]).not.toContain('private credential-reader detail');
    expect(next).not.toHaveBeenCalled();
  });
});
