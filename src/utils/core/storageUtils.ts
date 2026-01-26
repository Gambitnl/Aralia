// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:39:09
 * Dependents: core/index.ts, storageUtils.ts
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file storageUtils.ts
 * Provides a safe facade for LocalStorage and SessionStorage access.
 * Handles SecurityErrors (e.g. strict privacy settings) by treating storage as empty/unavailable
 * rather than crashing.
 *
 * Note: setItem intentionally propagates errors (like QuotaExceededError) so callers
 * can handle write failures appropriately.
 */

export const SafeStorage = {
  /**
   * Safely retrieves an item from localStorage.
   * Returns null if the item doesn't exist or if storage is inaccessible.
   */
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`SafeStorage: Error reading ${key}`, error);
      return null;
    }
  },

  /**
   * Writes an item to localStorage.
   * WARNING: This method intentionally throws errors (like QuotaExceededError)
   * so the caller can handle write failures.
   */
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  },

  /**
   * Writes an item to localStorage safely, catching any errors.
   * Returns true if successful, false otherwise.
   * Use this when you don't need to differentiate between quota errors and other failures.
   */
  trySetItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`SafeStorage: Error writing ${key}`, error);
      return false;
    }
  },

  /**
   * Safely removes an item from localStorage.
   * Swallows errors as failure to remove usually implies storage is already broken or inaccessible.
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`SafeStorage: Error removing ${key}`, error);
    }
  },

  /**
   * Safely retrieves all keys from localStorage.
   * Accessing localStorage.length or localStorage.key(i) can throw in some restricted contexts.
   */
  getAllKeys(): string[] {
    try {
      const keys: string[] = [];
      const length = localStorage.length;
      for (let i = 0; i < length; i++) {
        const key = localStorage.key(i);
        if (key !== null) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      console.warn('SafeStorage: Error iterating keys', error);
      return [];
    }
  }
};

export const SafeSession = {
  /**
   * Safely retrieves an item from sessionStorage.
   */
  getItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.warn(`SafeSession: Error reading ${key}`, error);
      return null;
    }
  },

  /**
   * Writes an item to sessionStorage.
   * Re-throws errors to allow caller to handle quota or access issues.
   */
  setItem(key: string, value: string): void {
    sessionStorage.setItem(key, value);
  },

  /**
   * Writes an item to sessionStorage safely, catching any errors.
   * Returns true if successful, false otherwise.
   */
  trySetItem(key: string, value: string): boolean {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`SafeSession: Error writing ${key}`, error);
      return false;
    }
  },

  /**
   * Safely removes an item from sessionStorage.
   */
  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn(`SafeSession: Error removing ${key}`, error);
    }
  }
};
