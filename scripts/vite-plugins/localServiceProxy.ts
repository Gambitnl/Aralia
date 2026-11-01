/** Local dev proxies keep real service failures visible without flooding logs.
 * Reused by the main Vite configuration; this module owns no provider selection,
 * credentials, model changes or game state. */
import type {ProxyOptions} from 'vite';
import type {IncomingMessage} from 'http';
import {formatProxyTarget} from './utils';

/**
 * Helper to add diagnostic hints to Vite proxy errors.
 *
 * The main game treats Ollama as an optional local dependency at startup. When
 * the startup heartbeat asks for `/api/ollama/tags` and Ollama is not running,
 * the proxy returns a readable 502 instead of a stack flood. Generation and
 * chat requests still fail, so an unavailable service never looks successful.
 * A later request may probe recovery; failed game choices are never replayed.
 */
export function addProxyDiagnostics(
  route: string,
  config: ProxyOptions,
  hint: string
): ProxyOptions {
  // GG-15: while the target is down, every heartbeat/probe request used to log
  // a full ECONNREFUSED stack (from Vite's own proxy error logger), drowning
  // real errors in dev/Playwright logs. Strategy:
  // 1. First refusal logs ONE diagnostic block, then marks the target down.
  // 2. While down, `bypass` answers quietly except for one incoming request per
  //    two seconds. Permanently bypassing would prevent proxyRes from ever
  //    noticing that the same local service had returned.
  // 3. Vite registers its error logger AFTER configure(), so this handler runs
  //    first; clearing err.stack keeps even that first Vite line stack-free.
  // 4. A successful proxied response re-arms logging for the next outage.
  let targetDown = false;
  let nextProbeAt = 0;
  const retryIntervalMs = 2000;

  const softRefusalJson = () =>
    JSON.stringify({
      error: 'LOCAL_SERVICE_UNAVAILABLE',
      message: `Proxy target ${formatProxyTarget(config.target)} refused connection. ${hint}`,
    });

  // Node delivers localhost refusals as AggregateError [ECONNREFUSED] whose
  // message is empty; the code lives on err.code or nested err.errors.
  const isRefusal = (err: Error & { code?: string; errors?: Array<{ code?: string }> }) =>
    err.code === 'ECONNREFUSED' ||
    err.message.includes('ECONNREFUSED') ||
    (Array.isArray(err.errors) && err.errors.some((e) => e.code === 'ECONNREFUSED'));

  return {
    ...config,
    bypass: (req, res) => {
      if (!targetDown) return undefined;
      const now = Date.now();
      if (now >= nextProbeAt) {
        // Admit this new request, not an automatic replay of a failed POST.
        // Reserve the interval before returning to keep a burst bounded.
        nextProbeAt = now + retryIntervalMs;
        return undefined;
      }
      if (res && typeof res.writeHead === 'function' && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(softRefusalJson());
      }
      // Returning any string short-circuits the proxy attempt; since the
      // response is already ended, Vite's middleware returns immediately.
      return req.url ?? '/';
    },
    configure: (proxy, _options) => {
      proxy.on('error', (err: Error, req: IncomingMessage, res: any) => {
        const target = formatProxyTarget(config.target);
        if (isRefusal(err)) {
          err.stack = '';
          nextProbeAt = Date.now() + retryIntervalMs;
          if (!targetDown) {
            targetDown = true;
            console.error(`\n[proxy] ${route} -> ${target} connection refused.`);
            console.error(`[proxy] Hint: ${hint}`);
            console.error(`[proxy] Further ${route} failures suppressed until the target recovers.\n`);
          }
        }

        // Keep the real failure visible to the caller. Startup can offer its
        // existing setup flow; a failed generation must not become fake speech.
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(softRefusalJson());
        }
      });

      proxy.on('proxyRes', () => {
        if (targetDown) {
          targetDown = false;
          nextProbeAt = 0;
          console.info(`[proxy] ${route} recovered; refusal logging re-armed.`);
        }
      });
    },
  };
}

