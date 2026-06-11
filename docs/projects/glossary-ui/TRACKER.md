# Glossary UI Living Tracker

Status: active
Last updated: 2026-06-10

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
| T3 | done | Track item metadata and categorization assumptions affecting this UI | Worker | 2026-06-10 | `scripts/ingestPhbGlossary.ts`, `scripts/generateGlossaryIndex.js`, `src/types/ui.ts`, `src/components/Glossary/GlossaryItemStatBlock.tsx`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D18 | Decided 2026-06-10 (Remy, D18, Option A): item metadata stays glossary-local display-only; shared ingest/registry schema deferred | Glossary-local contract stays documented in NORTH_STAR/AUDIT_OR_PROOF; G7 typed-guard follow-up remains open in GAPS.md |
| T4 | done | Add `npm run glossary:rebuild` script for full pipeline (ingest → index → bundle) | Worker | 2026-06-09 | `package.json`, `docs/projects/glossary-ui/RUNBOOK.md`, `public/data/glossary_bundle.json` | Script exists; keep the named rebuild path synchronized with RUNBOOK proof | Re-run `npm run glossary:rebuild` or `npm run build:data` if the pipeline changes and confirm `public/data/glossary_bundle.json` still rebuilds cleanly |

## Update Rules

- Use `not_started` for planned follow-up docs or audits.
- Use `active` for checks that block confidence in next integration pass.
- Keep `GAPS.md` entries evidence-backed and specific to this folder.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |
