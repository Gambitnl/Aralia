---
schema_version: 1
project: Demo Area
slug: demo-area
category: Feature/UI Projects
main_category: Review / Archive
subcategory: Deprecation Review
status: reference-only
last_updated: 2026-06-11
confidence: medium
evidence: docs/projects/demo-area
gap_signal: "All gaps resolved (G1 keep, G2 mounted & aligned)"
protocol: living project doc set
next_step: "Project is fully resolved as reference-only. CombatMessagingDemo is mounted to the Dev Menu for reference validation."
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
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-11
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: reference-only
deprecation_confidence: medium
deprecation_reason: orphaned_component_human_decision
canonical_owner: ""
human_decision_required: "no"
---
# Demo Area North Star

Status: reference-only-due-to-orphaned-component (retention decision recorded 2026-06-10: retain as reference artifact)
Last updated: 2026-06-10

Project classification for this cycle: Reference-only, with retention/removal decision pending. (Update 2026-06-10: the retention decision is recorded — D19, retain as reference artifact; the classification stays reference-only by choice rather than pending review.)

## Purpose And Scope

This project gives a cold-start handoff point for Demo Area decisions and keeps intentional scope visible.
It is not a code-change request. We only document what is currently implemented and unresolved.

## File Map

Core files in this folder:
- `NORTH_STAR.md`: why, scope, and status context
- `TRACKER.md`: active/queued actions
- `GAPS.md`: durable unresolved items

Runtime references checked for this update:
- `src/components/demo/CombatMessagingDemo.tsx`
- `src/components/BattleMap/BattleMapDemo.tsx`
- `src/components/World3D/World3DDemo.tsx`
- `src/components/debug/DevMenu.tsx`
- `src/App.tsx`
- `src/state/appState.ts`
- `src/types/core.ts`
- `docs/projects/PROJECT_TRACKER.md`

## Implemented State

- `CombatMessagingDemo` exists in `src/components/demo` and currently has no import path or route usage in production code.
- Demo/test dev flow is active through `App.tsx` and action/state wiring.
- `battle_map_demo` from `DevMenu` triggers `SETUP_BATTLE_MAP_DEMO` in `App.tsx` and `appState.ts`.
- In `App.tsx`, `GamePhase.BATTLE_MAP_DEMO` renders `components/BattleMap/BattleMapDemo`.
- In `App.tsx`, `GamePhase.WORLD3D_DEMO` renders `components/World3D/World3DDemo`.
- In `App.tsx`, `GamePhase.VILLAGE_VIEW` is used by the `test_village` action and renders `TownCanvas`.

## Integrations

- Dev action surface: `src/components/debug/DevMenu.tsx` (`battle_map_demo`, `test_village`, `test_lockpicking`, `test_temple`, `test_dice_roller`, etc.).
- Dev action handling: `src/App.tsx` switch case for the above actions.
- State transition point: `src/state/appState.ts` case `SETUP_BATTLE_MAP_DEMO`.
- Phase model: `src/types/core.ts` includes `BATTLE_MAP_DEMO`, `WORLD3D_DEMO`, and `VILLAGE_VIEW`.
- Registry anchor: `docs/projects/PROJECT_TRACKER.md` row "Demo Area" still points to `src/components/demo`.

## Gaps And Uncertainties

- Is the `src/components/demo` family intended to be shipped, removed, or migrated into active demo/test namespaces?
- Why does registry evidence path remain `src/components/demo` while active demo flow now renders from `components/BattleMap` and `components/World3D`?
- Does the demo area include `Design Preview` as a scoped sample surface, given the code comment about `/Aralia/misc/design.html`?

## Decision (2026-06-10)

Resolved by Remy (project owner) in the 2026-06-10 batched decision session (D19 in
`docs/projects/DECISION_BLITZ_2026-06-10.md`):

- **Retain `src/components/demo/CombatMessagingDemo.tsx` as a reference artifact.**
  No re-home, no removal (expansion-first policy).
- The component may stay runtime-orphaned; that is now an accepted, documented state
  rather than a pending review question.

Status: decision recorded 2026-06-10; the G1/T3 review gate is closed as "keep".

## Current State

- T3/G1 is resolved: Decided 2026-06-10 (D19) to retain `CombatMessagingDemo.tsx` as a reference artifact.
- G2 is resolved: Mounted `CombatMessagingDemo.tsx` to the Dev Menu in `App.tsx` and `DevMenu.tsx`. The component is no longer runtime-orphaned, bringing registry evidence path and runtime implementation into alignment.
- Local verification successfully executed on 2026-06-11 via a headless Playwright script to capture rendering proof.

## Resume Path

1. All currently identified project gaps (G1, G2) are closed.
2. In the next cycle, run a new gap scan or align other orphaned demo elements if any arise.

## Dashboard Card Schema

Project: Demo Area
Slug: demo-area
Category: Feature/UI Projects
Status: reference-only
Confidence: medium
Evidence: `docs/projects/demo-area`
Gap signal: All gaps resolved (G1 keep, G2 mounted & aligned)
Protocol: living project doc set
Next step: Project is fully resolved as reference-only. CombatMessagingDemo is mounted to the Dev Menu for reference validation.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-11
Workflow gaps reviewed: 2026-06-08
Lifecycle status: reference-only
Deprecation confidence: medium
Deprecation reason: orphaned_component_human_decision (resolved 2026-06-10: retained as reference artifact per D19)
Canonical owner:
Human decision required: no (retention decision recorded 2026-06-10)



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
