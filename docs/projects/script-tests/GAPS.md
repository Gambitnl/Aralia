# GAPS: Script Tests

Status: active
Last updated: 2026-05-31

The project currently has coverage for helper-level behavior only. A few integration behaviors should be added before expanding scope assumptions.

## Gap Log

| ID | Gap | Classification | Owner | Evidence | Next check/proof |
|---|---|---|---|---|---|
| ST-GAP-001 | No test proves `spellFieldInventory` strict+loose matching in the same session against real generated inventory snapshots in an API path | test_coverage | Worker C | `scripts/spellFieldInventory.test.ts`, `scripts/spellFieldInventory.ts`, `vite.config.ts`, `auditSpellMechanicsContract.ts` | Add a focused API-level test or deterministic fixture check using `buildSpellFieldInventory()` + `querySpellFieldInventory()` with fixed assertions |
| ST-GAP-002 | CLI/report workflows in `raceReconciliationInventory.ts` are mostly untested at end-to-end level (helper functions covered only) | test_coverage | Worker C | `scripts/__tests__/raceReconciliationInventory.test.ts`, `scripts/raceReconciliationInventory.ts`, `docs/reports/race-reconciliation/reconciliation-summary.md` | Add a small fixture-based workflow test for report payload contracts and crosswalk status handling |
| ST-GAP-003 | `check-non-ascii.ts` test coverage does not verify report generation output and severity aggregation from full scan path list | test_coverage | Worker C | `scripts/__tests__/check-non-ascii.test.ts`, `scripts/check-non-ascii.ts`, `package.json` (`validate:charset`) | Add assertion for report file contract + strict/soft summary buckets after `main()` scan path execution |
| ST-GAP-004 | Spell template parity helper is validated, but full spell contract migration guardrails across validators have no focused regression test | test_coverage | Worker C | `scripts/__tests__/spellTemplateValueParity.test.ts`, `validateSpellTemplateContracts.ts`, `scripts/spellTemplateValueParity.ts` | Add regression test for a representative mismatched contract case through `validateSpellTemplateContracts.ts` path |
