# Item Icons Gaps

Status: active  
Last updated: 2026-05-31

## Why this gap log exists

This project needs a clean, minimal handoff that preserves blockers/unknowns without expanding scope.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker D | Item icon runtime adoption | Source scan + docs scan | No canonical icon taxonomy is documented for item icon categories and naming. | `docs/tasks/item-icons` (batch files), `JULES_ACCEPTANCE_CRITERIA.md` | Inconsistent category/shape expectations can produce duplicate or non-convergent outputs across batches. | Define or confirm taxonomy source and add it as the stable acceptance precondition for future batches. | First completed batch shows consistent category naming and visual uniqueness across different entries. |
| G2 | active | support_needed_now | Worker D | Item icon integration mapping | Source scan + code/data references | Item icon data is mainly symbolic (`magic`, `ring`, etc.) and not consistently file-path-based, while output rules mandate files in `public/assets/icons/items`. | `src/data/items/generatedGlossaryItems.ts`, batch docs, `public/assets/icons/items/potion_of_healing.svg` | Unclear if generated SVGs will be discovered automatically or require registry mapping updates, which can block rendering adoption. | Verify runtime lookup logic and document required integration path before batch completion claims. | Add a known-good rendered item icon proof to show path-based consumption. |
| G3 | active | adjacent_follow_up | Worker D | Project scope hygiene | Documentation scan | No evidence of completion state for 41 batches in tracker fields beyond file checkboxes. | `BATCH-01-ITEMS.md` ... `BATCH-41-ITEMS.md`, `TRACKER.md` | Missing completion markers can hide partial progress and cause duplicated work. | Add explicit batch-level completion checks in `TRACKER.md` when each batch starts/finishes. | One pass of batch 1..n shows checklist + proof check consistency. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the primary task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Import Rules

- Route cross-project or unrelated findings to `docs/projects/GLOBAL_GAPS.md`.
