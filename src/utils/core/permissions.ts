// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:39:06
 * Dependents: core/index.ts, permissions.ts
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/permissions.ts
 * @description
 * Centralized permission logic for the application.
 * Replaces direct checks of global constants like `USE_DUMMY_CHARACTER_FOR_DEV`.
 * This allows for more granular control over features and roles in the future.
 */

export const PERMISSIONS = {
  ACCESS_DEV_TOOLS: 'ACCESS_DEV_TOOLS',
  SKIP_CHARACTER_CREATION: 'SKIP_CHARACTER_CREATION',
  VIEW_DEBUG_LOGS: 'VIEW_DEBUG_LOGS',
  EDIT_PARTY: 'EDIT_PARTY',
  TEST_NPC_INTERACTIONS: 'TEST_NPC_INTERACTIONS',
  VIEW_GEMINI_LOGS: 'VIEW_GEMINI_LOGS',
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Checks if the current environment/user has the specified permission.
 * Currently maps mostly to `USE_DUMMY_CHARACTER_FOR_DEV` but can be expanded.
 *
 * @param permission The permission to check
 * @returns boolean
 */
export function hasPermission(permission: Permission): boolean {
  // In the future, this could check a user object, role, or feature flags.
  switch (permission) {
    case 'ACCESS_DEV_TOOLS':
    case 'SKIP_CHARACTER_CREATION':
    case 'VIEW_DEBUG_LOGS':
    case 'EDIT_PARTY':
    case 'TEST_NPC_INTERACTIONS':
    case 'VIEW_GEMINI_LOGS':
      return true; // Force enable for testing
    default:
      return false;
  }
}

/**
 * Convenience function specifically for checking if Dev Tools should be accessible.
 */
export function canUseDevTools(): boolean {
  return hasPermission('ACCESS_DEV_TOOLS');
}
