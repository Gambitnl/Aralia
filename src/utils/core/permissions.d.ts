/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:31:59
 * Dependents: core/index.ts, permissions.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/utils/permissions.ts
 * @description
 * Centralized permission logic for the application.
 * Replaces direct checks of global constants like `USE_DUMMY_CHARACTER_FOR_DEV`.
 * This allows for more granular control over features and roles in the future.
 */
export declare const PERMISSIONS: {
    readonly ACCESS_DEV_TOOLS: "ACCESS_DEV_TOOLS";
    readonly SKIP_CHARACTER_CREATION: "SKIP_CHARACTER_CREATION";
    readonly VIEW_DEBUG_LOGS: "VIEW_DEBUG_LOGS";
    readonly EDIT_PARTY: "EDIT_PARTY";
    readonly TEST_NPC_INTERACTIONS: "TEST_NPC_INTERACTIONS";
    readonly VIEW_GEMINI_LOGS: "VIEW_GEMINI_LOGS";
};
export type Permission = keyof typeof PERMISSIONS;
/**
 * Checks if the current environment/user has the specified permission.
 * Currently maps mostly to `USE_DUMMY_CHARACTER_FOR_DEV` but can be expanded.
 *
 * @param permission The permission to check
 * @returns boolean
 */
export declare function hasPermission(permission: Permission): boolean;
/**
 * Convenience function specifically for checking if Dev Tools should be accessible.
 */
export declare function canUseDevTools(): boolean;
