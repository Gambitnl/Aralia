# NORTH STAR: Tiered Autosave Checkpoint System

**Project Objective:**
Replace the single-slot localStorage autosave with a tiered checkpoint system backed by IndexedDB. Players get multiple recovery points at logarithmically-spaced intervals (rapid, 1min, 5min, 15min, 30min, 1hr), giving them safety nets ranging from seconds to an hour into the past.

**Intended Outcome:**
1. All save data (autosave + manual saves) stored in IndexedDB instead of localStorage.
2. Existing localStorage saves auto-migrated on first load; old data cleaned up after success.
3. Six autosave checkpoint slots with independent refresh timers based on real-world playtime.
4. Load Game UI ("Resume Journey") displays checkpoints with live-updating age labels.
5. The rapid autosave continues to work exactly as before (debounce + throttle on state changes).

**Current State:**
- Single autosave slot (`aralia_rpg_autosave`) in localStorage.
- Autosave triggers via debounce (1.5s) + throttle (10s) on GameState changes.
- Manual save slots also in localStorage with a metadata index.
- Playtime tracked via wall-clock elapsed time (`Date.now() - sessionStartedAtMs`).
- No IndexedDB usage anywhere in the codebase.
- No save compression; raw JSON could be hundreds of KB to 1MB+.
- localStorage quota (5-10MB) is already a risk with growing game state.

**Scope Boundaries:**
- **In Scope:** IndexedDB storage layer, migration from localStorage, checkpoint timer system, Load UI updates for checkpoints.
- **Out of Scope:** Save compression, save export/import, save migration logic (version upgrades), save size reporting, in-game time tracking changes. These are recorded as adjacent follow-ups.

**Key Source Files:**
| File | Role |
|------|------|
| `src/services/saveLoadService.ts` | Core save/load API, slot index, StoredSavePayload type |
| `src/hooks/useAutoSave.ts` | Autosave hook (debounce+throttle, visibility/unload handlers) |
| `src/utils/core/storageUtils.ts` | SafeStorage/SafeSession wrappers |
| `src/utils/core/hashUtils.ts` | simpleHash for save integrity |
| `src/components/SaveLoad/LoadGameModal.tsx` | Load UI ("Resume Journey") |
| `src/components/SaveLoad/SaveSlotSelector.tsx` | Save UI ("Chronicle Journey") |
| `src/App.tsx` | Consumes useAutoSave (line 168) |

**Design Decisions:**
- Checkpoint tiers: Rapid (~10s), 1min, 5min, 15min, 30min, 1hr — 6 total autosave slots.
- Each checkpoint independently copies the rapid autosave data at its own interval.
- Timers based on real-world playtime (matching existing `playtimeSeconds` tracking), not in-game clock.
- Labels show actual age ("4 minutes ago"), not fixed descriptions ("5 minute checkpoint").
- IndexedDB replaces localStorage for all save data (not just autosaves) to solve the quota risk.
- Small metadata (slot index, preferences) can remain in localStorage for sync/perf.

**Assumptions:**
1. A typical save payload is ~200KB-1MB based on GameState complexity. 6 autosave slots ≈ 1.2-6MB — trivial for IndexedDB.
2. The `idb` npm package (or raw IndexedDB API) is acceptable as a dependency.
3. Cross-tab sync can be deferred. Accept single-tab behavior for IndexedDB saves initially.
4. The `beforeunload` save path needs special handling since IndexedDB is async (localStorage was sync).

**Project Pointers:**
- [Living Tracker](./TRACKER.md)
- [Gap Registry](./GAPS.md)
- [Decision Log](./DECISIONS.md)
- [Architecture Notes](./ARCHITECTURE_NOTES.md)

**Resume Path:**
Read `TRACKER.md` for current active task and blockers. The implementation is split into 4 phases: (1) IndexedDB storage layer, (2) migration, (3) checkpoint timer system, (4) UI updates. Each phase is a bounded task in the tracker.
