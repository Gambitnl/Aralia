---
schema_version: 1
project: Script Tests
slug: script-tests
category: Test Infrastructure
main_category: Review / Archive
subcategory: Deprecation Review
status: merged-reference
last_updated: 2026-06-12
iteration: 2
confidence: medium
evidence: docs/projects/script-tests; docs/projects/DECISION_BLITZ_2026-06-10.md (D21)
gap_signal: "4 open gaps (ST-GAP-001..004) now owned by scripts-quality after the 2026-06-10 merge decision; ST-GAP-001 remains the safest next slice"
protocol: living project doc set
next_step: "Merged into Scripts: Quality (decision recorded 2026-06-10, DECISION_BLITZ D21). script-tests is now a support surface of docs/projects/scripts-quality; continue ST-GAP work under that project's tracker."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: merged-reference
deprecation_confidence: strong
deprecation_reason: merged_into_scripts_quality_as_support_surface_2026-06-10
canonical_owner: docs/projects/scripts-quality
human_decision_required: "no"
---
# NORTH_STAR: Script Tests

Status: merged-reference â€” decision recorded 2026-06-10; merged into Scripts: Quality
Last updated: 2026-06-12

## Purpose And Scope

This project tracks test-only verification for script-layer behavior in `scripts/__tests__`.  
Coverage is currently focused on script helpers used by validation, reporting, and Dev Hub data tooling, with tests run through the shared Vitest suite.

Primary objective: preserve test continuity for script behavior that guards migration safety and runtime-facing data contracts.

## Dashboard Card Schema

Project: Script Tests  
Slug: script-tests  
Category: Test Infrastructure  
Status: merged-reference (decision recorded 2026-06-10)
Confidence: medium
Evidence: docs/projects/script-tests; docs/projects/DECISION_BLITZ_2026-06-10.md (D21)
Gap signal: 4 open gaps (ST-GAP-001..004) now owned by scripts-quality; ST-GAP-001 is the safest next slice
Protocol: living project doc set
Next step: Merged into Scripts: Quality; continue ST-GAP work under docs/projects/scripts-quality.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-08
Lifecycle status: merged-reference
Deprecation confidence: strong
Deprecation reason: merged_into_scripts_quality_as_support_surface_2026-06-10
Canonical owner: docs/projects/scripts-quality
Human decision required: no

## Decision (2026-06-10): Merge Into Scripts: Quality

Resolved by Remy (project owner) in the 2026-06-10 batched decision session.

- The standalone-vs-merge review question is answered: **Script Tests merges
  into Scripts: Quality.** `script-tests` becomes a support surface of
  `docs/projects/scripts-quality`, and this project's tracker row becomes
  merged-reference.
- The open gap list (ST-GAP-001 through ST-GAP-004) transfers to scripts-quality
  ownership; this folder stays as the reference record of the `scripts/__tests__`
  continuity contract.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D21); local
  record: `docs/projects/script-tests/DECISIONS.md` D2; receiving-side record:
  `docs/projects/scripts-quality/DECISIONS.md` D2.
- Status: decision recorded 2026-06-10; the implementation lane (ST-GAP test
  slices) is open under scripts-quality.

## File Map (Narrow Scope)

- `scripts/__tests__/spellTemplateValueParity.test.ts` -> `scripts/spellTemplateValueParity.ts`  
  - Verifies enum/list parity between structured/runtime template values.
- `scripts/__tests__/spellTemplateApplicability.test.ts` -> `scripts/spellTemplateApplicability.ts`  
  - Verifies applicability placeholder classification and sentinel behavior.
- `scripts/__tests__/spellFieldInventory.test.ts` -> `scripts/spellFieldInventory.ts`  
  - Verifies strict combined query behavior and loose single-filter behavior.
- `scripts/__tests__/raceReconciliationInventory.test.ts` -> `scripts/raceReconciliationInventory.ts`  
  - Verifies deterministic name normalization, crosswalk, and mechanic bucketing.
- `scripts/__tests__/check-non-ascii.test.ts` -> `scripts/check-non-ascii.ts`  
  - Verifies escaped character issue detection and severity labels.

## Implemented State (as of this pass)

- Test folder is complete as a project-level evidence source: `scripts/__tests__`.
- This project is linked from `docs/projects/PROJECT_TRACKER.md` as `Script tests`.
- `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` now hold a narrow continuity contract.
- No production script behavior was changed in this docs-only pass.

## Integration Points

- `package.json` scripts:
  - `test`: `vitest` executes this suite.
  - `validate:charset` / `validate`: execute `scripts/check-non-ascii.ts` and consume its behavior.
- `validateSpellTemplateContracts.ts` and `auditSpellRuntimeTemplate.ts` consume applicability and parity helpers.
- `auditSpellMechanicsContract.ts` and `vite.config.ts` consume `spellFieldInventory` for CLI/tooling use.
- `scripts/raceReconciliationInventory.ts` exposes helper functions tested by `raceReconciliationInventory.test.ts`.
- `validate-data.ts` consumes `check-non-ascii.ts` issue detection.

## Evidence And Verification Notes

- Direct verification references:
  - `npx vitest run scripts/__tests__/raceReconciliationInventory.test.ts` (explicitly used in race prompts/reports).
  - `npx vitest run scripts/__tests__/...` for focused test execution.
  - `npm run test` for the full suite.
  - `npm run validate:charset` for end-to-end charset scan validation behavior.
- The tests in this folder are the durable evidence that core script rules remain consistent during future reconciliation and migration work.

## Gaps And Uncertainties

- Test depth is helper-level, not full pipeline-level in all areas.
- Some script integration paths have behavior risk without dedicated tests (for example full report output shape and script CLI orchestration paths).
- No durable doc-side proof exists yet for full `spellFieldInventory` runtime outputs in API clients beyond focused helper assertions.

## Resume Path

1. Read this file.
2. Read `docs/projects/script-tests/TRACKER.md`.
3. Read `docs/projects/script-tests/GAPS.md`.
4. If a gap looks cross-project or workflow-level, check `docs/projects/GLOBAL_GAPS.md` before adding a new project-local row.
5. Continue from the tracked gaps list and align new tests to any uncovered behavior before expanding script coverage.

## Next Checks

- Keep one narrow pass on `docs/projects/script-tests/TRACKER.md` when any helper coverage expands.
- Keep `GAPS.md` updated for any helper-to-integration blind spots that are validated by behavior changes.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

## Required Review Brief

Title: Script Tests merged into Scripts: Quality
Question: Should Script Tests receive new standalone worker assignments?
Issue: This project is marked merged-reference because its open ST-GAP rows are now owned by scripts-quality after the 2026-06-10 merge decision.
Current behavior: The folder remains as a support/reference surface for test coverage context, but forward work should continue under docs/projects/scripts-quality.
Why blocked: Dispatching workers here would split ownership from the canonical scripts-quality tracker.
Option A: Keep this project as merged-reference and route ST-GAP work through scripts-quality.
Option B: Reopen this as standalone only if a human decides script-test ownership must split again.
Evidence: NORTH_STAR.md frontmatter; GAPS.md ST-GAP-001..004; DECISION_BLITZ D21; canonical_owner docs/projects/scripts-quality.
Decision owner: scripts-quality owner or human operator if reopening is desired
Proof after decision: scripts-quality tracker contains the active ST-GAP work and this project remains non-dispatchable.
