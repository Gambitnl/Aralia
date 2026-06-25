# Item Icons Living Tracker

Status: complete
Last updated: 2026-06-25

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
| T1 | done | Create/update this project's living-project scaffold files from registry evidence. | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/item-icons/*.md` | Completed before the icon execution pass. | `NORTH_STAR.md` + project tracker state |
| T2 | done | Execute item icon batches with output-only SVG generation under `public/assets/icons/items/{item_id}.svg`. | Codex | 2026-06-25 | 810 SVG files in `public/assets/icons/items`; `scripts/generateItemIconSvgs.mjs`; retired `BATCH-01-ITEMS.md` ... `BATCH-41-ITEMS.md` | Batch backlog executed and retired. | File-count and SVG-shape checks passed: 810 files, required `viewBox`, no `currentColor`. |
| T3 | done | Resolve item-to-file mapping for batch scope planning. | Codex | 2026-06-25 | `scripts/generateItemRegistry.ts`; `src/utils/visuals/visualUtils.ts`; generated SVG files; `npm run build:data` | Keep broader taxonomy decisions in `docs/projects/item_categorization/GAPS.md`; item icon files now use the existing generated-registry path contract. | `npm run build:data` passed and `src/data/items/generatedGlossaryItems.ts` now contains 810 `/assets/icons/items/` references. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | support_needed_now | Codex | Item Icons project continuity + item data mapping | Documentation scan in `docs/tasks/item-icons` | The item icon backlog needed confirmation that generated SVG files would be consumed by item registry output. | `scripts/generateItemRegistry.ts`; `src/utils/visuals/visualUtils.ts`; `public/assets/icons/items/*.svg`; `src/data/items/generatedGlossaryItems.ts` | Without that path contract, completing SVG files could still leave the UI on symbolic fallback icons. | Confirmed direct path loading through generated registry logic; broader taxonomy remains routed to Item Categorization. | 810 item SVGs generated; `npm run build:data` passed and generated registry references all 810 item SVG paths. |

## Update Rules

- Update this tracker before starting a new slice.
- Keep active rows with owner, evidence, and explicit next proof/action.
- Route cross-project or non-item-related findings to `docs/projects/GLOBAL_GAPS.md` from `GAPS.md`.
