---
schema_version: 1
gap_schema: project_gap_registry
project: Party UI
slug: party-ui
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-22"
gap_count: 8
open_gap_count: 2
resolved_gap_count: 6
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/party-ui/NORTH_STAR.md
tracker: docs/projects/party-ui/TRACKER.md
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
# Party UI Gap Registry

Status: active
Last updated: 2026-06-19

Use this for durable unresolved findings that remain in Party UI scope.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G4 | resolved | adjacent_follow_up | Gemini | Party UI overlay/card UX | NORTH_STAR gap carried forward | Decide which missing-choice warnings should appear in the overlay path versus compact cards if richer card variants are introduced later | `docs/projects/party-ui/NORTH_STAR.md` (Gaps carried forward), `docs/projects/party-ui/TRACKER.md` (T2) | Warning placement needs a single source of truth before new card variants expand | Resolved 2026-06-22: added warning placement rules to `NORTH_STAR.md` and recorded decision in `DECISIONS.md`. | Verified via docs consistency check. |
| G5 | resolved | in_scope_now | Worker B | Party roster acceptance rule | NORTH_STAR next checks | Decide whether party roster membership can include non-companion NPC party entities and document the acceptance rule | `docs/projects/DECISION_BLITZ_2026-06-10.md` D15; `docs/projects/party-ui/DECISIONS.md` D2; `docs/projects/party-ui/NORTH_STAR.md` roster acceptance rule | Roster composition affects membership model, sheet context, and save/load semantics | Resolved 2026-06-19: roster may include non-companion NPCs when they are valid `PlayerCharacter` party members; companion context is optional by id match; save/load keeps `gameState.party` and `gameState.companions` separate | G7 may proceed by threading optional companion data into `PartyOverlay` without filtering non-companion roster entries |
| G6 | resolved | adjacent_follow_up | Gemini | `docs/projects/code-modularization-audit` CMA-G10 | Code modularization audit routing | Central state/save/load modularization may touch party/rest defaults and character reducer assumptions. | `src/state/appState.ts`; `src/state/reducers/characterReducer.ts`; `src/state/reducers/__tests__/worldReducer.test.ts`; `src/state/__tests__/worldViewModeLegacy3d.test.ts` | Party UI depends on stable load defaults such as `shortRestTracker`; broad state splits can regress continuity. | Resolved 2026-06-22: completed audit of state/save/load boundaries for pipeline, backfill, normalization, and day-sync. Recorded findings in `DECISIONS.md` D4. | Verified via vitest runs remaining green. |
| G7 | resolved | adjacent_follow_up | Gemini | Party UI overlay/companion data threading | T2 companion-party boundary analysis (2026-06-08) | `PartyOverlay` accepts `party: PlayerCharacter[]` but does not thread `companions` data; `RelationshipsPane` is standalone and not mounted in the overlay; companion approval/relationship/banter context is invisible from the party roster | `src/components/Party/PartyOverlay.tsx` (props interface); `src/components/Party/RelationshipsPane.tsx`; `src/components/layout/GameModals.tsx` (PartyOverlay mount); `docs/projects/party-ui/NORTH_STAR.md` G5 contract | Party roster cannot show companion relationship status, approval, or banter context; the two surfaces are visually and architecturally disconnected | Resolved 2026-06-22: companion relationship level and approval are threaded from GameModals through PartyOverlay and PartyPane to PartyMemberCard | Verified via layout tests (GameModals.test.tsx) and unit tests in PartyPane.test.tsx |
| G9 | resolved | support_needed_now | Gemini | Party UI test coverage | Iteration 5 gap sweep (2026-06-08) | `PartyMemberCard` (the active card component rendered by `PartyPane`) has no test file; `PartyCharacterButton` (legacy, not used by `PartyPane`) has tests. Card stat rendering, HP bar, spell slots, missing-choice warning, and expendable abilities are untested in the active component. | `src/components/Party/PartyPane/PartyMemberCard.tsx` (no test); `src/components/Party/PartyPane/__tests__/PartyCharacterButton.test.tsx` (legacy test exists) | Active card component lacks regression protection; legacy test provides false coverage confidence | Resolved 2026-06-22: added `PartyMemberCard.test.tsx` covering stat row, HP bar, spell slots, missing-choice warning, and more-button callback | Verified via `npx vitest run src/components/Party/PartyPane/__tests__/PartyMemberCard.test.tsx` (9/9 tests pass) |
| G10 | resolved | adjacent_follow_up | Gemini | Party UI rest flow parity | Iteration 5 gap sweep (2026-06-08) | Long Rest button opens `LongRestModal` (`TOGGLE_LONG_REST_MODAL`) allowing racial rest choices before confirming. Short Rest button dispatches `SHORT_REST` directly with no modal, bypassing any choice flow. If D&D 2024 short rest should support Hit Dice spending choices or racial rest options, the UX is inconsistent. | `src/components/layout/GameModals.tsx` (line 372: `onShortRest` dispatches directly; line 385: Long Rest opens `LongRestModal`); `src/components/Party/PartyOverlay.tsx` (footer buttons) | Rest UX inconsistency: long rest has a choice modal, short rest fires immediately | Resolved 2026-06-22: wired `RestModal` under `isShortRestModalVisible` toggle in `GameModals.tsx` to spend Hit Dice per character on Short Rest. | Verified with layout tests (GameModals.test.tsx) and RestModal unit tests (RestModal.test.tsx). |
| G11 | not_started | adjacent_follow_up | Gemini | Party UI rest rules | Iteration 9 gap sweep (2026-06-22) | Rest buttons on Party Overlay do not check for active combat (gameState.currentEnemies), allowing players to take short or long rests mid-combat. | `src/components/Party/PartyOverlay.tsx` (L170-199), `src/hooks/actions/handleResourceActions.ts` (L59-213) | Violates D&D rest rules and allows bypassing combat challenge/resource exhaustion. | Disable rest buttons on PartyOverlay and show an warning tooltip/label if combat is active. | Rest buttons are disabled and display a combat warning in the tooltip when combat is active. |
| G12 | not_started | adjacent_follow_up | Gemini | Party UI warning cards | Iteration 9 gap sweep (2026-06-22) | PartyMemberCard only renders a warning and triggers the fix-flow callback for the first missing choice (missingChoices[0]). If a character has multiple missing choices, they cannot see or resolve secondary ones from the card. | `src/components/Party/PartyPane/PartyMemberCard.tsx` (L284-285, L325-339) | Limits usability and clarity when characters have multiple outstanding leveling or trait choices. | Support listing/rendering multiple warnings, or update the tooltip and fix-flow trigger to let players select which missing choice to resolve. | PartyMemberCard displays indicators for all missing choices and allows triggering the fix flow for any selected choice. |

## Classification

- `in_scope_now`: blocks current implementation tasks.
- `support_needed_now`: must be verified to prevent regressions.
- `adjacent_follow_up`: meaningful but not required for this project slice.
- `blocked_human_decision`: owner choice required to close.
- `blocked_external_state`: dependent on external subsystem or API evolution.
- `out_of_scope`: keep in other project trackers.

## Update Rules

- Keep active gaps in this file if they affect party UI behavior, correctness, or handoff.
- Move global or unrelated gaps to `docs/projects/GLOBAL_GAPS.md` before closing this project.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |
