/**
 * catalogRecapture.ts — the Recapture button's other half.
 *
 * The pane catalog shows a picture per preview pane. The pictures come from
 * `scripts/preview/capture-catalog.mjs`, which drives a headless browser. A web
 * page cannot run that itself, so this dev-server route does it on request:
 *
 *   POST /__catalog/recapture?step=<id>
 *
 * One pane per call, which is what was agreed: a full refresh takes minutes,
 * and you almost always want to refresh the one pane you just changed.
 *
 * This lives behind the lazy-import wrapper in `vite.config.ts` for the reason
 * that file explains: a plugin imported at the top level joins vite's config
 * dependency list, and then editing it restarts the dev server — which would
 * kill the very capture this route just started.
 */
import { spawn } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface DevServer {
  middlewares: {
    use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
  };
}

/** Step ids are short and lower case. Anything else is not a step. */
const STEP_ID = /^[a-z0-9_]{1,40}$/;

/** Only one capture at a time: two headless browsers fight over the same port. */
let running: string | null = null;

export function catalogRecapture() {
  return {
    name: 'catalog-recapture',
    configureServer(server: DevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/__catalog/recapture')) {
          next();
          return;
        }

        const send = (code: number, body: Record<string, unknown>) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        if (req.method !== 'POST') {
          send(405, { error: 'Use POST.' });
          return;
        }

        const step = new URL(url, 'http://localhost').searchParams.get('step') ?? '';
        if (!STEP_ID.test(step)) {
          send(400, { error: 'Name one step, as ?step=<id>.' });
          return;
        }
        if (running) {
          send(409, { error: `A capture of "${running}" is already running.` });
          return;
        }

        running = step;
        const child = spawn(
          process.execPath,
          ['scripts/preview/capture-catalog.mjs', step],
          { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
        );

        let out = '';
        child.stdout.on('data', (d) => { out += String(d); });
        child.stderr.on('data', (d) => { out += String(d); });

        child.on('close', (code) => {
          running = null;
          // The script prints one line per pane: "ok <id> 3.4s" or
          // "FAIL <id> 42.1s <reason>". Hand that line back so the page can say
          // what happened rather than only that something did.
          const line = out.split('\n').find((l) => l.includes(step))?.trim() ?? '';
          const failed = line.startsWith('FAIL');
          send(code === 0 && !failed ? 200 : 500, {
            step,
            ok: code === 0 && !failed,
            detail: line || `capture exited with code ${code}`,
          });
        });

        child.on('error', (err) => {
          running = null;
          send(500, { step, ok: false, detail: String(err.message) });
        });
      });
    },
  };
}
