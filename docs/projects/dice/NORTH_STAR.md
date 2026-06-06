# Dice North Star

Status: active  
Last updated: 2026-06-05

## Purpose and scope

Dice is an implemented feature set with modal controls and 3D visual rolling used by gameplay UI.
This project exists as a cold-start checkpoint: what is already shipped, where it lives, and what remains uncertain.

## Dashboard Card Schema

Project: Dice  
Slug: dice  
Category: Feature/UI Projects  
Status: active  
Confidence: medium  
Evidence: docs/projects/dice  
Gap signal: 3 open gaps in project scope  
Protocol: living project doc set  
Next step: Resume D-2 and define the deterministic RNG and roll-history acceptance criteria.  
Required verification: docs_consistency, scoped_tests  
Completed verification: not run  
Last proof: 2026-06-05  
Workflow gaps reviewed: 2026-06-05

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

- Deterministic seeded behavior is not implemented for Dice paths.
- No persisted roll history/log is present in Dice UI or service layer.
- Silent and visual roll codepaths do not currently share a single deterministic policy.
- `useDiceBox` contains runtime-oriented guard logic and differs from service defaults in a few config points, which should be reconciled before broad changes.

## Current focus

- Active task: `D-2 - Add deterministic RNG + roll history plan`
- Resume target: define one deterministic roll policy, then decide whether roll history is session-only, persisted, or export-only before touching runtime code.
- Current blocker surface: the project still has three documented Dice gaps, but none require a shared-workflow change.

## Next checks

1. Confirm RNG intent: one policy for gameplay fairness, replayability, and testing.
2. Define required roll-history scope (session-only, persisted, or analytics only).
3. Verify whether visual roll config defaults and service-level config should be unified.

## Resume path

Read this file, then `TRACKER.md`, then `GAPS.md` before any runtime edits.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
