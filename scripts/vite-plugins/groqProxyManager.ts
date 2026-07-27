/**
 * Groq Proxy Manager — same-origin dev proxy for the game's "Local proxy" AI mode.
 *
 * The game can route text generation to Groq instead of local Ollama. In "Local
 * proxy" mode the browser posts KEYLESS requests to a proxy URL, and the proxy
 * injects the real Groq key server-side. This plugin makes the Vite dev server
 * itself that proxy, so:
 *
 *   - it is ALWAYS available while `npm run dev` runs — nothing to start by hand,
 *   - it is same-origin (no separate port, no CORS), and
 *   - the key never enters the browser, never lands on disk, never reaches git.
 *
 * The key is read from Windows Credential Manager (AgentMatrix/Groq/GROQ_API_KEY)
 * on first request. Successful reads stay cached in memory, while missing reads
 * are remembered only briefly so the proxy can recover without hammering the
 * comparatively slow credential process. The key is NEVER printed or logged.
 * (The standalone `npm run groq-proxy` on :8787 still exists for non-Vite use.)
 *
 *   ANY  /__groq/v1/*  → https://api.groq.com/openai/v1/*  (Authorization added)
 *   GET  /__groq/health → { ok, keyLoaded }   (never returns the key)
 */
import { Readable } from 'node:stream';
// Reuse the exact Credential Manager reader the standalone proxy uses. Importing
// proxy.mjs does NOT start a server — it only listens when run as the main module.
import { readWinCred } from '../../tools/groq-proxy/proxy.mjs';

const MOUNT = '/__groq/v1';
const HEALTH = '/__groq/health';
const CRED_TARGET = process.env.GROQ_PROXY_CRED || 'AgentMatrix/Groq/GROQ_API_KEY';
const UPSTREAM = 'https://api.groq.com/openai/v1';
const MISSING_KEY_RETRY_DELAY_MS = 1_000;

// ============================================================================
// Credential loading and retry policy
// ============================================================================
// Credential Manager can take up to eight seconds to answer. This loader keeps
// successful keys for the session, shares active reads between callers, and
// pauses briefly after a missing result before trying the external process again.
// ============================================================================

export interface GroqKeyLoaderOptions {
  /** How long a null or empty read suppresses another credential process. */
  missingKeyRetryDelayMs?: number;
  /** Injectable clock used by focused tests; production uses the system clock. */
  now?: () => number;
}

/**
 * Build the lazy key loader. The key is read on first use and the SUCCESSFUL
 * result is cached so a heavy credential read runs once per session.
 *
 * The important subtlety — and the reason this is its own testable unit — is how
 * a FAILED read is handled. A `null`/empty result means the read did not produce
 * a key (for example the Credential Manager call timed out while the dev server
 * was busy warming up the first build). Such a result must NOT be cached for the
 * whole session: that would leave the proxy permanently keyless and every request
 * would 500 until the dev server restarted. That is exactly the "proxy came up
 * but never loaded the key" auto-start failure this manager is meant to avoid.
 *
 * So we share the in-flight promise between concurrent callers, keep a real key
 * for the session, and remember a missing result only for a short cooldown. That
 * cooldown prevents sequential requests from each paying the external-process
 * cost, but its expiry still lets the proxy recover when a key is added later.
 *
 * `readKey` is injected so tests can drive the retry/cache behavior without
 * touching Windows Credential Manager.
 */
