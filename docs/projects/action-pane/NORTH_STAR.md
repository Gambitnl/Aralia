---
schema_version: 1
project: Action Pane
slug: action-pane
category: Feature/UI Projects
main_category: Interface & Experience
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-08
confidence: medium
evidence: docs/projects/action-pane
gap_signal: "2 active gaps, 1 adjacent follow-up"
protocol: living project doc set
next_step: Continue with T3 prop-contract cleanup.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - docs_consistency
  - scoped_tests
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: no
---

# Action Pane North Star

Status: active
Last updated: 2026-06-08

## Why This Project Exists

The Action Pane exists as the primary player command surface in the PLAYING layout. This project preserves current behavior and action contracts so cold starts do not lose the established UI-to-state wiring.

## Intended Outcome

Capture a concrete, implementation-grounded snapshot of:
- what commands the pane currently emits,
- where those commands are routed and handled,
- and what is still uncertain or stale around action contracts.

## Current State

- Action Pane remains the primary player command surface in the PLAYING layout.
- The action dispatch entrypoint is still processAction in src/hooks/useGameActions.ts.
- handleAction routing stays centralized in src/hooks/actions/actionHandlers.ts with system UI handling in src/hooks/actions/handleSystemAndUi.ts.
- The action surface still includes dynamic context actions from useActionGeneration, manual commands such as ask_oracle, ANALYZE_SITUATION, SHORT_REST, and LONG_REST, Gemini action rendering, and SystemMenu toggles.
- Current contract drift is still tracked in TRACKER.md and GAPS.md, especially isDevDummyActive intent and move.targetId normalization.
- System-menu and quick-command emission now has focused contract proof in src/components/ActionPane/__tests__/ActionPane.test.tsx, so the menu coverage gap is no longer the next blocker.

## Dashboard Card Schema

Project: Action Pane
Slug: action-pane
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/action-pane
Gap signal: 2 active gaps, 1 adjacent follow-up
Protocol: living project doc set
Next step: Continue with T3 prop-contract cleanup.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency, scoped_tests
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

## Active Task

| Field | Value |
|---|---|
| Task | Document concrete Action Pane state, file map, and unresolved contract points |
| Acceptance criteria | This living-doc set contains implemented-state mapping, action contracts, integration points, and clear next checks |
| Allowed boundaries | docs/projects/action-pane/ only |
| Stop condition | Do not widen into unrelated gameplay systems |
| Verification | Verify this folder plus tracker/gaps fields are filled with current, cross-referenced implementation evidence |
| Owner | Action Pane doc owner |
| Next action | Move to prop-contract cleanup in the next implementation slice |

## Scope Boundaries

In scope:
- docs/projects/action-pane/NORTH_STAR.md
- docs/projects/action-pane/TRACKER.md
- docs/projects/action-pane/GAPS.md
- src/components/ActionPane
- src/components/layout/GameLayout.tsx
- src/components/layout/GameModals.tsx
- src/hooks/useGameActions.ts
- src/hooks/actions/actionHandlers.ts
- src/hooks/actions/handleSystemAndUi.ts
- src/types/actions.ts
- src/state/actionTypes.ts
- src/components/ActionPane/__tests__/ActionPane.test.tsx

Adjacent but not in this slice:
- Full action semantics in domain systems launched from non-pane paths (combat, dialogue, trade, encounters).
- UX polish, styling, and accessibility hardening.

Out of scope:
- Refactors outside action dispatch, action-button behavior, and pane/system integration mapping.
- Changing reducer shape or unrelated action type definitions not caused by Action Pane contract needs.

## What Must Not Be Lost

- Existing pane behaviors tied to movement and interaction:
  - talk, take_item, move (with normalization),
  - ENTER_VILLAGE, APPROACH_TOWN, OBSERVE_TOWN,
  - ANALYZE_SITUATION, ask_oracle, SHORT_REST, LONG_REST.
- System action coverage:
  - toggle_* actions,
  - save_game,
  - go_to_main_menu,
  - set auto-save toggle,
  - open/close game-guide and logs/book/modals.
- Current loading behavior: useGameActions checks ACTION_METADATA and suppresses loading for UI toggle actions.
- Existing test intent for ActionPane interactions, including menu close behavior and oracle submit path.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Move ActionPane prop contracts to stable, non-legacy form | in_scope_now | Action Pane owner | src/components/ActionPane/index.tsx | Replace stale isDevDummyActive usages or update docs/tests for expected behavior |
| Normalize action payload expectations across generators and handlers | support_needed_now | Action Pane owner | src/components/ActionPane/useActionGeneration.ts, src/types/actions.ts | Add contract test that no numeric targetId needs runtime normalization |

## Global Gap Imports

Check the global gap tracker before expanding scope:
[docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md)

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | No cross-project gaps required at this documentation pass |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Pane implementation | The concrete action surface and state wiring | F:\Repos\Aralia\src\components\ActionPane\index.tsx |
| Action generation rules | Non-compass exit/item/npc context rules and town/village hints | F:\Repos\Aralia\src\components\ActionPane\useActionGeneration.ts |
| Dispatch orchestration | Action routing and loading/error lifecycle | F:\Repos\Aralia\src\hooks\useGameActions.ts |
| Handler mapping | Runtime action contract and state updates | F:\Repos\Aralia\src\hooks\actions\actionHandlers.ts, F:\Repos\Aralia\src\hooks\actions\handleSystemAndUi.ts |
| Shell wiring | Where pane actions enter gameplay | F:\Repos\Aralia\src\App.tsx, F:\Repos\Aralia\src\components\layout\GameLayout.tsx |
| Type contracts | Canonical action names and metadata | F:\Repos\Aralia\src\types\actions.ts, F:\Repos\Aralia\src\state\actionTypes.ts |
| Tests | Oracle, analyze, short rest, long rest, move normalization, menu actions, disabled state | F:\Repos\Aralia\src\components\ActionPane\__tests__\ActionPane.test.tsx |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) | Registry anchor | active |
| [docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md) | Cross-project routing | active |
| [docs/projects/action-pane/TRACKER.md](docs/projects/action-pane/TRACKER.md) | Task and gap status | active |
| [docs/projects/action-pane/GAPS.md](docs/projects/action-pane/GAPS.md) | Persistent unresolved findings | active |

## Artifact Boundary

Keep this project scope to:
- these living docs,
- and the linked evidence files above.

Avoid adding ad hoc runtime logs, screenshots, or process notes that do not affect action contracts.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Does isDevDummyActive still belong on ActionPane props? | The prop is passed but currently unused in main action flow | Action Pane owner | Next UI contract pass |
| Should APPROACH_TOWN and OBSERVE_TOWN live in this pane or be moved to village scene controls? | Prevents duplicated behavior and conflicting affordances across views | Action Pane owner | Next phase planning |
| Is ActionButton normalization for move.targetId still needed if generators are tightened? | Keeps the contract clean and avoids silent runtime coercion | Action Pane owner | Next handler/validation pass |

## Resume Path For A Cold Agent

1. Read this file.
2. Read [docs/projects/action-pane/TRACKER.md](docs/projects/action-pane/TRACKER.md) and [docs/projects/action-pane/GAPS.md](docs/projects/action-pane/GAPS.md).
3. Confirm no imported gaps are needed in [docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md) and recheck [docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md](docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md).
4. Continue with T3 first, then T4 only if the prop-contract pass exposes a real blocker.
