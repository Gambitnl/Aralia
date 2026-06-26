# Glossary Gaps

Status: active
Last updated: 2026-06-26

## Purpose

Track glossary-planning gaps discovered from the current docs-only pass and route
them without collapsing scope.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | support_needed_now | Worker | docs/projects/PROJECT_TRACKER.md | docs/tasks/glossary scan | No explicit terminology-governance document exists for final inclusion/exclusion decisions. | `NORTH_STAR.md` now has `Terminology Governance`; `docs/projects/PROJECT_TRACKER.md` row for Glossary no longer advertises the governance note as missing. | Terms and exclusions can drift across updates without a stable policy anchor. | Preserve the governance section and update it when ownership changes. | 2026-06-25 docs proof: `NORTH_STAR.md` names glossary planning, PHB audit, item categorization, and glossary UI owner boundaries. |
| G2 | done | adjacent_follow_up | Worker | docs/projects/phb2024_glossary_audit | docs/projects/PHB glossary audit scan | PHB 2024 audit scope completion is split from this task and there is no shared handoff checklist for term set overlap. | `docs/projects/phb2024_glossary_audit/NORTH_STAR.md`; `GLOSSARY_RELEVANT_RULES_TARGET_SET.md`; `NORTH_STAR.md` Terminology Governance | Overlap between "remaining PHB families" and current glossary term priority can produce duplicate or inconsistent target sets. | Keep PHB audit reference-only and route mixed priority/rule-surface questions through this glossary task area. | 2026-06-25 docs proof: PHB audit D24 reference-only state was cross-checked against the glossary target-set note. |
| G3 | not_started | adjacent_follow_up | Glossary maintenance | PHB 2024 rules glossary QA | `docs/tasks/2024_phb_rules_migration.md` retirement pass | Complex PHB 2024 rule tables still need a rendered Glossary UI inspection after ingestion. | Retired `docs/tasks/2024_phb_rules_migration.md`; `scripts/ingestRules.ts`; `public/data/glossary/entries/rules/`; `src/components/Glossary/glossaryRuleChapters.ts` | The ingestion script handled nested tables best-effort, so visually dense rule pages such as Exhaustion or weapon properties may render poorly even though the index builds. | Inspect representative complex rule pages in the Glossary UI and patch `ingestRules.ts` or generated Markdown only if the rendered table structure is wrong. | Rendered proof or screenshot notes for representative complex rule pages plus regenerated glossary index if changes are needed. |
| G4 | done | support_needed_now | Codex | Glossary data charset validation | backlog-retirement pass over `docs/reports/charset-review-report.md` | Current `npm run validate:charset` failed on strict auto-fixable non-ASCII characters in generated glossary JSON even though the generated review report only listed manual/suspicious review items. | `docs/reports/charset-review-report.md`; `scripts/check-non-ascii.ts`; `public/data/glossary/entries/**/*.json`; initial 2026-06-26 `npm run validate:charset` output: 3859 files scanned, 300 files with issues, 3743 total issues, 107 strict issues, with strict examples under `public/data/glossary/entries`; bounded repair fixed 36 glossary JSON files. | Strict charset failures block the broad validation path and can reintroduce cross-platform text drift in glossary data. The report remains useful for manual soft-doc mojibake, but it is not enough proof that charset validation is green. | DONE 2026-06-26: applied the deterministic `fixFile` helper only to `public/data/glossary/entries/**/*.json`, then reran validation. | `npm run validate:charset` passed after repair: 3859 files scanned, 264 files with issues, 3636 total issues, 0 strict issues, 3636 soft documentation warnings. |

## Classification Reference

- `in_scope_now`: required to complete a reliable handoff for this task.
- `support_needed_now`: needed now to continue with stable planning posture.
- `adjacent_follow_up`: useful and related, but not required to complete this docs layer.
- `out_of_scope`: should be tracked elsewhere.
- `blocked_human_decision`: requires explicit owner choice.
- `blocked_external_state`: blocked by another team/build/service dependency.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/glossary/GAPS.md","sha256WithoutMarker":"a4f97388ce7bf43546471d16ef3f5d25ff8ae142c6cb0f8b09759eeb178edc3a","markedAtUtc":"2026-06-25T23:48:24.814Z"} -->
