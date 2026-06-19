# Glossary UI Living Tracker

Status: active
Last updated: 2026-06-19

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
| G7 | done | Add an ingestion guard for item metadata so equipment glossary entries keep a narrow, predictable metadata shape. | Agent Matrix lane `as-mqk34p3p-cc45f6` | 2026-06-19 | `scripts/ingestPhbGlossary.ts`; `scripts/__tests__/ingestPhbGlossary.test.ts`; focused Vitest run passed 2026-06-19. | Keep generated glossary data under review because the rebuild touched many equipment JSON files. | Re-run `npm test -- --run scripts/__tests__/ingestPhbGlossary.test.ts` after future ingestion edits. |

## Update Rules

- Use `not_started` for planned follow-up docs or audits.
- Use `active` for checks that block confidence in next integration pass.
- Keep `GAPS.md` entries evidence-backed and specific to this folder.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
