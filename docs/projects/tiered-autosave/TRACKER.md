# TRACKER: Tiered Autosave Checkpoint System

## Active Work

### Phase 1: IndexedDB Storage Layer
- `[not_started]` Create `src/services/indexedDBStorageService.ts` — async storage API wrapping IndexedDB
- `[not_started]` Define DB schema: object store for save payloads, object store for slot metadata
- `[not_started]` Implement: `putSave()`, `getSave()`, `deleteSave()`, `getAllSlotMetadata()`, `clearAll()`
- `[not_started]` Handle DB open/upgrade, versioning, error handling
- `[not_started]` Unit tests for IndexedDB service (using fake-indexeddb or similar)

### Phase 2: Migration & Integration
- `[not_started]` Update `saveLoadService.ts` to use IndexedDB instead of localStorage for payloads
- `[not_started]` Keep slot index metadata in localStorage for fast synchronous reads (cache)
- `[not_started]` Auto-migration: detect localStorage saves → copy to IndexedDB → remove from localStorage
- `[not_started]` Handle `beforeunload` save path (IndexedDB is async; need fallback strategy)
- `[not_started]` Update `SafeStorage` cross-tab sync or document single-tab limitation

### Phase 3: Checkpoint Timer System
- `[not_started]` Define checkpoint tier config: `{ id, intervalSeconds, displayLabel }`
- `[not_started]` Create `useCheckpointSaves` hook (or extend `useAutoSave`)
- `[not_started]` Track playtime elapsed per tier, trigger copy from rapid slot at each interval
- `[not_started]` Ensure timers respect: tab background (pause), page reload (persist timer state), game phase eligibility
- `[not_started]` Checkpoint saves are non-deletable by the user (system-managed)

### Phase 4: UI Updates
- `[not_started]` Update `LoadGameModal.tsx` to show checkpoint slots as a new "Checkpoints" section
- `[not_started]` Live-updating age labels (re-render every ~10s showing "X min ago")
- `[not_started]` Visual distinction between Rapid autosave, Checkpoints, and Manual saves
- `[not_started]` Update `saveLoad.README.md` with new system documentation

## Completed Work
- `[done]` Research: Mapped current save system architecture (all key files, data flow, constraints).
- `[done]` Design: Established checkpoint tier intervals, cascading copy approach, IndexedDB migration strategy.
- `[done]` Bootstrapped project skeleton (NORTH_STAR, TRACKER, GAPS, DECISIONS, ARCHITECTURE_NOTES).

## Blockers
- None.

## Discovered Gaps
- See [GAPS.md](./GAPS.md) for classified items.

## Next Expected Actions
- Begin Phase 1: Create the IndexedDB storage service.