export function createGroqKeyLoader(
  readKey: () => Promise<string | null>,
  {
    missingKeyRetryDelayMs = MISSING_KEY_RETRY_DELAY_MS,
    now = Date.now,
  }: GroqKeyLoaderOptions = {},
): () => Promise<string | null> {
  let cachedKey: string | null = null;
  let pendingRead: Promise<string | null> | null = null;
  let retryAfter = 0;

  return function getKey(): Promise<string | null> {
    // A successful key remains available without another credential process.
    if (cachedKey) return Promise.resolve(cachedKey);

    // Requests arriving during an active read share its result. This is important
    // during Vite startup, when health and inference requests can arrive together.
    if (pendingRead) return pendingRead;

    // A recent missing result is a short-lived negative cache, not a permanent
    // failure. Once the deadline passes, the next caller starts a recovery read.
    if (now() < retryAfter) return Promise.resolve(null);

    // `Promise.resolve().then(readKey)` also funnels a synchronous throw from
    // the injected reader into the same controlled rejection path.
    const pending = Promise.resolve().then(readKey).then(
      (key) => {
        // Keep a real key for the rest of the dev-server session.
        if (key && key.length > 0) {
          cachedKey = key;
          retryAfter = 0;
          return key;
        }

        // Missing credentials are retried after a short pause. The pause is long
        // enough to absorb sequential traffic but short enough for key recovery.
        retryAfter = now() + missingKeyRetryDelayMs;
        return null;
      },
      (error) => {
        // Rejections are not cached. Middleware converts this to a generic 503,
        // and a later request can retry after a transient reader failure clears.
        throw error;
      },
    ).finally(() => {
      // Clear only the read that just settled, preserving any future replacement.
      if (pendingRead === pending) pendingRead = null;
    });

    pendingRead = pending;
    return pending;
  };
}

const getKey = createGroqKeyLoader(() => readWinCred(CRED_TARGET));

// ============================================================================
// Same-origin request forwarding
// ============================================================================
// This section reads request bodies, handles the private key boundary, and sends
// valid Groq calls upstream while leaving every unrelated Vite route untouched.
// ============================================================================

// Collect the browser request into one server-side buffer because Node's fetch
// forwards a complete body to Groq after the credential check succeeds.
function readBody(req: { on: (e: string, cb: (c?: Buffer) => void) => void }): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => { if (c) chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Register the same-origin middleware with Vite. Tests can inject a key loader to
// exercise failure boundaries without accessing the real credential store.
export const groqProxyManager = (
  loadKey: () => Promise<string | null> = getKey,
) => ({
  name: 'groq-proxy-manager',
  configureServer(server: { middlewares: { use: (h: (req: any, res: any, next: any) => void) => void } }) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];

      // Leave unrelated Vite routes alone. Only Groq health and proxy requests
      // should wake the external credential reader.
      if (urlPath !== HEALTH && !urlPath.startsWith(MOUNT + '/')) { next(); return; }

      // Reader errors stay server-side and become a retryable response instead
      // of escaping the asynchronous middleware and leaving the request open.
      let key: string | null;
      try {
        key = await loadKey();
      } catch {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Groq credential store is temporarily unavailable; retry shortly' }));
        return;
      }

      if (urlPath === HEALTH) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, keyLoaded: !!key, credTarget: CRED_TARGET, upstream: UPSTREAM }));
        return;
      }

      // A completed read with no key is distinct from a reader failure: report
      // the configured target without ever returning credential contents.
      if (!key) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `no Groq key in Credential Manager target "${CRED_TARGET}"` }));
        return;
      }

      const search = (req.url || '').includes('?') ? '?' + (req.url as string).split('?').slice(1).join('?') : '';
      const upstreamUrl = UPSTREAM + urlPath.slice(MOUNT.length) + search;
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
      try {
        const upstream = await fetch(upstreamUrl, {
          method: req.method,
          headers: {
            'content-type': req.headers['content-type'] || 'application/json',
            Authorization: `Bearer ${key}`,
          },
          // Node's fetch accepts a Buffer body at runtime; the DOM BodyInit type
          // doesn't list it, so cast. `undefined` (GET/HEAD) is already valid.
          body: body as unknown as BodyInit | undefined,
        });
        res.writeHead(upstream.status, {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
        });
        if (upstream.body) Readable.fromWeb(upstream.body as any).pipe(res);
        else res.end();
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `upstream request failed: ${(e as Error).message}` }));
      }
    });
  },
});
