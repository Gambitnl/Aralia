# Glossary UI Tracker

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
| T1 | done | Update living-project docs for current Glossary UI implementation | Worker | 2026-05-31 | `docs/projects/glossary-ui/NORTH_STAR.md`, `docs/projects/glossary-ui/GAPS.md` | Keep scope and file map stable; avoid runtime edits | `TRACKER` and `GAPS` read path remains clear |
| T2 | active | Capture non-dev glossary rebuild contract as a stable project-level check | Worker | 2026-05-31 | `vite.config.ts`, `scripts/bundle-static-data.ts` | Define and document expected refresh/rebuild flow for CI and local maintenance | Run build-data flow and verify `public/data/glossary_bundle.json` updates |
| T3 | active | Track item metadata and categorization assumptions affecting this UI | Worker | 2026-05-31 | `scripts/ingestPhbGlossary.ts`, `scripts/generateGlossaryIndex.js`, `docs/projects/item_categorization/NORTH_STAR.md` | Align glossary UI assumptions with item-categorization decisions without duplicating ownership | Confirm grouping + metadata fields used by UI are durable |

## Update Rules

- Use `not_started` for planned follow-up docs or audits.
- Use `active` for checks that block confidence in next integration pass.
- Keep `GAPS.md` entries evidence-backed and specific to this folder.
