---
schema_version: 1
gap_schema: project_gap_registry
project: Dialogue
slug: dialogue
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-18"
gap_count: 6
open_gap_count: 6
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/dialogue/NORTH_STAR.md
tracker: docs/projects/dialogue/TRACKER.md
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
project: Dialogue
slug: dialogue
last_updated: \"2026-06-10\"
gap_count: 6
open_gap_count: 6
north_star: docs/projects/dialogue/NORTH_STAR.md
tracker: docs/projects/dialogue/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
highest_severity: medium
registry_mode: mixed
---
# Dialogue Gap Registry

Status: active  
Last updated: 2026-06-18

Use this file for durable unresolved findings that belong to the Dialogue feature.

## Current Readout

- DIAL-001 remains an adjacent follow-up for future scripted dialogue work.
- DIAL-002 through DIAL-005 are the active Dialogue follow-ups for this resume path.
- DIAL-006 was routed from the code-modularization audit (companion banter ownership boundary).
- The current D2 docs-alignment sweep preserved the six evidence-backed gaps and added no new project-local gap rows.
- No cross-project gaps were imported during this pass.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| DIAL-001 | not_started | adjacent_follow_up | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Node-level scripted/dialogue graph format is not implemented; current system is topic-first | `src/components/Dialogue/DialogueInterface.tsx`, `src/services/dialogueService.ts`, `docs/projects/PROJECT_TRACKER.md` | Future expansion may require a durable script/runtime schema | Define schema direction in feature plan before adding new conversation content | Add acceptance tests for script import or conversion if adopted |
| DIAL-002 | active | support_needed_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Cross-NPC topic propagation is partial and marked TODO | `src/hooks/useDialogueSystem.ts` (TODO_DIALOGist), `src/state/reducers/npcReducer.ts` | Unlocks/tone may stop at session-level and fail global progression intent | Decide whether unlocks should become `DiscoveryLog`/global facts and implement reducer side effects | Add regression test that validates unlocks persist beyond one session |
| DIAL-003 | active | in_scope_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | Runtime scan | Session-derived fields (`sessionDispositionMod`, `availableTopicIds`) are not fully used in UI/service | `src/types/dialogue.ts`, `src/components/Dialogue/DialogueInterface.tsx`, `src/services/dialogueService.ts` | Potential divergence between session intent and runtime behavior | Either apply these fields or remove/refine them in this system | Test or remove field expectations and update docs |
| DIAL-004 | active | support_needed_now | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | North Star review | Dialogue outcomes describe session-local unlock logging but do not define a durable global unlock-fact model | `docs/projects/dialogue/NORTH_STAR.md` (session-side effects and sparse durable unlock behavior) | Future dialogue content may expect unlocks to persist and silently lose progress instead | Decide whether unlocks should write a shared fact record and document the rule before expanding content | Add a regression or doc proof that the chosen unlock persistence model is explicit |
| DIAL-005 | not_started | adjacent_follow_up | aralia-dialogue | `docs/projects/dialogue/TRACKER.md` | North Star review | Dialogue and companion chat are separate flows, but the boundary and ownership rule are not formalized in the handoff | `docs/projects/dialogue/NORTH_STAR.md` (separate `ConversationPanel` / `useConversation.ts` flow), `docs/projects/dialogue/COLD_START_AGENT_PROMPT.md` | Future work can patch the wrong system or assume shared state between flows | Add a short boundary note or decision entry clarifying the separation and ownership | Next cold-start handoff should point to the correct flow without ambiguity |
| DIAL-006 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G12 | Code modularization audit routing | Companion banter orchestration is a large cross-flow hook that touches dialogue expectations but is not owned solely by Dialogue. | `src/hooks/useCompanionBanter.ts`; `docs/projects/companions/GAPS.md` G8 | Dialogue expansion can accidentally inherit companion-banter scheduling if ownership is unclear. | Add dialogue boundary notes before any banter extraction. | Handoff clearly says which flow owns companion banter vs scripted dialogue |

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `routed_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Required for this feature slice to function predictably |
| `support_needed_now` | Needed to complete planned feature behavior in current project scope |
| `adjacent_follow_up` | Related design decision with future expansion impact |
| `out_of_scope` | Not part of Dialogue ownership |
| `blocked_human_decision` | Needs product/owner approval |
| `blocked_external_state` | Waiting on external service, tool, or runtime dependency |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
