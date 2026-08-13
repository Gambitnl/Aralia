import { describe, expect, it } from 'vitest';

import {
  isVerificationNoWatchServer,
  selectMainAppWatchOptions,
  VERIFICATION_NO_WATCH_MODE,
} from '../verificationServerMode';

/**
 * This file proves the verification server cannot accidentally change normal Vite use.
 *
 * Render capture needs a no-watch server because the shared checkout's initial watcher
 * crawl can starve requests. These tests keep that exception tied to one explicit serve
 * mode and prove ordinary development still receives its existing watch configuration.
 *
 * Exercises: verificationServerMode.ts
 */

// ============================================================================
// Verification-Only Selection
// ============================================================================
// The special mode must produce Vite's explicit no-watcher value during serving,
// while the same name has no effect on production builds.
// ============================================================================

describe('verification-only Vite mode', () => {
  it('disables filesystem watching for the named development server', () => {
    const selection = { command: 'serve' as const, mode: VERIFICATION_NO_WATCH_MODE };
    const normalWatchOptions = { ignored: ['**/.agent/**'] };

    expect(isVerificationNoWatchServer(selection)).toBe(true);
    expect(selectMainAppWatchOptions(selection, normalWatchOptions)).toBeNull();
  });

  it('does not reinterpret a production build as a no-watch server', () => {
    const selection = { command: 'build' as const, mode: VERIFICATION_NO_WATCH_MODE };

    expect(isVerificationNoWatchServer(selection)).toBe(false);
  });
});

// ============================================================================
// Default Development Preservation
// ============================================================================
// Normal development keeps the exact watch object supplied by the main Vite config.
// Returning the same object also preserves future watch settings added by other lanes.
// ============================================================================

describe('normal Vite development mode', () => {
  it('preserves the complete default watch policy unchanged', () => {
    const selection = { command: 'serve' as const, mode: 'development' };
    const normalWatchOptions = {
      ignored: ['**/.agent/**', '**/.tmp/**'],
      awaitWriteFinish: true,
    };

    expect(isVerificationNoWatchServer(selection)).toBe(false);
    expect(selectMainAppWatchOptions(selection, normalWatchOptions)).toBe(normalWatchOptions);
  });
});
