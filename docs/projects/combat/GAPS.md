---
schema_version: 1
gap_schema: project_gap_registry
project: Combat
slug: combat
status: "active (G30 decision recorded 2026-06-10; implementation lane open)"
status_note: ""
registry_mode: canonical
last_updated: "2026-06-10"
gap_count: 2
open_gap_count: 2
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: mixed
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/combat/NORTH_STAR.md
tracker: docs/projects/combat/TRACKER.md
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
# Combat System Gap Registry

Status: active (G30 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G30 | active | support_needed_now | Code Modularization Audit (plan) + combat owner (invariants/tests) | `docs/projects/code-modularization-audit` CMA-G4 | Code modularization audit routing | `useAbilitySystem.ts` and `useCombatEngine.ts` are large orchestration surfaces and should not be split before command/combat ownership and App-shell boundaries are explicit. Decision recorded 2026-06-10 (DECISION_BLITZ D6): Code Modularization Audit owns the split plan; Combat contributes required invariants and tests before code movement. | `src/hooks/useAbilitySystem.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/App.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G4; `docs/projects/DECISION_BLITZ_2026-06-10.md` D6 | These hooks bridge spells, commands, combat state, and App routing; a split can change runtime semantics. | Combat lane open: write the combat invariants and focused regression tests (rules, action sequencing, reactions, combat log) and hand them to the Code Modularization Audit split plan; no code movement in a Combat pass. | Split plan names `useAbilitySystem` and `useCombatEngine` tests plus App/provider invariants before code movement. |
| CMA-G18 | not_started | adjacent_follow_up | combat owner | `docs/projects/code-modularization-audit/GAPS.md` CMA-G18 | Code modularization audit routing | `useActionExecutor.ts` (~753 lines), `CombatView.tsx` (~619 lines), `EncounterModal.tsx` (~586 lines), and `combat.ts` types (~704 lines) are co-located enough that behavior can drift if modularized without end-to-end combat proof. | `src/hooks/combat/useActionExecutor.ts`; `src/components/Combat/CombatView.tsx`; `src/components/Combat/EncounterModal.tsx`; `src/types/combat.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G18 | A split without turn-flow, log-state, and encounter-generation proof can silently break combat. Blocked on G30 (useAbilitySystem/useCombatEngine ownership decision) â€” G30 resolved 2026-06-10 (DECISION_BLITZ D6), so this route is no longer decision-blocked. | Accept or defer the inbound CMA-G18 route under the D6 model (Code Modularization Audit owns split plans; Combat contributes invariants/tests); if accepting, follow a bounded split plan with combat scenario replay or smoke proof. | Owner gap row exists and CMA-G18 status is updated to reflect acceptance or deferral. |

## Global Gap Routing Notes

- GG-13 was triaged during this pass and resolved in this registry as G23.

## Open / Uncertain Notes

- The architecture doc `docs/architecture/domains/combat.md` still carries some historical mechanical gap text. The death-save note is stale now that code/tests cover the slice; treat any remaining omissions there as candidates for fresh evidence, not as current state.
- The `docs/architecture/COMBAT_MAP_ENGINE.md` and `docs/architecture/domains/battle-map.md` split show combat execution ownership vs rendering ownership; no immediate gap is claimed here beyond ownership boundaries.

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
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
