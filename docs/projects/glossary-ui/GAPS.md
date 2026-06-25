---
schema_version: 1
gap_schema: project_gap_registry
project: Glossary UI
slug: glossary-ui
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-26"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/glossary-ui/NORTH_STAR.md
tracker: docs/projects/glossary-ui/TRACKER.md
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
project: Glossary UI
slug: glossary-ui
last_updated: \"2026-06-26\"
gap_count: 5
open_gap_count: 5
north_star: docs/projects/glossary-ui/NORTH_STAR.md
tracker: docs/projects/glossary-ui/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
highest_severity: medium
registry_mode: canonical
---
# Glossary UI Gap Registry

Status: active
Last updated: 2026-06-26

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G2 | not_started | adjacent_follow_up | Worker | `docs/projects/item_categorization` | docs/tasks scan | Equipment taxonomy uses source `itemType` labels directly, while category wording and normalization are still implementation-derived. | `scripts/generateGlossaryIndex.js`, `scripts/ingestPhbGlossary.ts`, `docs/projects/item_categorization/GAPS.md` | UX and search consistency can drift if taxonomy labels change in ingestion without glossary UI updates. | Sync wording rules with item-categorization owners before changing grouping behavior. | Confirm a shared canonical group naming decision and migration note. |
| G4 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G2 | Code modularization audit routing | `spellGateBucketDetails.ts` is a large domain-dense glossary/spell-gate surface and needs owner-routed split planning before any code movement. | `src/components/Glossary/spellGateChecker/spellGateBucketDetails.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G2 | Splitting this file without preserving mismatch contracts could lose audit intent and structured-vs-canonical evidence. | Define a glossary-owned split boundary for spell gate bucket details and route structured spell validation ownership before refactoring. | Focused tests still cover `SpellGateChecksPanel` and `useSpellGateChecks`; any split has a before/after proof note. |
| G5 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G11 | Code modularization audit routing | Glossary rendering and registry files are a second large-file cluster beyond the spell-gate details row. | `src/components/Glossary/spellGateChecker/SpellGateBucketSections.tsx`; `src/components/Glossary/IconRegistry.tsx`; `src/components/Glossary/SpellCardTemplate.tsx` | Registry/rendering splits need icon coverage and spell-card rendering proof, not just file-size cleanup. | Define glossary-owned visual/test proof boundaries before modularization. | Spell gate panel tests, icon registry coverage, and glossary UI smoke proof stay named in any split plan |
| G7 | not_started | adjacent_follow_up | Worker | `scripts/ingestPhbGlossary.ts` | Runtime docs scan | `itemMetadata` is still built from an `any` object in ingest, so the new source-backed contract is documented but not enforced. | `scripts/ingestPhbGlossary.ts`, `src/types/ui.ts`, `docs/projects/glossary-ui/NORTH_STAR.md` | Future metadata additions can still drift silently even when the render contract is documented. | Decide later whether to add a narrow typed builder or schema guard without widening the current task. | Confirm the contract note and a narrow sample item proof once a guard exists. |
| G8 | not_started | integration | Codex | `docs/projects/spells/subprojects/structured-spell-execution` | Spell migration roadmap backlog routing | Spell detail prose still needs live glossary term linking in the current spell-detail rendering path. | Routed from `docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md` on 2026-06-26; `SpellDetailPane.tsx`; glossary tooltip/deep-link infrastructure | Spell data and glossary index work do not help players if spell descriptions render as plain text without term links. | Locate the active spell detail component path, then wire term detection/link rendering through the existing glossary UI primitives without creating a parallel glossary lane. | Rendered spell detail proof showing linked glossary terms, tooltip/deep-link behavior, and no regression in plain spell description readability. |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `routed_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
## Classification Reference

- `in_scope_now`: required to complete a reliable handoff for current implemented behavior.
- `support_needed_now`: required dependency for safe continuation but owned partly outside this folder.
- `adjacent_follow_up`: useful for future work, but not required for this project to remain stable.
- `out_of_scope`: explicitly outside this project.
- `blocked_human_decision`: blocked by explicit owner choice.
- `blocked_external_state`: blocked by another team, build, or service dependency.

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
