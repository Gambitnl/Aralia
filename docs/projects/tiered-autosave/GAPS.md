# Tiered Autosave Gap Registry

Status: active
Last updated: 2026-06-12

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
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
| GAP-002 | active | in_scope_now | Tiered Autosave | Autosave/checkpoint runtime | implementation scan | No checkpoint timer runner is connected. | `src/services/saveLoadService.ts` defines `CHECKPOINT_TIERS`; no `useCheckpointSaves` or equivalent is imported/used. | IndexedDB save payloads can exist, but checkpoint copy intervals are not created in runtime. | Add and wire checkpoint timer hook into gameplay autosave flow. | Verify each tier writes to its slot after interval threshold. |
| GAP-003 | open | adjacent_follow_up | Tiered Autosave | Save/load UI | implementation scan | Load modal still mixes autosave and checkpoint visibility. | `src/components/SaveLoad/LoadGameModal.tsx` | Users can confuse rapid autosave and checkpoint history. | Add explicit checkpoint section and labels if checkpoint automation is enabled. | Manual UI check for section names and delete affordances. |
| GAP-005 | open | adjacent_follow_up | Tiered Autosave | Save/load tests | implementation scan | Legacy save tests are still localStorage-first. | `src/services/__tests__/saveLoadService*.ts` | Primary storage path changed, so IDB and migration regressions are under-covered. | Add dedicated IndexedDB path tests and fallback assertions. | Focused save/load service test run. |
| GAP-006 | open | adjacent_follow_up | Tiered Autosave | Save/load documentation | implementation scan | `saveLoad.README.md` is stale. | `src/services/saveLoad.README.md` | Future operators may rely on outdated localStorage-first behavior. | Rewrite docs for IndexedDB-first flow, migration, emergency save key, and notification path. | README reflects current storage flow and links to proof. |

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
