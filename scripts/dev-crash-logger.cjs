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
