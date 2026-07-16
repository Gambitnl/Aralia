
# Save/Load Service (`src/services/saveLoadService.ts`)

## Purpose

This service saves and loads game state for Aralia RPG. It is the single API the rest of the app uses to persist and restore progress.

Save payloads live in **IndexedDB**, not localStorage. IndexedDB has 50MB-2GB+ of space, while localStorage has a 5-10MB limit. Saves grow large as party members, map data, message history, and AI interaction logs accumulate, so the larger store prevents quota errors.

Slot metadata (the small index of save summaries) stays in **localStorage**. The Load/Save UI reads this index synchronously while it renders, so it cannot wait for an async IndexedDB read.

If IndexedDB is unavailable (incognito mode, an old browser), the service falls back to a **localStorage-only** mode. Nothing breaks; saves simply use the smaller store.

## Storage Layout

The service splits save data across three stores.

* **IndexedDB (`aralia_rpg_saves` database, `saves` object store)** — holds each full save payload, keyed by slot ID. See `indexedDBStorageService.ts` for the raw IndexedDB wrapper.
* **localStorage** — holds the slot metadata index and, in fallback mode, the save payloads themselves.
* **sessionStorage** — caches the slot metadata index for the current tab so repeated menu reads avoid re-parsing.

## Core Functionality

The service is async-first. `saveGame`, `loadGame`, `deleteSaveGame`, `clearAllSaves`, and `initializeStorage` return Promises. The metadata reads (`getSaveSlots`, `hasSaveGame`, `getLatestSaveTimestamp`) stay synchronous because they only touch the localStorage index.

### `saveGame(gameState, slotName?, notify?, options?): Promise<SaveLoadResult>`

Serializes the game state and writes it to storage.

* **Process**:
    * Copies `gameState` and stamps `saveVersion` (the current `SAVE_GAME_VERSION`) and `saveTimestamp` (`Date.now()`).
    * Resets transient fields (`isLoading`, `isImageLoading`, `error`, `geminiGeneratedActions`, dev/debug viewers, the character sheet modal, and `notifications`). Player-facing overlay flags (`isMapVisible`, `isDiscoveryLogVisible`) persist as-is so resume reopens the panel the player was using.
    * Computes a checksum with `simpleHash` over the serialized state to detect later tampering or corruption.
    * Wraps the state in a `StoredSavePayload` (version, slot ID, slot name, auto-save flag, thumbnail, preview, state, checksum).
    * Writes the payload to IndexedDB when it is available, otherwise to localStorage.
    * Always writes the slot summary to the localStorage metadata index.
* **Returns**: A `SaveLoadResult` with `success`, an optional `message`, and optional `data`.

### `loadGame(slotName?, notify?): Promise<SaveLoadResult>`

Reads a save from storage and heals it for the current game version.

* **Process**:
    * Reads the payload from IndexedDB first, then falls back to localStorage. The fallback covers pre-migration saves, emergency saves, and IndexedDB-unavailable mode.
    * Returns a "no save found" result when neither store has the slot.
    * Parses the payload with `safeJSONParse`; a parse failure returns a "corrupted (unreadable)" result.
    * Verifies the checksum when one is stored; a mismatch returns an "integrity check failed" result.
    * Checks `saveVersion` against `SAVE_GAME_VERSION`; a mismatch returns an "incompatible" result and stops the load.
    * Resets transient fields and restores persisted overlay flags (only strict `true` survives, so hand-edited saves heal to closed).
    * Heals older saves: prunes the discovery log, normalizes party Hit Dice pools and class levels, normalizes dates, backfills the player cell and world history, and seeds rest-tracker fields.
    * Forces `phase` to `PLAYING`. A save written during combat resumes on the exploration surface, because combat runtime is not serialized; the player is told they resumed from a pre-combat checkpoint.
* **Returns**: A `SaveLoadResult`; on success, `data` holds the loaded `GameState`.

### `hasSaveGame(slotName?): boolean`

Reports whether a save exists. Reads the localStorage metadata index, so it stays synchronous.

### `getLatestSaveTimestamp(slotName?): number | null`

Returns the newest `saveTimestamp` for the default slot, or the timestamp for a named slot. Reads the metadata index.

### `deleteSaveGame(slotName?): Promise<void>`

Removes a save from IndexedDB and localStorage, then drops its metadata entry. It deletes from both stores to cover migrated, emergency, and fallback-mode saves.

### `clearAllSaves(): Promise<void>`

Wipes every save from both stores, clears the metadata index and session cache, and removes the emergency-save and checkpoint keys.

### `getSaveSlots(): SaveSlotSummary[]`

Returns metadata for every known slot, newest first. It reads the in-memory cache, then the session cache, then rebuilds from localStorage. Rebuilding merges any legacy single-slot saves it finds.

### `refreshSaveSlotIndex(): SaveSlotSummary[]`

Clears the caches and rebuilds the slot index. Gameplay hooks call this after they clear or repopulate storage so the UI reads current metadata.

### `initializeStorage(): Promise<void>`

