# Glossary UI Tracker

Status: active
Last updated: 2026-06-09

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
| T2 | done | Capture non-dev glossary rebuild contract as a stable project-level check | Antigravity | 2026-06-08 | `docs/projects/glossary-ui/RUNBOOK.md`, `docs/projects/glossary-ui/NORTH_STAR.md` | Pipeline documented. Next: add `npm run glossary:rebuild` script to close G1. | Verify the documented command sequence updates `public/data/glossary_bundle.json` from glossary source changes |
| T3 | active | Track item metadata and categorization assumptions affecting this UI | Worker | 2026-06-05 | `scripts/ingestPhbGlossary.ts`, `scripts/generateGlossaryIndex.js`, `docs/projects/item_categorization/NORTH_STAR.md` | Keep glossary UI assumptions aligned with item-categorization decisions without duplicating ownership | Confirm grouping + metadata fields used by UI are durable |
| T4 | done | Add `npm run glossary:rebuild` script for full pipeline (ingest → index → bundle) | Worker | 2026-06-09 | `package.json`, `docs/projects/glossary-ui/RUNBOOK.md`, `public/data/glossary_bundle.json` | Script exists; keep the named rebuild path synchronized with RUNBOOK proof | Re-run `npm run glossary:rebuild` or `npm run build:data` if the pipeline changes and confirm `public/data/glossary_bundle.json` still rebuilds cleanly |

## Update Rules

- Use `not_started` for planned follow-up docs or audits.
- Use `active` for checks that block confidence in next integration pass.
- Keep `GAPS.md` entries evidence-backed and specific to this folder.
