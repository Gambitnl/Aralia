# ARCHITECTURE NOTES: Tiered Autosave Checkpoint System

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      App.tsx                             │
│  ┌──────────────┐  ┌────────────────────────────────┐   │
│  │ useAutoSave   │  │ useCheckpointSaves (NEW)       │   │
│  │ (rapid save)  │  │ - tracks playtime per tier     │   │
│  │ debounce+     │  │ - copies rapid → tier slot     │   │
│  │ throttle      │  │ - pauses on tab background     │   │
│  └──────┬───────┘  └────────────────┬───────────────┘   │
│         │                           │                    │
│         ▼                           ▼                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │            saveLoadService.ts                     │   │
│  │  saveGame() / loadGame() / getSaveSlots()         │   │
│  │  - Slot metadata → localStorage (fast cache)      │   │
│  │  - Save payloads → IndexedDB (via new service)    │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │                                    │
│         ┌───────────┴───────────┐                       │
│         ▼                       ▼                        │
│  ┌──────────────┐  ┌────────────────────────────────┐   │
│  │ localStorage  │  │ indexedDBStorageService.ts (NEW)│   │
│  │ (metadata     │  │ - putSave(key, payload)         │   │
│  │  + prefs)     │  │ - getSave(key) → payload        │   │
│  └──────────────┘  │ - deleteSave(key)               │   │
│                     │ - getAllKeys()                   │   │
│                     │ - clearAll()                    │   │
│                     └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## IndexedDB Schema

**Database name:** `aralia_rpg_saves`
**Version:** 1

### Object Store: `saves`
- **Key path:** `slotId` (string)
- **Value:** Full `StoredSavePayload` JSON string
- No indexes needed (always accessed by key)

The service stores serialized JSON strings (not structured objects) to maintain compatibility with the existing checksum system, which hashes the serialized JSON.

## Checkpoint Timer Mechanism

Each checkpoint tier has:
```ts
interface CheckpointTierConfig {
  id: string;                    // e.g. "checkpoint_1min"
  slotKey: string;               // e.g. "aralia_rpg_checkpoint_1min"
  intervalSeconds: number;       // e.g. 60
  displayLabel: string;          // e.g. "1 Minute Checkpoint"
}
```

The `useCheckpointSaves` hook:
1. Maintains a `lastCopiedAt: Record<tierId, number>` tracking wall-clock time of last copy per tier.
2. On each render (or on a `setInterval`), computes elapsed playtime since last copy.
3. If elapsed >= tier's intervalSeconds, reads the rapid autosave from IndexedDB and writes it to the tier's slot.
4. Pauses accumulation when `document.visibilityState === 'hidden'`.
5. Persists `lastCopiedAt` timestamps in localStorage so they survive page reloads.

## Migration Flow

On app startup (in `useGameInitialization` or `saveLoadService` init):
1. Check if localStorage contains save keys (`aralia_rpg_autosave`, `aralia_rpg_slot_*`, `aralia_rpg_default_save`).
2. If any exist AND IndexedDB does not have them → migrate each payload to IndexedDB.
3. After successful migration, remove the payload from localStorage (but keep metadata index).
4. Set a `aralia_rpg_migrated_to_idb` flag in localStorage so migration doesn't re-run.
5. If IndexedDB is unavailable (incognito, old browser), fall back to localStorage-only mode.

## beforeunload Strategy

Since IndexedDB is async and `beforeunload` gives no time guarantee:
1. Primary: Use `visibilitychange` → `hidden` to flush saves. This fires reliably before unload in modern browsers and gives enough time for an async write.
2. Fallback: On `beforeunload`, write a "emergency save" to localStorage (sync). On next load, if an emergency save exists, migrate it to IndexedDB and delete from localStorage.
3. The emergency save reuses the existing localStorage path, so no new API surface is needed.

## UI Architecture

The Load Game modal gains a third section between Echoes and Chronicles:

```
┌────────────────────────────────────────┐
│  Resume Journey                        │
│                                        │
│  ── Echoes (Auto-Saves) ──            │
│  🔄 Auto-Save          just now        │
│                                        │
│  ── Checkpoints ──                    │
│  ⏱️ Checkpoint          32 seconds ago │
│  ⏱️ Checkpoint          4 minutes ago  │
│  ⏱️ Checkpoint          12 minutes ago │
│  ⏱️ Checkpoint          38 minutes ago │
│  ⏱️ Checkpoint          1 hour ago     │
│                                        │
│  ── Chronicles ──                     │
│  📜 My Manual Save      May 27, 2026  │
│                                        │
└────────────────────────────────────────┘
```

Age labels re-render every ~10 seconds using a `setInterval` inside the modal. Labels use relative time formatting (e.g., "just now", "32 seconds ago", "4 minutes ago").

Checkpoint slots are NOT deletable by the user — they're system-managed. They don't appear in the Save Slot Selector (only in Load).
