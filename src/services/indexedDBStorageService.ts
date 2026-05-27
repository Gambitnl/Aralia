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

import { logger } from '../utils/logger';

// ============================================================================
// Database Configuration
// ============================================================================
// The database has a single object store ("saves") keyed by slotId.
// Each record's value is the full serialized JSON string of a StoredSavePayload.
// We store strings rather than parsed objects so that the checksum calculation
// (which hashes the serialized JSON) remains consistent.
// ============================================================================

const DB_NAME = 'aralia_rpg_saves';
const DB_VERSION = 1;
const STORE_NAME = 'saves';

// ============================================================================
// Database Connection
// ============================================================================
// We maintain a single cached connection to the database. Opening IndexedDB is
// relatively expensive, so we reuse the same connection for the lifetime of the
// page. If the connection breaks (e.g., browser cleared storage), we re-open.
// ============================================================================

let dbInstance: IDBDatabase | null = null;

/**
 * Opens (or returns the cached) IndexedDB connection.
 * On first open, creates the object store if it doesn't exist.
 * On version upgrade, handles schema migration.
 */
function openDB(): Promise<IDBDatabase> {
  // If we already have a valid connection, reuse it.
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;

    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      // Some browsers throw synchronously if IndexedDB is disabled entirely.
      logger.error('IndexedDB: Failed to open database', { error });
      reject(error);
      return;
    }

    // This fires when the database is first created or when DB_VERSION increases.
    // We create our object store here.
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create the saves store if it doesn't already exist.
      // Using slotId as the key path means each save is uniquely identified
      // by its slot (e.g., "aralia_rpg_autosave", "aralia_rpg_checkpoint_1min").
      // We store a wrapper object { slotId, data } where data is the serialized string.
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
        logger.info('IndexedDB: Created object store', { store: STORE_NAME });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;

      // If the browser closes the connection behind our back (e.g., storage pressure),
      // reset our cached instance so the next call re-opens.
      dbInstance.onclose = () => {
        logger.warn('IndexedDB: Connection closed unexpectedly');
        dbInstance = null;
      };

      // Handle version change requests from other tabs that want to upgrade.
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
        logger.info('IndexedDB: Closed due to version change from another tab');
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      logger.error('IndexedDB: Failed to open database', { error });
      reject(error);
    };

    // Fires when another tab has the database open at a lower version and refuses
    // to close. Unlikely in practice but worth handling.
    request.onblocked = () => {
      logger.warn('IndexedDB: Open request blocked — another tab may need to close');
    };
  });
}

// ============================================================================
// Public API — Save Operations
// ============================================================================
// These are the core read/write/delete operations that saveLoadService.ts calls.
// They mirror the localStorage API shape (get/set/remove by key) but return
// Promises since IndexedDB is async.
// ============================================================================

/**
 * Record shape stored in the IndexedDB object store.
 * slotId is the key (e.g., "aralia_rpg_autosave"), and data is the full
 * serialized JSON string of the StoredSavePayload.
 */
interface SaveRecord {
  slotId: string;
  data: string;
}

/**
 * Writes a save payload to IndexedDB.
 * Overwrites any existing save in the same slot.
 *
 * @param slotId - The unique key for this save slot (e.g., "aralia_rpg_autosave").
 * @param serializedPayload - The full JSON string of the StoredSavePayload.
 */
export async function putSave(slotId: string, serializedPayload: string): Promise<void> {
  const db = await openDB();

  return new Promise<void>((resolve, reject) => {
    // Use readwrite mode so we can write to the store.
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // The put() method inserts or updates. Since slotId is the keyPath,
    // writing the same slotId again overwrites the previous record.
    const record: SaveRecord = { slotId, data: serializedPayload };
    store.put(record);

    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      logger.error('IndexedDB: Failed to write save', { slotId, error: tx.error });
      reject(tx.error);
    };
  });
}

/**
 * Reads a save payload from IndexedDB by slot key.
 *
 * @param slotId - The unique key for this save slot.
 * @returns The serialized JSON string, or null if no save exists in that slot.
 */
export async function getSave(slotId: string): Promise<string | null> {
  const db = await openDB();

  return new Promise<string | null>((resolve, reject) => {
    // Readonly transaction — we're only reading.
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(slotId);

    request.onsuccess = () => {
      const record = request.result as SaveRecord | undefined;
      // Return the serialized JSON string, or null if no record was found.
      resolve(record?.data ?? null);
    };

    request.onerror = () => {
      logger.error('IndexedDB: Failed to read save', { slotId, error: request.error });
      reject(request.error);
    };
  });
}

/**
 * Deletes a single save from IndexedDB.
 *
 * @param slotId - The key of the save slot to remove.
 */
export async function deleteSave(slotId: string): Promise<void> {
  const db = await openDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(slotId);

    tx.oncomplete = () => resolve();
    tx.onerror = () => {
      logger.error('IndexedDB: Failed to delete save', { slotId, error: tx.error });
      reject(tx.error);
    };
  });
}

/**
 * Returns all slot IDs currently stored in IndexedDB.
 * Used during migration and for ghost mitigation (checking which slots
 * actually have data vs. which only have stale metadata).
 */
export async function getAllKeys(): Promise<string[]> {
  const db = await openDB();

  return new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      // getAllKeys returns IDBValidKey[] — our keys are always strings.
      resolve(request.result as string[]);
    };

    request.onerror = () => {
      logger.error('IndexedDB: Failed to list keys', { error: request.error });
      reject(request.error);
    };
  });
}

/**
 * Deletes ALL save data from IndexedDB. Used by the "Clear All Saves" feature.
 * This wipes every record in the saves object store.
 */
export async function clearAllSaves(): Promise<void> {
  const db = await openDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();

    tx.oncomplete = () => {
      logger.info('IndexedDB: All saves cleared');
      resolve();
    };
    tx.onerror = () => {
      logger.error('IndexedDB: Failed to clear saves', { error: tx.error });
      reject(tx.error);
    };
  });
}

// ============================================================================
// Availability Check
// ============================================================================
// Not all environments support IndexedDB. Incognito/private modes in some older
// browsers may throw on open. We check once and cache the result so the rest of
// the system can decide whether to use IndexedDB or fall back to localStorage.
// ============================================================================

let availabilityResult: boolean | null = null;

/**
 * Checks whether IndexedDB is available and functional in the current browser.
 * The result is cached after the first check.
 *
 * Returns true if IndexedDB can be opened and used.
 * Returns false if it's blocked, disabled, or in a restricted context.
 */
export async function isAvailable(): Promise<boolean> {
  // Return cached result if we've already checked.
  if (availabilityResult !== null) {
    return availabilityResult;
  }

  try {
    // If the global indexedDB object doesn't exist, it's not available.
    if (typeof indexedDB === 'undefined') {
      availabilityResult = false;
      return false;
    }

    // Try to actually open the database — some environments have the global
    // but throw on open (e.g., certain Firefox private browsing modes).
    await openDB();
    availabilityResult = true;
    return true;
  } catch {
    logger.warn('IndexedDB: Not available in this environment, will fall back to localStorage');
    availabilityResult = false;
    return false;
  }
}

// ============================================================================
// Connection Cleanup
// ============================================================================
// Exposed for tests and teardown hooks. Not needed during normal gameplay.
// ============================================================================

/**
 * Closes the cached database connection. Used by tests to ensure clean state.
 * In production, the connection stays open for the page's lifetime.
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Resets the availability cache. Used by tests that want to re-check availability
 * after simulating different environments.
 */
export function resetAvailabilityCache(): void {
  availabilityResult = null;
}
