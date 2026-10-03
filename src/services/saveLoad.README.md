
# Save/Load Service (`src/services/saveLoadService.ts`)

> **Module layout (2026-09-09, board task agora-907c.10 / MOD-3.6).** The implementation was split out of the single 995-line `saveLoadService.ts` into `src/services/saveLoad/`. **`src/services/saveLoadService.ts` did not move** — it is now a re-export barrel exporting exactly the same 21 symbols, so every importer is unchanged and remains the single public entry point. Import from `saveLoadService`, not from the modules below. Source references in this document name the module that now holds each function.
>
> * **`src/services/saveLoad/saveLoadCore.ts`** — payload I/O: `saveGame`, `loadGame`, `hasSaveGame`, `getLatestSaveTimestamp`, `deleteSaveGame`, `clearAllSaves`, and the load-time healing of older saves.
> * **`src/services/saveLoad/saveSlotIndex.ts`** — the slot metadata index: `getSaveSlots`, `refreshSaveSlotIndex`, `setupSlotIndexStorageSync`, `teardownSlotIndexStorageSync`, `getSlotStorageKey`, `isCheckpointSlot`, the in-memory/session caches, and the legacy single-slot merge. Registers the cross-tab `storage` listener at module load, exactly as the old file did.
> * **`src/services/saveLoad/saveStorageInit.ts`** — `initializeStorage`, the one-time localStorage-to-IndexedDB migration, emergency-save recovery, and `emergencySaveSync`.
> * **`src/services/saveLoad/saveLoadHelpers.ts`** — `extractPreview`, `normalizeLoadedDates`, playtime accounting, the session-start marker, and `isUsingIndexedDB`. The IndexedDB availability flag lives here rather than in `saveStorageInit.ts` because both the core and the slot index read it while `saveStorageInit` itself needs `getSaveSlots`; holding it in this leaf module keeps that triangle free of the core/slot-index import cycle.
> * **`src/services/saveLoad/saveLoadConstants.ts`** — slot keys, `SAVE_GAME_VERSION`, `CHECKPOINT_TIERS`, and the shared `SaveSlotSummary` / `StoredSavePayload` / `SaveLoadResult` types.

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
    * Heals older saves: prunes the discovery log, normalizes party Hit Dice pools and class levels, normalizes dates, backfills the player cell (`migratePlayerCell`, `src/state/migrations/playerCellMigration.ts`) and world history, and seeds rest-tracker fields. (Source: `src/services/saveLoad/saveLoadCore.ts` lines ~275-305.)
    * Forces `phase` to `PLAYING`. A save written during combat resumes on the exploration surface, because combat runtime is not serialized; the player is told they resumed from a pre-combat checkpoint.
* **Returns**: A `SaveLoadResult`; on success, `data` holds the loaded `GameState`.
* **NPC-memory healing happens one layer up, not inside this function.** The `LOAD_GAME_SUCCESS` reducer case in `src/state/appState.ts` (lines ~560-592) runs the loaded state's `npcMemory` record through `migrateNpcMemoryRecord` (`src/state/migrations/npcMemoryMigration.ts`, landed 2026-09-09 for board task agora-f4e9 "NPC Memory G3") before it lands in app state. See "Migration" below for what it heals.

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

There are two distinct kinds of "migration" in this codebase: the storage-backend migration below (localStorage to IndexedDB), and the loader-side state-shape migrations in `src/state/migrations/`, which heal individual `GameState` fields on load so an old save deserializes cleanly against today's types. This section covers both; the loader migrations are separate pure functions called either from `saveLoadService.loadGame` or from the `LOAD_GAME_SUCCESS` reducer, listed under each field below.

### Storage-backend migration (`initializeStorage`)

`initializeStorage` moves existing localStorage saves into IndexedDB once per install, not once per page load.

* It only migrates when IndexedDB is available.
* It reads the `aralia_rpg_migrated_to_idb` flag in localStorage. If the flag is set, migration is already done and does not re-run.
* It finds every localStorage key that looks like a save payload (default slot, auto-save slot, `aralia_rpg_slot_` prefixes, and `aralia_rpg_checkpoint_` prefixes), copies each to IndexedDB, and removes it from localStorage.
* It keeps the metadata index in localStorage, because that index stays there by design.
* It sets the migration flag when done.
* If migration fails, saves stay in localStorage and still work through the fallback read path.

(Source: `src/services/saveLoad/saveStorageInit.ts`, `initializeStorage` and its internal migration helper.)

### Loader-side state-shape migrations (`src/state/migrations/`)

