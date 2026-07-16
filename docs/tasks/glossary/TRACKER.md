# Glossary Living Tracker

Status: active
Last updated: 2026-06-26

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
| T1 | done | Keep docs scaffolding files and links current for the glossary planning surface. | Worker | 2026-05-31 | `NORTH_STAR.md`; `GAPS.md`; `docs/projects/PROJECT_TRACKER.md` | Preserve this state and move to governance alignment. | `TRACKER.md` and `GAPS.md` remain the entry point for planning continuation. |
| T2 | done | Add a terminology-governance handoff note for glossary inclusion and section placement decisions. | Worker | 2026-06-25 | `docs/projects/PROJECT_TRACKER.md` row Glossary; `GLOSSARY_RELEVANT_RULES_TARGET_SET.md`; `DND_BEYOND_RULES_GLOSSARY_FIRST_PASS_AUDIT.md`; `NORTH_STAR.md` | Preserve the governance statement and update it when owner surfaces change. | `NORTH_STAR.md` has a `Terminology Governance` section naming glossary planning, PHB audit, item categorization, and glossary UI owner boundaries. |
| T3 | done | Capture integration posture with PHB audit and item-categorization assumptions. | Worker | 2026-06-25 | `docs/projects/phb2024_glossary_audit/NORTH_STAR.md`; `docs/superpowers/specs/2026-07-14-absorbed-glossary-ui.md`; `docs/projects/item_categorization/NORTH_STAR.md`; `NORTH_STAR.md` | Keep integration routing one-way: terminology policy here, rendered UI in Glossary UI, item taxonomy in Item Categorization, PHB audit reference-only. | Current docs show no duplicate forward owner for PHB audit work; remaining rendered rule-table QA stays in `GAPS.md` G3. |
| T4 | done | Repair strict charset failures in generated glossary JSON without broad documentation cleanup. | Codex | 2026-06-26 | `docs/reports/charset-review-report.md`; `scripts/check-non-ascii.ts`; `GAPS.md` G4; bounded `fixFile` run over `public/data/glossary/entries/**/*.json` fixed 36 files | DONE: Applied deterministic charset fixes only to glossary JSON, not the broader docs tree. | `npm run validate:charset` passed with 0 strict data issues; 3636 soft documentation warnings remain separated from glossary data cleanup. |

## Update Rules

- Keep `active` tasks tied to evidence and next-checkable outputs.
- Add a gap row in `GAPS.md` for any missing governance or ownership decision.
- Keep this tracker focused on docs continuity; do not move runtime tasks here.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/glossary/TRACKER.md","sha256WithoutMarker":"8bca265f43d053decd3cb5a0d6954aae9728125d85d832864e89d1485c94d162","markedAtUtc":"2026-06-25T23:48:24.816Z"} -->
