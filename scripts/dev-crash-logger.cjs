/**
 * This preload records why a local Vite development server starts and stops.
 *
 * Launch configurations load it before Vite. Human-readable crash messages go
 * to `.agent/dev-server-crash.log`, while lifecycle JSON goes to
 * `.agent/dev-server-owner.log`. The WF-G30 watchdog may cite that lifecycle
 * evidence, but the receipt never grants permission to stop or restart a PID.
 *
 * Called by: every Vite entry in .claude/launch.json.
 * Depends on: Node process events and the repository's ignored `.agent/` logs.
 */
const fs = require('fs');
const path = require('path');
const { isMainThread } = require('worker_threads');

// ============================================================================
// Main-thread boundary and ignored evidence files
// ============================================================================
// Vite and node-pty can re-run preloads in workers. Only the process that owns
// the server lifecycle should claim a PID in the durable receipts.
// ============================================================================

// node-pty and vite spawn worker threads which re-run preloads; only the
// main thread should log lifecycle events.
if (!isMainThread) return;

const LOG = path.join(process.cwd(), '.agent', 'dev-server-crash.log');
const OWNER_LOG = path.join(process.cwd(), '.agent', 'dev-server-owner.log');

function append(kind, detail) {
  const line = `[${new Date().toISOString()}] pid=${process.pid} ${kind}: ${detail}\n`;
  try { fs.appendFileSync(LOG, line); } catch { /* best effort */ }
}

/**
 * Preserve process identity as evidence only. PID reuse and external launch
 * supervisors make this unsuitable as restart authority, so the watchdog still
 * restarts only a ChildProcess object that it created itself.
 */
function appendOwnerLifecycle(event, details = {}) {
  const receipt = {
    event,
    at: new Date().toISOString(),
    pid: process.pid,
    parentPid: process.ppid,
    cwd: process.cwd(),
    executable: process.execPath,
    argv: process.argv.slice(1),
    ...details,
  };
  try {
    fs.mkdirSync(path.dirname(OWNER_LOG), { recursive: true });
    fs.appendFileSync(OWNER_LOG, `${JSON.stringify(receipt)}\n`);
  } catch {
    // Evidence must never interfere with Vite's normal startup or shutdown.
  }
}

append('start', `argv=${process.argv.slice(1).join(' ')}`);
appendOwnerLifecycle('start');

// ============================================================================
// Fatal errors and Vite's known restart race
// ============================================================================
// Unexpected failures preserve Node's fatal behavior. The one known benign
// double-listen race stays alive because the original server is still serving.
// ============================================================================

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
  appendOwnerLifecycle('exit', { code });
});

// ============================================================================
// Operator and supervisor signals
// ============================================================================
// Record the requested stop before preserving the conventional shell exit code.
// ============================================================================

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  try {
    process.on(sig, () => {
      append('signal', sig);
      process.exit(sig === 'SIGINT' ? 130 : 143);
    });
  } catch { /* not supported on this platform */ }
}