All three follow the same pattern: a pure, idempotent function that takes an untrusted saved payload and returns the canonical shape, called once from the load path. They share a directory but are wired in at two different points — read the call site before assuming one runs where the others do.

* **`npcMemoryMigration.ts` (`migrateNpcMemory` / `migrateNpcMemoryRecord`) — landed 2026-09-09, board task agora-f4e9 "NPC Memory G3".** Heals the whole `NpcMemory` shape per NPC: `disposition` defaults to `0` when not a finite number; `suspicion` defaults to `SuspicionLevel.Unaware` when not a recognized enum value; `knownFacts` converts legacy plain-string arrays into canonical `KnownFact` records (stamped with the save's game time as `legacyFactTimestamp`, `source: 'direct'`) and backfills the `confidence`/`significance` fields onto structured facts that predate them, dropping any fact missing `id`/`text`/`source`; `goals` becomes `[]` when not an array and drops non-object entries. Every other key on the payload — including fields sibling systems attach via intersection types, such as `emotionalMarkers` (`npcEmotionalMemory.ts`) and `witnessedActs` (`npcWitnessMemory.ts`) — is spread through untouched so a migration never silently deletes data a different system owns. Idempotent: re-running it on an already-canonical record is a no-op that keeps array/object identity.
  * **Called from**: the `LOAD_GAME_SUCCESS` case in `src/state/appState.ts` (lines ~581-592), not from the save service itself. It runs after `loadGame` resolves, against `loadedState.npcMemory`, using the just-loaded `gameTime` as the legacy-fact timestamp.
  * **Tests**: `src/state/migrations/__tests__/npcMemoryMigration.test.ts`.

* **`playerCellMigration.ts` (`migratePlayerCell`) — active, called on every load.** Backfills `GameState.playerCell` (the cell-native world position, Stage 2) when a save predates it. No-op when `playerCell` is already present. Resolution order: (1) if `currentLocationId` parses as a `cell_<id>` location id, recover that cell losslessly; (2) otherwise, if the save has a `worldSeed`, auto-anchor the player to that world's deterministic start town via `applyWfSpawnToMap` (an explicit 2026-07-02 design decision — an unresolvable location otherwise leaves Find Me, "3D at My Location", and map travel all dead ends); (3) with no `worldSeed` to anchor into, `playerCell` becomes `null` (an honest unknown, not a crash). The auto-anchor path logs via `logger.info` and appends a Dev Menu debug-log entry so the silent position change is visible.
  * **Called from**: `src/services/saveLoad/saveLoadCore.ts` line ~302, inside `loadGame`, after date normalization and before Atlas-ground-address handling.
  * **Tests**: `src/state/migrations/__tests__/playerCellMigration.test.ts`.

* **`worldDataMigration.ts` (`migrateMapDataToWorldDataV2`) — ORPHANED, not called from any production path.** Its own file header says so explicitly: it backfilled `MapData.worldData` for pre-v2 saves back when `MapData` carried a 30×20 `tiles` grid. Grid Retirement removed `mapData` from the save format entirely (the world is now the atlas derived from `worldSeed`), so nothing in the current load path — not `saveLoad/saveLoadCore.ts`, not `appState.ts` — calls this function anymore. It is kept per this repo's expansion-first policy as a reference for the migration shape, in case a future restore pipeline needs a similar map-level backfill for legacy v1 saves. Do not describe it as part of the active load path.
  * **Tests**: `src/state/migrations/__tests__/worldDataMigration.test.ts` still exercises the function directly (unit-level, not integration), which is why it keeps passing despite being unreferenced by the app.

## Auto-Save Triggers (`src/hooks/useAutoSave.ts`)

`useAutoSave(gameState, enabledOverride?)` is called from `App.tsx` with the live `GameState` on every render; it owns every automatic write to storage. The save service itself never schedules anything — all timing lives in this hook. (Source: `src/hooks/useAutoSave.ts`, all line numbers below refer to that file.)

**Eligibility** (`eligible`, lines 56-62): auto-save (the rolling save and the checkpoint tiers) only runs when all of — enabled (`enabledOverride` if given, else `gameState.autoSaveEnabled ?? true`), `gameState.phase === GamePhase.PLAYING`, `!gameState.isLoading`, and a non-empty `gameState.party` — hold. Combat phases (`COMBAT`, `BATTLE_MAP_DEMO`) are deliberately excluded because combat runtime (turn order, initiative, battle map) is hook-local and never serialized.

There are four independent triggers, all writing through `SaveLoadService.saveGame`:

1. **Rolling auto-save** (lines 127-153): on every `gameState` change while eligible, a debounce/throttle timer reschedules a write to `AUTO_SAVE_SLOT_KEY`. `AUTO_SAVE_DEBOUNCE_MS = 1500`; `AUTO_SAVE_THROTTLE_MS = 10_000`. If at least 10s have passed since the last save, the next write fires with `delay = 0`; otherwise it waits the 1.5s debounce. The delay is intentionally the *shorter* of the two, never longer — an earlier version re-armed a flat 1.5s debounce on every world-clock tick (about once a second during exploration), which kept cancelling itself and starved the rolling save for as long as the player kept playing (only the reload-time emergency save persisted anything). The throttle floor guarantees a save at least every 10s during active play.
2. **Pre-combat checkpoint** (lines 101-125): a one-shot save to `AUTO_SAVE_SLOT_KEY` (`displayName: 'Pre-Combat Checkpoint'`) fires when `gameState.phase` transitions from a gameplay phase into a combat phase. Because combat itself is never auto-saved, this checkpoint becomes the resume point if the player refreshes or closes mid-fight; `loadGame` heals the resumed `phase` back to `PLAYING` (see above) and tells the player they resumed from a pre-combat checkpoint.
3. **Recovery checkpoint tiers** (lines 164-193): while eligible, one `setInterval` timer per entry in `SaveLoadService.CHECKPOINT_TIERS` periodically snapshots the current state into that tier's own slot, each tagged with its `displayLabel`. Current tiers (`src/services/saveLoad/saveLoadConstants.ts` lines ~93-99): `checkpoint_1min` (60s, slot `aralia_rpg_checkpoint_1min`), `checkpoint_5min` (300s), `checkpoint_15min` (900s), `checkpoint_30min` (1800s), `checkpoint_1hr` (3600s). Each tier tracks its own in-flight save (`checkpointSavingRef`) so a slow write cannot overlap itself, but different tiers can save concurrently. These exist because the rapid auto-save only protects the latest moment — it cannot recover an earlier healthy state after several bad actions.
4. **Tab-hidden / unload flush** (lines 195-222): a `visibilitychange` listener calls the same debounced `saveNow()` path when the tab becomes hidden. A `beforeunload` listener does two things: it calls `SaveLoadService.emergencySaveSync` (see "Emergency Save" below) synchronously, then also fires the normal async `saveNow()` in case it completes before the page is killed.

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
* **`App.tsx`** — triggers manual saves and loads, and mounts `useAutoSave`.
* **`hooks/useAutoSave.ts`** — drives the rolling auto-save, the pre-combat checkpoint, the recovery checkpoint tiers, and the tab-hidden/unload flush. See "Auto-Save Triggers" above for the full breakdown.
* **`hooks/useGameInitialization.ts`** — calls `initializeStorage` on startup.
* **`components/SaveLoad/LoadGameModal.tsx` and `SaveSlotSelector.tsx`** — read slot metadata and manage slots.
* **`components/layout/MainMenu.tsx`** — checks for a save and reads its timestamp for the "Continue" option.
* **`state/appState.ts`** — the `LOAD_GAME_SUCCESS` reducer case runs `migrateNpcMemoryRecord` against the loaded state before it lands in app state (see "Migration" above).

## Related Files

* **`src/services/indexedDBStorageService.ts`** — the raw IndexedDB wrapper (open, put, get, delete, list keys, clear, availability check).
* **`src/utils/storageUtils.ts`** — the `SafeStorage` / `SafeSession` wrappers used for localStorage and sessionStorage.
* **`src/state/migrations/npcMemoryMigration.ts`** — loader-side `NpcMemory` shape healing, called from `appState.ts`'s `LOAD_GAME_SUCCESS` case. Tests: `src/state/migrations/__tests__/npcMemoryMigration.test.ts`.
* **`src/state/migrations/playerCellMigration.ts`** — loader-side `playerCell` backfill, called from `saveLoad/saveLoadCore.loadGame`. Tests: `src/state/migrations/__tests__/playerCellMigration.test.ts`.
* **`src/state/migrations/worldDataMigration.ts`** — orphaned `MapData.worldData` backfill, kept for reference only; not called from any production path. Tests: `src/state/migrations/__tests__/worldDataMigration.test.ts`.
* **`docs/superpowers/specs/2026-07-14-absorbed-tiered-autosave.md`** — the absorbed tiered-autosave project record (the old `docs/projects/tiered-autosave/` folder now lives on the planmap `tiered-autosave` topic).
