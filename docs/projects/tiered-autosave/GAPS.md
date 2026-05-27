# GAPS: Tiered Autosave Checkpoint System

## In-Scope Gaps

### GAP-001: `beforeunload` async save path
**Classification:** `in_scope_now`
**Description:** The current `beforeunload` handler calls `saveGame()` which writes synchronously to localStorage. IndexedDB is async — writes in `beforeunload` may not complete before the browser kills the page.
**Impact:** Players could lose their rapid autosave on tab close/refresh.
**Proposed Resolution:** Keep a synchronous localStorage fallback for emergency `beforeunload` saves, then migrate the emergency save to IndexedDB on next load. Alternatively, use `navigator.sendBeacon()` if the payload fits, or rely on `visibilitychange` (which fires reliably before `beforeunload` in modern browsers).
**Status:** Open.

### GAP-002: Playtime not in GameState
**Classification:** `in_scope_now`
**Description:** `playtimeSeconds` is NOT a field on `GameState`. It's calculated ad-hoc in `saveLoadService.ts` via `Date.now() - sessionStartedAtMs` and stored only in the `SaveSlotSummary` metadata. The checkpoint timer system needs a reliable elapsed-playtime counter to know when to fire each tier.
**Impact:** Can't use GameState for checkpoint timing; need an independent timer mechanism.
**Proposed Resolution:** Track elapsed playtime in the checkpoint hook using `Date.now()` intervals, pausing when the tab is backgrounded (`visibilitychange`). This mirrors how the existing `calculatePlaytimeSeconds()` works but runs continuously.
**Status:** Open.

## Adjacent Follow-ups

### GAP-003: Save compression
**Classification:** `adjacent_follow_up`
**Description:** Save payloads are uncompressed raw JSON. LZ-string compression could reduce save sizes by 60-80%.
**Why deferred:** Not blocking the checkpoint feature. IndexedDB's larger quota makes this less urgent.

### GAP-004: Save version migration logic
**Classification:** `adjacent_follow_up`
**Description:** Current version mismatch = hard fail (`loadGame` returns failure). No migration/upgrade path for older saves.
**Why deferred:** Not related to checkpoint system. Existing behavior preserved.

### GAP-005: Cross-tab sync for IndexedDB
**Classification:** `adjacent_follow_up`
**Description:** localStorage fires `storage` events for cross-tab sync. IndexedDB has no equivalent. Multiple tabs could write conflicting saves.
**Why deferred:** Single-tab is acceptable for initial release. Can add BroadcastChannel API later.

### GAP-006: Save size reporting
**Classification:** `out_of_scope`
**Description:** No visibility into how large individual saves are. Could be useful for debugging quota issues.

### GAP-007: Save export/import
**Classification:** `out_of_scope`
**Description:** No mechanism to backup or transfer saves. With IndexedDB this becomes slightly harder since users can't inspect it as easily as localStorage.
