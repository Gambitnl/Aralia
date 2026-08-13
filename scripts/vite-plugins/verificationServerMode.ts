import type { ServerOptions } from 'vite';

/**
 * This file defines the deliberately narrow Vite mode used for rendered verification.
 *
 * The normal Aralia development server watches the checkout so developers keep hot
 * reloads. On this unusually large shared checkout, that watcher's first filesystem
 * crawl can prevent a short-lived screenshot server from answering even its first
 * document request. The verification mode disables only that watcher; the main Vite
 * configuration still supplies the same plugins, transforms, and dependency optimizer.
 *
 * Called by: vite.config.ts when it builds the main-app development-server options
 * Verified by: verificationServerMode.test.ts
 */

// ============================================================================
// Public Verification Mode Contract
// ============================================================================
// These values give humans and capture tools one stable mode name and one port that
// cannot silently fall back onto the shared development server at port 3000.
// ============================================================================

export const VERIFICATION_NO_WATCH_MODE = 'verification-no-watch';
export const VERIFICATION_NO_WATCH_PORT = 5192;

type ViteCommand = 'build' | 'serve';

interface ViteModeSelection {
  command: ViteCommand;
  mode: string;
}

// ============================================================================
// Watch Policy Selection
// ============================================================================
// Vite accepts `null` as an explicit instruction not to create a filesystem
// watcher. Every other invocation receives the caller's existing watch policy.
// ============================================================================

/**
 * Reports whether this invocation is the verification-only development server.
 * Naming the mode during a production build does not alter build behavior.
 */
export function isVerificationNoWatchServer(selection: ViteModeSelection): boolean {
  return selection.command === 'serve' && selection.mode === VERIFICATION_NO_WATCH_MODE;
}

/**
 * Disables the filesystem watcher only for verification captures.
 *
 * Passing the default options through unchanged is intentional: ordinary `npm run dev`
 * must retain its ignored paths, file watching, and hot-module reload behavior.
 */
export function selectMainAppWatchOptions(
  selection: ViteModeSelection,
  defaultWatchOptions: NonNullable<ServerOptions['watch']>,
): ServerOptions['watch'] {
  if (isVerificationNoWatchServer(selection)) {
    return null;
  }

  return defaultWatchOptions;
}
