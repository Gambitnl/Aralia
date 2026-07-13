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
 * The key is read once from Windows Credential Manager (AgentMatrix/Groq/
 * GROQ_API_KEY) on first request, cached in memory, and NEVER printed or logged.
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

// Read the key lazily on first use and cache it. `null` = not yet read; a later
// retry can pick it up if the credential is added mid-session.
let keyPromise: Promise<string | null> | null = null;
function getKey(): Promise<string | null> {
  if (!keyPromise) keyPromise = readWinCred(CRED_TARGET);
  return keyPromise;
}

function readBody(req: { on: (e: string, cb: (c?: Buffer) => void) => void }): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => { if (c) chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export const groqProxyManager = () => ({
  name: 'groq-proxy-manager',
  configureServer(server: { middlewares: { use: (h: (req: any, res: any, next: any) => void) => void } }) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const urlPath = (req.url || '').split('?')[0];

      if (urlPath === HEALTH) {
        const key = await getKey();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, keyLoaded: !!key, credTarget: CRED_TARGET, upstream: UPSTREAM }));
        return;
      }

      if (!urlPath.startsWith(MOUNT + '/')) { next(); return; }

      const key = await getKey();
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
