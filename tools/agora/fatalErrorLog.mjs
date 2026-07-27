/**
 * This file preserves the reason the Agora daemon stopped unexpectedly.
 *
 * The daemon installs these handlers before it opens its HTTP listener. If Node reports an
 * uncaught exception or an unhandled promise rejection, the handler appends a timestamped record
 * to the daemon's private runtime directory and then exits with a failure code. Synchronous file
 * writes are intentional here: a background process may have no terminal, and an asynchronous
 * write could be abandoned by the very exit this file is trying to explain.
 *
 * Called by: server.mjs when Agora is launched as a command-line daemon
 * Depends on: Node's filesystem and path libraries; no Agora store state is required
 */

// ============================================================================
// Runtime Dependencies
// ============================================================================
// Only built-in Node modules are used so crash reporting remains available even when the
// application dependency tree is damaged.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// Fatal Record Formatting
// ============================================================================
// These helpers turn every possible thrown value into readable evidence. JavaScript permits
// rejecting a promise with a string or object, so the logger cannot assume it receives an Error.
// ============================================================================

function describeFatalValue(value) {
  // Error stacks contain both the message and the call site that caused the daemon to stop.
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;

  // Preserve plain strings exactly; they are common rejection reasons and need no decoration.
  if (typeof value === 'string') return value;

  // Structured values are easiest to diagnose as JSON. Circular objects fall back to their
  // normal string representation so logging itself never becomes another fatal exception.
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatFatalError(kind, value, occurredAt = new Date()) {
  // A visible record boundary keeps several crashes understandable when the append-only file
  // contains evidence from multiple daemon restarts.
  return [
    `\n[${occurredAt.toISOString()}] Agora fatal ${kind}`,
    describeFatalValue(value),
    '',
  ].join('\n');
}

// ============================================================================
// Synchronous Crash Persistence
// ============================================================================
// Fatal paths get one best-effort filesystem operation before process exit. The runtime directory
// is created here as well so an early startup crash can still leave evidence on a fresh checkout.
// ============================================================================

export function appendFatalError({ logFile, kind, value, occurredAt }) {
  // Ensure the private Agora runtime directory exists before appending the crash record.
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, formatFatalError(kind, value, occurredAt), 'utf8');
}

// ============================================================================
// Process-Level Fatal Handlers
// ============================================================================
// Installing these handlers changes Node's default fatal behavior, so each one explicitly exits
// with status 1 after the synchronous record is written. stderr remains a second line of evidence
// for operators who launch Agora with the documented daemon.log redirection.
// ============================================================================

export function installFatalErrorHandlers({ logFile, runtimeProcess = process } = {}) {
  // stderr is intentionally written without the application's normal logger: a fatal error may
  // mean higher-level logging is unavailable. Ignore a broken output stream so process exit still
  // happens and never turns crash reporting into a second uncaught exception.
  const writeEmergencyStderr = (label, value) => {
    try {
      runtimeProcess.stderr.write(`${label}\n${describeFatalValue(value)}\n`);
    } catch {
      // No additional fallback remains once both the crash file and stderr are unavailable.
    }
  };

  // Share one terminal path so uncaught exceptions and rejected promises produce identical,
  // attributable records and the same non-zero process outcome.
  const terminateAfterLogging = (kind, value) => {
    try {
      appendFatalError({ logFile, kind, value });
    } catch (logError) {
      writeEmergencyStderr(`Agora could not write fatal evidence to ${logFile}:`, logError);
    }

    // Keep the original failure visible in the redirected daemon output as well as the dedicated
    // crash file. This also preserves evidence if the filesystem append above failed.
    writeEmergencyStderr(`Agora fatal ${kind}:`, value);
    runtimeProcess.exit(1);
  };

  // Node stops invoking its default uncaught-exception exit once a listener exists, so this
  // listener must perform the explicit failure exit after persistence.
  const onUncaughtException = (error) => terminateAfterLogging('uncaughtException', error);

  // Promise rejection policy can vary with Node flags. Handling it here makes Agora's background
  // behavior deterministic and ensures the rejection reason is recorded before exit.
  const onUnhandledRejection = (reason) => terminateAfterLogging('unhandledRejection', reason);

  runtimeProcess.on('uncaughtException', onUncaughtException);
  runtimeProcess.on('unhandledRejection', onUnhandledRejection);

  // Return a cleanup function for focused tests or embedders that install the handlers temporarily.
  // The production daemon keeps them for its entire lifetime.
  return () => {
    runtimeProcess.off('uncaughtException', onUncaughtException);
    runtimeProcess.off('unhandledRejection', onUnhandledRejection);
  };
}
