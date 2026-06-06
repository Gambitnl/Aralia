# NORTH_STAR: Script Tests

Status: active  
Last updated: 2026-06-05

## Purpose And Scope

This project tracks test-only verification for script-layer behavior in `scripts/__tests__`.  
Coverage is currently focused on script helpers used by validation, reporting, and Dev Hub data tooling, with tests run through the shared Vitest suite.

Primary objective: preserve test continuity for script behavior that guards migration safety and runtime-facing data contracts.

## Dashboard Card Schema

Project: Script Tests  
Slug: script-tests  
Category: Test Infrastructure  
Status: partial  
Confidence: medium  
Evidence: docs/projects/script-tests  
Gap signal: 4 open gaps; ST-GAP-001 is the safest next slice  
Protocol: living project doc set  
Next step: Close one deterministic script test gap or record why it stays deferred.  
Required verification: scoped_tests, docs_consistency  
Completed verification: docs_consistency  
Last proof: 2026-06-05  
Workflow gaps reviewed: 2026-06-05

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
