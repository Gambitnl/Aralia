# GAPS: Tiered Autosave Checkpoint System

## In-Scope Gaps

### GAP-001: `initializeStorage` is not called during app startup
**Classification:** `support_needed_now`
**Source:** `src/services/saveLoadService.ts` (`initializeStorage`), `src/App.tsx`
**Gap:** Storage migration and IDB availability checks are never triggered if startup never calls `initializeStorage()`.
**Why it matters:** Players may keep using stale localStorage flows and miss one-time migration on first run.
**Next action:** Add a one-time startup call (likely in `App.tsx`) before menu/load checks render.
**Next proof:** Verify migration flag and `SLOT_INDEX` behavior after a legacy localStorage save scenario.

### GAP-002: No checkpoint timer runner is connected
**Classification:** `in_scope_now`
**Source:** `src/services/saveLoadService.ts` defines `CHECKPOINT_TIERS`; no `useCheckpointSaves` or equivalent is imported/used.
**Gap:** `indexedDB` save payloads can exist, but checkpoint copy intervals are not created in runtime.
**Why it matters:** User-visible checkpoint tiers are not actually maintained.
**Next action:** Add and wire checkpoint timer hook into gameplay autosave flow.
**Next proof:** Verify each tier writes to its slot after interval threshold.

### GAP-003: Load modal still mixes auto and checkpoint visibility
**Classification:** `adjacent_follow_up`
**Source:** `src/components/SaveLoad/LoadGameModal.tsx`
**Gap:** Autosave and checkpoint slot grouping currently follows generic `isAutoSave` behavior.
**Why it matters:** Confusion between rapid auto-save and checkpoint history.
**Next action:** Add explicit checkpoint section and labels if checkpoint automation is enabled.
**Next proof:** Manual UI check for section names and delete affordances.

### GAP-004: Emergency save path is not used in unload path
**Classification:** `support_needed_now`
**Source:** `src/services/saveLoadService.ts` (`emergencySaveSync`), `src/hooks/useAutoSave.ts`
**Gap:** `beforeunload` path still awaits async save path and does not force emergencySaveSync usage consistently.
**Why it matters:** Async IndexedDB writes can be lost when closing quickly.
**Next action:** Wire unload/visibility handlers to use emergency localStorage sync save before async close path ends.
**Next proof:** Manual refresh/close test with storage mocked to stress async completion timing.

## Adjacent Follow-ups

### GAP-005: Legacy save tests are still localStorage-first
**Classification:** `adjacent_follow_up`
**Source:** `src/services/__tests__/saveLoadService*.ts`
**Gap:** Tests do not validate IDB-backed writes and migration in an end-to-end service setting.
**Why it matters:** Regression risk is high because primary storage path changed.
**Next action:** Add dedicated IndexedDB path tests and fallback path assertions.

### GAP-006: saveLoad README is stale
**Classification:** `adjacent_follow_up`
**Source:** `src/services/saveLoad.README.md`
**Gap:** Doc claims localStorage-first architecture and alert-based errors.
**Why it matters:** Future operators may rely on outdated operational behavior.
**Next action:** Rewrite to reflect IndexedDB-first flow, migration flow, emergency save key, and notification path.
