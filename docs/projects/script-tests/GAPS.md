---
schema_version: 1
gap_schema: project_gap_registry
project: Script Tests
slug: script-tests
status: merged-reference
status_note: gaps owned by scripts-quality since 2026-06-10
registry_mode: merged_reference
last_updated: "2026-06-10"
gap_count: 4
open_gap_count: 4
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: mixed
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/script-tests/NORTH_STAR.md
tracker: docs/projects/script-tests/TRACKER.md
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
# Script Tests Gap Registry

Status: merged-reference
Last updated: 2026-06-10

The project currently has helper-level coverage. A few integration behaviors still need deterministic regression tests before scope assumptions can widen.

> Merge note (2026-06-10): Script Tests merged into Scripts: Quality (Remy, `docs/projects/DECISION_BLITZ_2026-06-10.md` D21). The gap rows below remain open and valid, but ownership and worker assignment now run through `docs/projects/scripts-quality` (this folder is its support surface).

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ST-GAP-001 | resolved | medium | test_coverage | Worker C | confirmed | project |  | none | none | historical | scripts/spellFieldInventory.test.ts | helper coverage | No API-facing test proves `spellFieldInventory` strict+loose matching against a generated inventory snapshot | `scripts/spellFieldInventory.test.ts`, `scripts/spellFieldInventory.ts`, `vite.config.ts`, `auditSpellMechanicsContract.ts`; board-reconciled 2026: task "W2-P2: Fixture tests for spell-field inventory API + non-ascii checker report rollups" — spellFieldInventory.ts (added optional {spellsRoot,repoRoot} seam, defaults unchanged), spellFieldInventory.test.ts (NEW: fixture-backed buildSpellFieldInventory + strict/loose querySpellFieldInventory + free-text + level filter), scripts/__tests__/check-non-ascii.test.ts (NEW describes: summarizeIssuesByCharacter aggregation+strict-first sort, groupCharacterSummaryByAction 3 buckets, buildCharsetReviewReport strict/soft counts+sections+notes, empty-state); self-reviewed, no tsc/vitest run per packet, matches existing temp-file test style | Add a deterministic fixture test for `buildSpellFieldInventory()` + `querySpellFieldInventory()` with fixed assertions | Add a deterministic fixture test for `buildSpellFieldInventory()` + `querySpellFieldInventory()` with fixed assertions |  |
| ST-GAP-002 | resolved | medium | test_coverage | Worker C | confirmed | project |  | none | none | historical | scripts/__tests__/raceReconciliationInventory.test.ts | helper coverage | `raceReconciliationInventory.ts` CLI/report output still lacks fixture-backed contract coverage | `scripts/__tests__/raceReconciliationInventory.test.ts`, `scripts/raceReconciliationInventory.ts`, `docs/reports/race-reconciliation/reconciliation-summary.md`; board-reconciled 2026: task "W2-P3: Contract tests for race-reconciliation CLI report + spell-template contract validator" — scripts/validateSpellTemplateContracts.ts (export TemplateField/TemplateContract/ValidationIssue/validateTemplateParity; fileURLToPath import; main() guarded behind invoked-as-script check, mirrors raceReconciliationInventory.ts pattern proven in vitest); scripts/__tests__/raceReconciliationInventory.test.ts (+payload-shape contract on CrosswalkRecord+candidate, +status handling: ambiguous/reflavored/custom/unmatched via summarizeVendorRace-built vendors); scripts/__tests__/spellTemplateValueParity.test.ts (+divergence regression driven through validateTemplateParity asserting template-accepted-values-diverge error, +runtime_subset_ok suppression). raceReconciliationInventory.ts and spellTemplateValueParity.ts needed NO edits (already export helpers + guard). Self-reviewed branch logic by hand; did not run tsc/vitest per contract. | Add a small workflow test for payload shape and crosswalk status handling | Add a small workflow test for payload shape and crosswalk status handling |  |
| ST-GAP-003 | resolved | medium | test_coverage | Worker C | confirmed | project |  | none | none | historical | scripts/__tests__/check-non-ascii.test.ts | helper coverage | `check-non-ascii.ts` lacks coverage for report generation and severity rollups on a full scan | `scripts/__tests__/check-non-ascii.test.ts`, `scripts/check-non-ascii.ts`, `package.json` (`validate:charset`); board-reconciled 2026: task "W2-P2: Fixture tests for spell-field inventory API + non-ascii checker report rollups" — spellFieldInventory.ts (added optional {spellsRoot,repoRoot} seam, defaults unchanged), spellFieldInventory.test.ts (NEW: fixture-backed buildSpellFieldInventory + strict/loose querySpellFieldInventory + free-text + level filter), scripts/__tests__/check-non-ascii.test.ts (NEW describes: summarizeIssuesByCharacter aggregation+strict-first sort, groupCharacterSummaryByAction 3 buckets, buildCharsetReviewReport strict/soft counts+sections+notes, empty-state); self-reviewed, no tsc/vitest run per packet, matches existing temp-file test style | Assert report file output and strict/soft summary buckets after `main()` | Assert report file output and strict/soft summary buckets after `main()` |  |
| ST-GAP-004 | resolved | medium | test_coverage | Worker C | confirmed | project |  | none | none | historical | validateSpellTemplateContracts.ts | helper coverage | Full spell contract migration guardrails still lack a regression test through `validateSpellTemplateContracts.ts` | `scripts/__tests__/spellTemplateValueParity.test.ts`, `validateSpellTemplateContracts.ts`, `scripts/spellTemplateValueParity.ts`; board-reconciled 2026: task "W2-P3: Contract tests for race-reconciliation CLI report + spell-template contract validator" — scripts/validateSpellTemplateContracts.ts (export TemplateField/TemplateContract/ValidationIssue/validateTemplateParity; fileURLToPath import; main() guarded behind invoked-as-script check, mirrors raceReconciliationInventory.ts pattern proven in vitest); scripts/__tests__/raceReconciliationInventory.test.ts (+payload-shape contract on CrosswalkRecord+candidate, +status handling: ambiguous/reflavored/custom/unmatched via summarizeVendorRace-built vendors); scripts/__tests__/spellTemplateValueParity.test.ts (+divergence regression driven through validateTemplateParity asserting template-accepted-values-diverge error, +runtime_subset_ok suppression). raceReconciliationInventory.ts and spellTemplateValueParity.ts needed NO edits (already export helpers + guard). Self-reviewed branch logic by hand; did not run tsc/vitest per contract. | Add a representative mismatched-contract regression case | Add a representative mismatched-contract regression case |  |

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

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Merged-reference ownership | Four rows remain as a support surface after merge into Scripts: Quality | The file is intentionally a preserved ownership record, not an active canonical registry | Add an explicit `merged_reference_owner` field for support-surface registries |
