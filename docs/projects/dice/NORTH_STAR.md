---
schema_version: 1
project: Dice
slug: dice
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: review-required
last_updated: 2026-06-08
confidence: medium
evidence: docs/projects/dice
gap_signal: "1 open gap (D-G2); 1 review-required gap (D-G3); D-G1 seeded silent-path API added"
protocol: living project doc set
next_step: Resolve Dice D-2 decisions for deterministic policy across visual rolls and roll-history retention before expanding visible history UX.
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
  - scoped_tests
completed_verification:
  - scoped_tests (combatUtils + DiceRoller seeded-path tests)
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "yes"
---
# Dice North Star

Status: review-required
Last updated: 2026-06-08

## Purpose and scope

Dice is an implemented feature set with modal controls and 3D visual rolling used by gameplay UI.
This project exists as a cold-start checkpoint: what is already shipped, where it lives, and what remains uncertain.

## Dashboard Card Schema

Project: Dice
Slug: dice
Category: Feature/UI Projects
Status: review-required
Confidence: medium
Evidence: docs/projects/dice
Gap signal: 1 open gap (D-G2); 1 review-required gap (D-G3); D-G1 seeded silent-path API added
Protocol: living project doc set
Next step: Resolve Dice D-2 decisions for deterministic policy across visual rolls and roll-history retention before expanding visible history UX.
Required verification: docs_consistency, scoped_tests
Completed verification: scoped_tests (combatUtils + DiceRoller seeded-path tests)
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08
Human decision required: yes

## Required Review Brief

Title: Dice deterministic replay and history policy
Question: Should deterministic behavior cover only silent/system rolls, or also visual `DiceBox` rolls with a persisted history model?
Issue: `combatUtils` and `DiceRoller` now support seeded RNG injection, but `DiceService` and `DiceOverlay` still rely on visual engine randomness and there is no roll-history contract.
Current behavior: Silent rolls can be deterministic via injected RNG; visible/animated rolls cannot be replayed from a shared seed today and no roll history survives past current session state.
Decision blocked: Proceeding with full D-2 without this decision would create a silent/visual behavior mismatch for replay and audit work.

| Decision axis | Option A | Option B | Option C |
|---|---|---|---|
| Deterministic policy scope | Silent/system only (implemented) | Silent + visual seeded through `DiceService` contract | No deterministic policy |
| Roll-history scope | Keep none for now | Session-only ring buffer + optional export | Persist every roll in gameplay state |
| Consequence | Improves test/replay for non-visual logic first; audits across visual path remain limited | Enables unified audit and replay, requires additional API contract + storage migration | High debugging/replay risk; unpredictable regression comparisons |

Evidence: `src/utils/combat/combatUtils.ts`, `src/systems/spells/mechanics/DiceRoller.ts`, `src/services/DiceService.ts`, `src/components/dice/DiceOverlay.tsx`
Decision owner: Gameplay/product owner for deterministic systems and telemetry policy
Proof after decision: Implement a follow-on test + acceptance artifact that confirms seed + history contract across both roll paths.

## File map

- `docs/projects/dice/NORTH_STAR.md` - scope and handoff context
- `docs/projects/dice/TRACKER.md` - tasks and gap ownership
- `docs/projects/dice/GAPS.md` - durable unresolved findings
- `src/components/dice/DiceRollerModal.tsx` - roller modal behavior
- `src/components/dice/DiceOverlay.tsx` - DiceBox mount and visibility handling
- `src/components/dice/DiceService.ts` - `roll` / `visualRoll` service API
- `src/hooks/useDiceBox.ts` - DiceBox config and lifecycle
- `src/contexts/DiceContext.tsx` - context shape and actions
- `src/components/providers/AppProviders.tsx` - provider registration
- `src/state/reducers/uiReducer.ts` - global UI action (`TOGGLE_DICE_ROLLER`)

## Implemented state

- Dice modal is integrated into app modal layering and reducer-driven open/close flow.
- Visual rolling renders through `@3d-dice/dice-box`.
- Silent roll path exists via combat roll utility access through `DiceService`.
- Modal supports multi-die input, modifiers, scale control, and clear state.
- Dice overlay can show running/finished states tied to hook results.

## Integrations

- App wiring: `src/App.tsx` routes dice modal actions; `src/components/layout/GameModals.tsx` mounts the modal.
- Root layout includes `DiceOverlay` so visual rolls can mount centrally.
- `DiceContext` is part of provider stack and used by related gameplay and UI components.

## Gaps and uncertainties

- `combatUtils` and legacy `DiceRoller` now accept seeded RNG sources; visual roll RNG contract and shared policy are still unresolved.
- No persisted roll history/log is present in Dice UI or service layer.
- Silent and visual roll codepaths still do not share a single deterministic or audit policy.
- `useDiceBox` contains runtime-oriented guard logic and differs from service defaults in a few config points, which should be reconciled before broad changes.

## Current focus

- Active task: `D-2 - Add deterministic RNG + roll history plan`
- Resume target: finalize deterministic policy and roll-history acceptance criteria before implementing shared DiceBox + history UX.
- Current blocker surface: roll history scope and visual-seeded parity remain blocked for one policy decision.

## Next checks

1. Confirm RNG intent: one policy for gameplay fairness, replayability, and testing.
2. Choose deterministic policy scope across silent + visual paths and define seed handoff contract.
3. Define required roll-history scope (session-only, persisted, or export-only).
4. Verify whether visual roll config defaults and service-level config should be unified once policy is approved.

## Resume path

Read this file, then `TRACKER.md`, then `GAPS.md` before any runtime edits.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
