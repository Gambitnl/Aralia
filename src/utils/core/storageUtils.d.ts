/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:32:03
 * Dependents: App.tsx, core/index.ts, storageUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file storageUtils.ts
 * Provides a safe facade for LocalStorage and SessionStorage access.
 * Handles SecurityErrors (e.g. strict privacy settings) by treating storage as empty/unavailable
 * rather than crashing.
 *
 * Note: setItem intentionally propagates errors (like QuotaExceededError) so callers
 * can handle write failures appropriately.
 */
export declare const SafeStorage: {
    /**
     * Safely retrieves an item from localStorage.
     * Returns null if the item doesn't exist or if storage is inaccessible.
     */
    getItem(key: string): string | null;
    /**
     * Writes an item to localStorage.
     * WARNING: This method intentionally throws errors (like QuotaExceededError)
     * so the caller can handle write failures.
     */
    setItem(key: string, value: string): void;
    /**
     * Writes an item to localStorage safely, catching any errors.
     * Returns true if successful, false otherwise.
     * Use this when you don't need to differentiate between quota errors and other failures.
     */
    trySetItem(key: string, value: string): boolean;
    /**
     * Safely removes an item from localStorage.
     * Swallows errors as failure to remove usually implies storage is already broken or inaccessible.
     */
    removeItem(key: string): void;
    /**
     * Safely retrieves all keys from localStorage.
     * Accessing localStorage.length or localStorage.key(i) can throw in some restricted contexts.
     */
    getAllKeys(): string[];
};
export declare const SafeSession: {
    /**
     * Safely retrieves an item from sessionStorage.
     */
    getItem(key: string): string | null;
    /**
     * Writes an item to sessionStorage.
     * Re-throws errors to allow caller to handle quota or access issues.
     */
    setItem(key: string, value: string): void;
    /**
     * Writes an item to sessionStorage safely, catching any errors.
     * Returns true if successful, false otherwise.
     */
    trySetItem(key: string, value: string): boolean;
    /**
     * Safely removes an item from sessionStorage.
     */
    removeItem(key: string): void;
};
