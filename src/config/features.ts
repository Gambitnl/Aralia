/**
 * @file src/config/features.ts
 * Feature flags and toggles.
 * Derived from environment variables or hardcoded logic.
 */

import { ENV } from './env';

export const FEATURES = {
  /**
   * Enables developer tools, dummy characters, and debug panels.
   */
  ENABLE_DEV_TOOLS: ENV.VITE_ENABLE_DEV_TOOLS,

  /**
   * Example: New Combat System (Enabled by default or via flag)
   */
  // NEW_COMBAT: true,
};
