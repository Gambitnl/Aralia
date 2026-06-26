---
schema_version: 1
gap_schema: project_gap_registry
project: Layout Project
slug: layout
status: "active (G3/G4 decided 2026-06-10; implementation lane open)"
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/layout/NORTH_STAR.md
tracker: docs/projects/layout/TRACKER.md
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
project: Layout Project
slug: layout
last_updated: \"2026-06-25\"
gap_count: 5
open_gap_count: 5
north_star: docs/projects/layout/NORTH_STAR.md
tracker: docs/projects/layout/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
highest_severity: medium
registry_mode: mixed
---
# Layout Project Gap Registry

Status: active (G3/G4 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-25

Use this file for durable unresolved findings tied directly to Layout.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G4 | active | blocked_human_decision | human/product owner + layout/providers owners | `docs/projects/code-modularization-audit` CMA-G4 | Code modularization audit routing | `App.tsx` is a high-risk app-shell modularization candidate tied to layout, providers, phase routing, and modal orchestration. | `src/App.tsx`; `src/components/layout/GameModals.tsx`; `src/components/providers/AppProviders.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G4 | App-shell splits can change phase rendering, modal order, provider nesting, and interaction locks. | Decided 2026-06-10 (Remy, D7): app-shell split approved â€” move provider composition into a dedicated app-shell module with preservation tests (provider order, `DataLoaderGate`, `GameProvider` boundaries). Implementation lane open; see `docs/projects/DECISION_BLITZ_2026-06-10.md`. | Split lands with focused preservation tests proving provider order, `DataLoaderGate`, and `GameProvider` boundaries are unchanged. |
| CMA-G17 | not_started | adjacent_follow_up | layout owner | `docs/projects/code-modularization-audit/GAPS.md` CMA-G17 | Code modularization audit routing | `GameModals.tsx` (~721 lines) is the central modal orchestration file; it crosses many owners and lazy-load boundaries, making regressions easy to hide. | `src/components/layout/GameModals.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G17 | A split of the modal manager without open/close smoke proof and interaction-lock clarity can break overlays across many surfaces. Blocked on G3 (`isUIInteractive` decision) and G4 (App-shell split contract) â€” both decided 2026-06-10 (D7), so the precondition is cleared. | Accept or defer the inbound CMA-G17 route; G3/G4 are resolved (2026-06-10, D7), so if accepting, create a narrow modal-manager split plan with open/close coverage. | Owner gap row exists and CMA-G17 status is updated to reflect acceptance or deferral. |
| G5 | not_started | support_needed_now | Codex | Modal focus and keyboard navigation | `docs/BACKLOG.md` migration 2026-06-25 | Centralized modal focus management and keyboard navigation need a layout-owned contract. | `docs/BACKLOG.md`; `src/components/layout/GameModals.tsx` | Modal behavior spans many surfaces; without a shared focus/keyboard policy, fixes fragment across individual dialogs. | Define focus trap, escape, restore-focus, and tab-order expectations before refactoring modal orchestration. | Focused tests proving at least one modal opens, traps focus, closes with Escape, and restores focus. |
| G6 | not_started | adjacent_follow_up | Codex | Shared UI action registry | `docs/BACKLOG.md` migration 2026-06-25 | The UI toggle list in `useGameActions` should derive from a shared action registry to reduce drift. | `docs/BACKLOG.md`; `src/hooks/useGameActions.ts`; `src/types/ui.ts` | Toggle drift can leave loading states or UI actions classified inconsistently across the app shell. | Move toggle classification to the shared action metadata path, preserving current exceptions. | Unit tests proving known UI toggles do not trigger global loading while gameplay actions still do. |
| G7 | not_started | ui | Codex | User-facing settings surface | `docs/improvements/SETTINGS_MENU_PLAN.md` retirement 2026-06-25 | Aralia still lacks a confirmed first-class settings menu or settings modal for player preferences such as reduced motion, animation control, autosave behavior, or local/cloud model preference. | Retired `docs/improvements/SETTINGS_MENU_PLAN.md`; `src/components/layout/MainMenu.tsx`; `src/App.tsx`; `src/components/layout/GameModals.tsx`; `src/state/appState.ts`; `src/components/ui/NotificationSystem.tsx` reduced-motion consumer | Player preferences are already present in scattered state and UI behavior, but without a central settings surface users cannot discover or manage them consistently. | Define the first settings vertical slice: where preferences live, where the player opens settings, and one behavior that visibly changes from the setting. Start with reduced motion or another existing preference before adding a broad options suite. | Focused UI/state tests plus rendered proof that the Settings entry opens, the first preference persists, and one existing UI behavior changes according to that preference. |

## Classification Reference

- `in_scope_now`: Required to avoid broken behavior or ambiguous handoff.
- `support_needed_now`: Not required today but must be resolved before broader rollout.
- `adjacent_follow_up`: Useful next-slice item that should be preserved but does not block this docs pass.
- `out_of_scope`: Outside Layout boundaries.
- `blocked_human_decision`: Needs owner choice.
- `blocked_external_state`: Waiting on another team or environment.

## Update Rules

- Keep every entry in evidence-backed form with a concrete next proof/check.
- Move cross-project items to `docs/projects/GLOBAL_GAPS.md` when they are not Layout-owned.
