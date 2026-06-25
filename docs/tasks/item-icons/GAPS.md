# Item Icons Gaps

Status: complete
Last updated: 2026-06-25

## Why this gap log exists

This project needs a clean, minimal handoff that preserves blockers/unknowns without expanding scope.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Codex | Item icon runtime adoption | Source scan + docs scan | The old batch backlog did not have a stable art taxonomy, so the execution pass needed a repeatable type/name-based generation rule. | Retired `BATCH-01-ITEMS.md` ... `BATCH-41-ITEMS.md`; `JULES_ACCEPTANCE_CRITERIA.md`; `scripts/generateItemIconSvgs.mjs` | Without a repeatable generation rule, 810 files could be inconsistent and difficult to audit. | Generated deterministic SVGs from item id, name, and type; broader taxonomy decisions remain routed to `docs/projects/item_categorization/GAPS.md`. | 810 SVG files exist under `public/assets/icons/items`; all checked files use `viewBox="0 0 24 24"` and no `currentColor`. |
| G2 | done | support_needed_now | Codex | Item icon integration mapping | Source scan + code/data references | Item icon data was mainly symbolic until the generator could confirm file-path adoption for present SVG files. | `scripts/generateItemRegistry.ts`; `src/utils/visuals/visualUtils.ts`; generated item SVGs; `src/data/items/generatedGlossaryItems.ts` | Generated art would not help the UI if the item registry could not point at it. | Confirmed `scripts/generateItemRegistry.ts` emits `/assets/icons/items/{id}.svg` when a matching file exists, then ran `npm run build:data`. | `src/data/items/generatedGlossaryItems.ts` now contains 810 `/assets/icons/items/` references. |
| G3 | done | adjacent_follow_up | Codex | Project scope hygiene | Documentation scan | The 41 batch files were live backlog containers after the work moved into project tracking. | Retired `BATCH-01-ITEMS.md` ... `BATCH-41-ITEMS.md`; `TRACKER.md`; `public/assets/icons/items` | Keeping completed batch files would invite duplicate icon-generation passes. | Completed the batch work, recorded completion here and in `TRACKER.md`, then deleted the batch files. | Filename-level item-icon batch backlog removed; generated assets remain as proof. |

## Retired Batch Backlog

The item icon checklist backlog from `BATCH-01-ITEMS.md` through `BATCH-41-ITEMS.md` was still valid on 2026-06-25. The work was executed as a deterministic SVG generation pass, recorded in this project gap file, and the batch files were deleted after their item IDs had corresponding SVG assets.

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