Prepares storage on app startup. It detects IndexedDB availability, recovers any emergency save, and runs the one-time migration. It is safe to call more than once; it short-circuits after the first run.

### `emergencySaveSync(gameState): void`

Writes a synchronous best-effort save to localStorage during `beforeunload`. IndexedDB is async and cannot reliably finish before the browser kills the page, so this guarantees a last-moment write. The next `initializeStorage` call recovers it into IndexedDB.

### `isUsingIndexedDB(): boolean`

Reports whether IndexedDB is the active payload store. Useful for storage-status UI or debugging.

### `isCheckpointSlot(slotId): boolean` and `getSlotStorageKey(slotName, isAutoSave?): string`

Helpers that classify checkpoint slots and compute the canonical storage key. UI layers use `getSlotStorageKey` to mirror overwrite detection without duplicating the prefix rules.

## Migration

`initializeStorage` moves existing localStorage saves into IndexedDB once per install, not once per page load.

* It only migrates when IndexedDB is available.
* It reads the `aralia_rpg_migrated_to_idb` flag in localStorage. If the flag is set, migration is already done and does not re-run.
* It finds every localStorage key that looks like a save payload (default slot, auto-save slot, `aralia_rpg_slot_` prefixes, and `aralia_rpg_checkpoint_` prefixes), copies each to IndexedDB, and removes it from localStorage.
* It keeps the metadata index in localStorage, because that index stays there by design.
* It sets the migration flag when done.
* If migration fails, saves stay in localStorage and still work through the fallback read path.

## Emergency Save

The emergency save protects progress when the player closes the tab mid-session.

* **Key**: `aralia_rpg_emergency_save` in localStorage.
* **Write**: `emergencySaveSync` writes a full auto-save payload synchronously during `beforeunload`.
* **Recover**: `initializeStorage` calls the internal recovery step, which moves the emergency payload into IndexedDB under its slot ID and clears the localStorage key.

## Notification Path

The service does not call `alert()`. Instead, each save/load function accepts an optional `notify` callback.

* The callback receives `{ message, type }`, where `type` is a `NotificationType` (`success`, `error`, `warning`, or `info`).
* Calling layers wire this callback to the global NotificationSystem so status messages appear in the in-game toast UI.
* When no callback is passed, the service still logs through `logger` and returns the result; it simply shows no toast.

## Constants

* **`SAVE_GAME_VERSION`** — the current save format version (`"0.1.0"`), used for compatibility checks.
* **`DEFAULT_SAVE_SLOT` / `DEFAULT_SAVE_SLOT_KEY`** — the default manual save slot key.
* **`AUTO_SAVE_SLOT` / `AUTO_SAVE_SLOT_KEY`** — the rapid auto-save slot key.
* **`SLOT_INDEX_KEY`** — the localStorage key for the slot metadata index.
* **`SLOT_PREFIX`** — the prefix for named manual slot keys.
* **`CHECKPOINT_TIERS`** — the checkpoint tier configs (1 min, 5 min, 15 min, 30 min, 1 hour), each with its own slot key and interval.
* **`MIGRATION_FLAG_KEY`** — the localStorage flag that records the localStorage-to-IndexedDB migration.
* **`EMERGENCY_SAVE_KEY`** — the localStorage key for the synchronous emergency save.

## Data Integrity and Versioning

* Each payload carries a `simpleHash` checksum. Loading re-hashes the state and rejects the save if the checksum no longer matches.
* Each payload carries a `saveVersion`. Loading rejects a save whose version does not match `SAVE_GAME_VERSION`.
* Loading also heals older saves that predate current fields (player cell, world history, Hit Dice pools, rest tracker, discovery-log caps).

## Cross-Tab Sync

`setupSlotIndexStorageSync` registers a `storage` event listener so the slot index stays consistent across open tabs. When another tab clears or rewrites saves, the listener debounces and rebuilds this tab's metadata cache. `teardownSlotIndexStorageSync` removes the listener for tests and teardown. The module registers the listener on import.

## Usage

The service is used by:
* **`App.tsx`** — triggers saves and loads.
* **`hooks/useAutoSave.ts`** — drives the rapid auto-save.
* **`hooks/useGameInitialization.ts`** — calls `initializeStorage` on startup.
* **`components/SaveLoad/LoadGameModal.tsx` and `SaveSlotSelector.tsx`** — read slot metadata and manage slots.
* **`components/layout/MainMenu.tsx`** — checks for a save and reads its timestamp for the "Continue" option.

## Related Files

* **`src/services/indexedDBStorageService.ts`** — the raw IndexedDB wrapper (open, put, get, delete, list keys, clear, availability check).
* **`src/utils/storageUtils.ts`** — the `SafeStorage` / `SafeSession` wrappers used for localStorage and sessionStorage.
* **`docs/superpowers/specs/2026-07-14-absorbed-tiered-autosave.md`** — the absorbed tiered-autosave project record (the old `docs/projects/tiered-autosave/` folder now lives on the planmap `tiered-autosave` topic).
