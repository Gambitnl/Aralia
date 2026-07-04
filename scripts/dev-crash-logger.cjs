/**
 * Crash logger preload for the Vite dev server.
 * Usage: node -r ./scripts/dev-crash-logger.cjs node_modules/vite/bin/vite.js ...
 * Appends fatal-event diagnostics to .agent/dev-server-crash.log so silent
 * deaths leave a postmortem trail. Logs then preserves default behavior.
 */
const fs = require('fs');
const path = require('path');
const { isMainThread } = require('worker_threads');

// node-pty and vite spawn worker threads which re-run preloads; only the
// main thread should log lifecycle events.
if (!isMainThread) return;

const LOG = path.join(process.cwd(), '.agent', 'dev-server-crash.log');

function append(kind, detail) {
  const line = `[${new Date().toISOString()}] pid=${process.pid} ${kind}: ${detail}\n`;
  try { fs.appendFileSync(LOG, line); } catch { /* best effort */ }
}

append('start', `argv=${process.argv.slice(1).join(' ')}`);

process.on('uncaughtException', (err, origin) => {
  append('uncaughtException', `origin=${origin} ${err && err.stack ? err.stack : String(err)}`);
  // preserve default fatal behavior
  process.exitCode = 1;
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  // Vite's dev-server restart is not re-entrant: when two config-dependency
  // changes land close together (common in this shared, multi-agent checkout),
  // the second restart calls httpServer.listen() before the first finished,
  // throwing ERR_SERVER_ALREADY_LISTEN. Node's default turns that benign race
  // into a fatal unhandledRejection and kills the dev server (exit 1). The
  // server is already listening and serving, so swallow this specific error and
  // keep the process alive; the next real change triggers a clean restart.
  const code = reason && reason.code;
  const msg = reason && reason.message ? reason.message : String(reason);
  if (code === 'ERR_SERVER_ALREADY_LISTEN' || /Listen method has been called more than once/.test(msg)) {
    append('unhandledRejection:swallowed', `benign Vite restart race: ${msg}`);
    return; // do NOT exit — the already-listening server stays up
  }
  append('unhandledRejection', reason && reason.stack ? reason.stack : String(reason));
  // mirror Node's default --unhandled-rejections=throw fatal behavior
  process.exitCode = 1;
  process.exit(1);
});

process.on('exit', (code) => {
  append('exit', `code=${code}`);
});

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  try {
    process.on(sig, () => {
      append('signal', sig);
      process.exit(sig === 'SIGINT' ? 130 : 143);
    });
  } catch { /* not supported on this platform */ }
}
