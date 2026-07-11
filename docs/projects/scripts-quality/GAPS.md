---
schema_version: 1
gap_schema: project_gap_registry
project: "Scripts: Quality"
slug: scripts-quality
status: active
status_note: Preserved as merged_reference to avoid flattening existing gap provenance.
registry_mode: merged_reference
last_updated: "2026-07-10"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 2
visual_proof_required_count: 0
highest_severity: high
proof_freshness: mixed
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/scripts-quality/NORTH_STAR.md
tracker: docs/projects/scripts-quality/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
# Scripts: Quality Gap Registry

Status: active
Last updated: 2026-07-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Current State

- `G3` remains routed to `docs/projects/scripts-git/TRACKER.md`; scripts-quality keeps the checkpoint convention and debt snapshot cadence only.
- `G4` (2026-06-10): the script-tests project merged into this one (DECISION_BLITZ D21); the inherited ST-GAP-001..004 test-coverage gaps are now owned here and remain listed in `docs/projects/script-tests/GAPS.md` (support surface).
- 2026-06-25: Retired `docs/tasks/lint-setup.md` as a duplicate setup-era backlog note. ESLint is already wired through `eslint.config.mjs`, `package.json` `lint`, and the existing quality-debt checkpoint policy. The old clean-lint acceptance target is superseded by the documented debt-summary posture rather than reopened as broad cleanup.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G3 | routed | low | routed | Worker C | confirmed | scripts-git | docs/projects/scripts-git/TRACKER.md | routed | none | not_recorded | docs/projects/scripts-git/TRACKER.md | this docs refresh | Quality gate cadence is documented here, but the automation and runbook mirror belongs to the scripts-git slice, not this project | [docs/DEVELOPMENT_GUIDE.md](F:/Repos/Aralia/docs/DEVELOPMENT_GUIDE.md), [docs/projects/scripts-git/NORTH_STAR.md](F:/Repos/Aralia/docs/projects/scripts-git/NORTH_STAR.md) | Without an explicit route, future agents may treat the cadence mirror as a local scripts-quality task | Keep it routed to scripts-git; if that project opens a runbook or verification slice, mirror the cadence there instead of widening this project | Add the explicit cadence note in scripts-git or the next quality slice only if ownership changes |  |
| G4 | not_started | medium | adjacent_follow_up | scripts-quality maintainer | confirmed | script-tests | docs/projects/script-tests/GAPS.md | imported | none | historical | docs/projects/script-tests/GAPS.md | 2026-06-10 D21 merge | Inherited script-tests coverage gaps ST-GAP-001..004 (spellFieldInventory snapshot test, raceReconciliationInventory CLI/report contract, check-non-ascii full-scan report coverage, validateSpellTemplateContracts regression) are now owned by this project | `docs/projects/script-tests/GAPS.md`; `docs/projects/DECISION_BLITZ_2026-06-10.md` (D21); `docs/projects/scripts-quality/DECISIONS.md` D2 | The merged-in `scripts/__tests__` surface guards migration safety and data contracts; without an owner row here the inherited gaps would go dark after the merge | Close ST-GAP-001 first (deterministic fixture test for `buildSpellFieldInventory()` + `querySpellFieldInventory()`), then proceed per the inherited list | Focused Vitest passes per inherited gap; status mirrored back into the support-surface gap registry |  |
| G5 | review-required | high | blocked_human_decision | Human/project owner | confirmed | scripts-quality | none | decision required; see NORTH_STAR Required Review Brief | none | current 2026-07-10 | charset validation | repository-wide validation sweep | Charset validation reports 8,396 findings across 686 files, including 867 strict and 7,529 soft findings; the current `--write` path rewrites both classes rather than offering a strict-data-only migration. | `docs/reports/charset-review-report.md`; `scripts/check-charset.ts`; `npm run validate` output from 2026-07-10 | A bulk write would change thousands of punctuation sites, while leaving the gate blocked prevents later data validators from running. The remediation policy changes repository-wide content handling. | Choose Option A, B, or C in the NORTH_STAR Required Review Brief before any bulk charset write or new fixer mode. | Selected policy is recorded; the chosen command is covered by focused tests and `npm run validate` advances past charset. | Existing report is durable evidence; raw command output remains local. |
| G6 | review-required | high | blocked_human_decision | Human/project owner | confirmed | scripts-quality | docs/tasks/testing-overhaul/GAPS.md G11 | decision required; see NORTH_STAR Required Review Brief | none | current 2026-07-10 | compiler/type contracts | repository-wide compiler sweep | More than 500 compiler diagnostics remain across incomplete test fixtures, serialized-data boundaries, source migrations, spell-schema drift, and potentially stale declaration twins. | Current `npx tsc --noEmit --pretty false` output; `src/types/spellEffectTypes.ts`; `src/types/combat.ts`; repeated combat fixture failures in testing-overhaul G10/G11 | Fixing symptoms with casts, assertion weakening, or deletion would hide contract drift. Shared fixtures or declaration retirement need explicit ownership and migration proof. | Choose staged root-contract repair or coordinated one-shot cleanup; keep isolated preserving repairs focused until that decision. | Exact compiler aggregate after each approved cluster, focused behavior tests, dependency sync for changed exported/state contracts, and no deleted capability. | ConditionName's serialized boundary is already proven by a clean TSD run. |
| G7 | needs_validation | medium | support_needed_now | scripts-quality maintainer | confirmed | scripts-quality | none | no decision required | none | current 2026-07-10 | `scripts/quality/debt-summary.cjs` | repository-wide quality sweep | `npm run quality:debt` now completes, but required 162 seconds; it reported 555 TypeScript diagnostics, 8 ESLint errors, and 2,583 warnings. | Command run on 2026-07-10; `scripts/quality/debt-summary.cjs` | The entrypoint is usable again, but its long quiet interval still makes timeout versus progress hard to distinguish. | Add bounded progress/timing visibility without changing ordinary push policy, then repeat the checkpoint. | Command completes within a documented budget and names the active subprocess while running, with focused script tests. | Keep raw timing logs outside the durable project docs. |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `merged_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
