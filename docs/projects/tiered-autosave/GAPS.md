# Tiered Autosave Gap Registry

Status: active
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## In-Scope Gaps

### GAP-001: `initializeStorage` is not called during app startup — **RESOLVED**
**Classification:** `support_needed_now`
**Source:** `src/services/saveLoadService.ts` (`initializeStorage`), `src/App.tsx`
**Gap:** Storage migration and IDB availability checks are never triggered if startup never calls `initializeStorage()`.
**Why it matters:** Players may keep using stale localStorage flows and miss one-time migration on first run.
**Resolution (2026-06-10):** Added `useEffect(() => { SaveLoadService.initializeStorage(); }, [])` in `App.tsx` immediately after reducer initialization. Also fixed `buildSlotIndex` ghost mitigation to trust the metadata index when IDB is active, preventing post-migration slots from being incorrectly pruned.
**Proof:** Typecheck passes. Runtime migration proof pending manual verification.

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

### GAP-004: Emergency save path is not used in unload path — **RESOLVED**
**Classification:** `support_needed_now`
**Source:** `src/services/saveLoadService.ts` (`emergencySaveSync`), `src/hooks/useAutoSave.ts`
**Gap:** `beforeunload` path still awaits async save path and does not force emergencySaveSync usage consistently.
**Why it matters:** Async IndexedDB writes can be lost when closing quickly.
**Resolution (2026-06-10):** Added `SaveLoadService.emergencySaveSync(latestStateRef.current)` call in `useAutoSave`'s `beforeunload` handler, before the async `saveNow()` attempt. This guarantees a synchronous localStorage write as a safety net.
**Proof:** Typecheck passes. Runtime stress-test (rapid tab close) pending manual verification.

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

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
