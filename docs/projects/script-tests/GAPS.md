# GAPS: Script Tests

Status: active
Last updated: 2026-06-05

The project currently has helper-level coverage. A few integration behaviors still need deterministic regression tests before scope assumptions can widen.

## Gap Log

| ID | Gap | Classification | Owner | Evidence | Next check/proof |
|---|---|---|---|---|---|
| ST-GAP-001 | No API-facing test proves `spellFieldInventory` strict+loose matching against a generated inventory snapshot | test_coverage | Worker C | `scripts/spellFieldInventory.test.ts`, `scripts/spellFieldInventory.ts`, `vite.config.ts`, `auditSpellMechanicsContract.ts` | Add a deterministic fixture test for `buildSpellFieldInventory()` + `querySpellFieldInventory()` with fixed assertions |
| ST-GAP-002 | `raceReconciliationInventory.ts` CLI/report output still lacks fixture-backed contract coverage | test_coverage | Worker C | `scripts/__tests__/raceReconciliationInventory.test.ts`, `scripts/raceReconciliationInventory.ts`, `docs/reports/race-reconciliation/reconciliation-summary.md` | Add a small workflow test for payload shape and crosswalk status handling |
| ST-GAP-003 | `check-non-ascii.ts` lacks coverage for report generation and severity rollups on a full scan | test_coverage | Worker C | `scripts/__tests__/check-non-ascii.test.ts`, `scripts/check-non-ascii.ts`, `package.json` (`validate:charset`) | Assert report file output and strict/soft summary buckets after `main()` |
| ST-GAP-004 | Full spell contract migration guardrails still lack a regression test through `validateSpellTemplateContracts.ts` | test_coverage | Worker C | `scripts/__tests__/spellTemplateValueParity.test.ts`, `validateSpellTemplateContracts.ts`, `scripts/spellTemplateValueParity.ts` | Add a representative mismatched-contract regression case |
