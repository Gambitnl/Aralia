---
schema_version: 1
gap_schema: project_gap_registry
project: Spells
slug: spells
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-16"
gap_count: 1
open_gap_count: 1
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/spells/NORTH_STAR.md
tracker: docs/projects/spells/TRACKER.md
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
# Spells Gap Registry

Status: active
Last updated: 2026-06-16

Use this file for durable unresolved findings that are in-scope for this project.

## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G10 | open | high | data-model | Working agent | high | spells | none | none | none | recorded | SpellIntegrityValidator Rule 1; SpellCommandFactory concentration path | Spell Phase corpus scan 2026-06-16 | 117 spells have `duration.concentration: true` but `tags` missing `"concentration"`, and no corpus-wide regression test exists in `SpellIntegrityValidator.test.ts` to catch this. Concentration sync is a declared hard-failure rule but the systematic test only covers monolithic effects, blank descriptions, and scaffold wording. | `src/systems/spells/validation/SpellIntegrityValidator.ts` Rule 1; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` systematic section; `public/data/spells/level-*/` (117 affected files); `src/commands/factory/SpellCommandFactory.ts` line 223-229 uses `spell.duration.concentration`; UI concentration indicators rely on `tags` | Concentration is the core combat sustain mechanic. Missing tags silently desync UI indicators and audit tooling from the actual concentration state. SpellCommandFactory uses `duration.concentration` directly so combat execution still works, but glossary, spellbook, and audit surfaces that read `tags` will miss 117 concentration spells. | Add corpus-wide concentration-sync regression test (soft-warn first to track debt, hard-fail after remediation), then batch-fix the 117 affected spell JSON files. | Run node scan or new regression test; confirm 0 mismatches after fix batch. | Banishing Smite fixed as proof-of-concept on 2026-06-16. Remaining 117 spells listed in scan output. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Essential to proceed with the current slice. |
| `support_needed_now` | Not the direct slice goal, but needed for safe continuation. |
| `adjacent_follow_up` | Useful context that informs future slices. |
| `out_of_scope` | Relevant to planning but not this project. |

## Update Rules

- Keep this file aligned with `docs/projects/spells/TRACKER.md`.
- Do not move cross-project gaps here; route them through `docs/projects/GLOBAL_GAPS.md`.
- Do not close a gap without evidence in the proof/check column.
