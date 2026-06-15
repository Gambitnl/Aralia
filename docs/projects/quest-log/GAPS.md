---
schema_version: 1
gap_schema: project_gap_registry
project: Quest Log
slug: quest-log
status: "active (G3 decided 2026-06-10; implementation lane open)"
status_note: ""
registry_mode: canonical
last_updated: "2026-06-10"
gap_count: 3
open_gap_count: 1
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/quest-log/NORTH_STAR.md
tracker: docs/projects/quest-log/TRACKER.md
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
# Quest Log Gap Registry

Status: active (G3 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable gaps the current docs-to-source scan could not close.

Current iteration focus:
- G3 remains the current in-scope behavior check before code edits resume.
- Update 2026-06-10: G3 is decided (D14, Option A) â€” wire the quest-giver bridge in `handleNpcInteraction.ts` with focused tests and a minimal quest-offer payload defined as part of the work.
- G2 and G5 remain adjacent follow-up work owned by the broader quests system.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G2 | adjacent_follow_up | adjacent_follow_up | Worker | `docs/projects/quests/TRACKER.md` | doc update pass | Replace hardcoded item/location quest triggers with data-driven quest hooks | `src/hooks/actions/handleItemInteraction.ts`, `src/hooks/actions/handleMovement.ts` | Hardcoded mappings are brittle and block content expansion | Route this to `docs/projects/quests` as the owning engine-domain gap | `docs/projects/quests/GAPS.md` records migration acceptance criteria |
| G3 | active | blocked_human_decision | human/product owner | `docs/projects/quest-log/TRACKER.md` | source scan / doc update pass | Decide whether `handleNpcInteraction.ts` should own the quest-giver bridge or stay dialogue-only until a broader dialogue/quest contract is named | `src/hooks/actions/handleNpcInteraction.ts`, `src/services/dialogueService.ts`, `src/data/dialogue/topics.ts`, `src/hooks/useDialogueSystem.ts`; `docs/projects/DECISION_BLITZ_2026-06-10.md` D14 | Current quest starts are still mostly item/location-driven, and the dialogue layer has no quest-offer payload or topic contract to wire safely from this handler alone | Decided 2026-06-10 (Remy, D14, Option A): wire the quest-giver bridge now in `handleNpcInteraction.ts`; define a minimal quest-offer payload as part of the work and cover the handoff with focused tests | Focused source-backed test for the wired handoff path plus `node scripts\audit-living-project-docs.cjs --project quest-log` |
| G5 | adjacent_follow_up | adjacent_follow_up | Worker | `src/types/quests.ts` / `docs/projects/quests/NORTH_STAR.md` | doc update pass | Resolve schema mismatch between legacy `Quest` and richer staged `QuestDefinition` in runtime flow | `src/types/quests.ts`, `src/state/reducers/questReducer.ts` | Migration risk for reward/objective behavior and serializer compatibility | Keep migration plan in `docs/projects/quests` and treat this project as owning local impact only | Add project routing comment in `NORTH_STAR.md` |

## Classification Reference

- `in_scope_now`: must be handled before this slice can be considered complete.
- `support_needed_now`: needed for a stable handoff or next implementation slice.
- `adjacent_follow_up`: related future work that should not block this slice.
- `out_of_scope`: explicitly outside this project.
- `blocked_human_decision`: waiting for product/behavioral decision.
- `blocked_external_state`: blocked by another actor/system.

## Update Rules

- Keep entries tied to concrete files and a next check.
- Route non-local gaps to owning projects with a clear destination instead of expanding this log indefinitely.
