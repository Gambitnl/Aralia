# Item Icons Living Tracker

Status: active  
Last updated: 2026-05-31

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Create/update this project's living-project scaffold files from registry evidence. | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/item-icons/*.md` | Advance to implementation slice work after this docs handoff. | `NORTH_STAR.md` + batch checklist state |
| T2 | active | Execute item icon batches with output-only SVG generation under `public/assets/icons/items/{item_id}.svg` | Worker D | 2026-05-31 | `JULES_ACCEPTANCE_CRITERIA.md`; `BATCH-01-ITEMS.md` ... `BATCH-41-ITEMS.md` | Begin with `BATCH-01` and continue sequentially; keep per-item checkboxes and file checks current. | Confirm file presence and valid SVG format for each batch |
| T3 | active | Resolve canonical icon taxonomy and item-to-file mapping for batch scope planning | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; generated item evidence; `src/data/items/generatedGlossaryItems.ts` | Add stable taxonomy source or map and capture adoption path in tracker/GAPS. | Validate one-to-one ID/path mapping across an initial sample |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker D | Item Icons project continuity + item data mapping | Documentation scan in `docs/tasks/item-icons` | Canonical icon taxonomy and consumption contract are not documented; generated item IDs and runtime icon IDs are not fully aligned. | Batch docs, `JULES_ACCEPTANCE_CRITERIA.md`, `src/data/items/generatedGlossaryItems.ts` | Blocks confident execution because acceptance output is file-based but runtime usage is token-based in many places. | Add canonical mapping artifact or confirm direct path loading in code. | Run a smoke verification against one batch and verify item icon rendering path. |

## Update Rules

- Update this tracker before starting a new slice.
- Keep active rows with owner, evidence, and explicit next proof/action.
- Route cross-project or non-item-related findings to `docs/projects/GLOBAL_GAPS.md` from `GAPS.md`.
