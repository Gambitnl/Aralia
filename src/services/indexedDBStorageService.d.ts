/**
 * This file provides a storage layer that uses IndexedDB instead of localStorage.
 *
 * Why it exists:
 * The game's save data was originally stored in localStorage, which has a 5-10MB limit.
 * As game state grows (party members, map data, message history, AI logs), saves get
 * larger and risk hitting that limit. IndexedDB offers 50MB-2GB+ of space while still
 * being fully local, offline, and per-browser — the player experience doesn't change.
 *
 * How it connects:
 * - Called by: saveLoadService.ts (for reading/writing save payloads)
 * - Called by: useCheckpointSaves.ts (for copying rapid autosave to checkpoint slots)
 * - This service stores raw serialized JSON strings, NOT parsed objects, so the
 *   existing checksum system (which hashes the serialized JSON) keeps working.
 *
 * Design decisions:
 * - Uses the raw IndexedDB API (no npm dependencies like idb/dexie) to keep the
 *   bundle small and avoid version conflicts.
 * - All methods return Promises since IndexedDB is inherently async.
 * - If IndexedDB is unavailable (incognito mode, old browser), the `isAvailable()`
 *   check lets callers fall back to localStorage gracefully.
 */
/**
 * Writes a save payload to IndexedDB.
 * Overwrites any existing save in the same slot.
 *
 * @param slotId - The unique key for this save slot (e.g., "aralia_rpg_autosave").
 * @param serializedPayload - The full JSON string of the StoredSavePayload.
 */
export declare function putSave(slotId: string, serializedPayload: string): Promise<void>;
/**
 * Reads a save payload from IndexedDB by slot key.
 *
 * @param slotId - The unique key for this save slot.
 * @returns The serialized JSON string, or null if no save exists in that slot.
 */
export declare function getSave(slotId: string): Promise<string | null>;
/**
 * Deletes a single save from IndexedDB.
 *
 * @param slotId - The key of the save slot to remove.
 */
export declare function deleteSave(slotId: string): Promise<void>;
/**
 * Returns all slot IDs currently stored in IndexedDB.
 * Used during migration and for ghost mitigation (checking which slots
 * actually have data vs. which only have stale metadata).
 */
export declare function getAllKeys(): Promise<string[]>;
/**
 * Deletes ALL save data from IndexedDB. Used by the "Clear All Saves" feature.
 * This wipes every record in the saves object store.
 */
export declare function clearAllSaves(): Promise<void>;
/**
 * Checks whether IndexedDB is available and functional in the current browser.
 * The result is cached after the first check.
 *
 * Returns true if IndexedDB can be opened and used.
 * Returns false if it's blocked, disabled, or in a restricted context.
 */
export declare function isAvailable(): Promise<boolean>;
/**
 * Closes the cached database connection. Used by tests to ensure clean state.
 * In production, the connection stays open for the page's lifetime.
 */
export declare function closeDB(): void;
/**
 * Resets the availability cache. Used by tests that want to re-check availability
 * after simulating different environments.
 */
export declare function resetAvailabilityCache(): void;
