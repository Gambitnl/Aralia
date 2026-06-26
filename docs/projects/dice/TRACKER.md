# Dice Living Tracker

Status: review-required
Last updated: 2026-06-25

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Purpose

Keep the Dice project handoff focused on observed runtime state, integration points, and unresolved decisions.

## Status vocabulary

- not_started
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active task queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| D-2 | blocked | Add deterministic RNG + roll history plan | Agent | 2026-06-08 | `src/utils/combat/combatUtils.ts`, `src/systems/spells/mechanics/DiceRoller.ts`, `docs/projects/dice/NORTH_STAR.md` | Added seeded silent-path API and aligned legacy roller | Define visual RNG policy and roll-history scope before any D-G2 implementation |
| D-3 | not_started | Validate all Dice entry points against docs file map | Agent | 2026-05-31 | `src/App.tsx`, `src/components/layout/GameModals.tsx`, `src/contexts/DiceContext.tsx` | Reconcile docs with any changed code paths | Update `Last updated` and close if still aligned |

## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| D-G2 | not_started | in_scope_now | Agent | `docs/projects/dice/GAPS.md` | docs refresh + code scan | No dice roll history persistence UI/service artifact | `src/components/dice` | Regression tracing and session replay are hard | Add scope and required retention policy | Add test/UX acceptance criterion |
| D-G3 | blocked_human_decision | support_needed_now | Agent | `docs/projects/dice/GAPS.md` | docs refresh + code scan | Silent and visual roll paths lack a shared deterministic + audit contract | `src/contexts/DiceContext.tsx`, `src/services/DiceService.ts`, `src/utils/combat/combatUtils.ts` | Behavior can diverge silently between silent and visual output | Approve deterministic policy + history contract before integration | Required Review Brief + cross-path acceptance test |
| D-G4 | not_started | adjacent_follow_up | Codex | `docs/projects/dice/GAPS.md` | investigation packet routing 2026-06-25 | DiceBox initialization logic is split between `useDiceBox.ts` and `DiceService.ts`. | `src/hooks/useDiceBox.ts`; `src/services/DiceService.ts` | Manual and overlay visual roll robustness can drift. | Decide shared factory vs intentional split after visual/remount proof. | Mount/remount proof for both visual dice entry points or an explicit ownership decision. |
| D-G5 | not_started | adjacent_follow_up | Codex | `docs/projects/dice/GAPS.md` | investigation packet routing 2026-06-25 | Dice roller modal canvas styling should not be moved without current rendered proof. | `src/components/dice/DiceRollerModal.tsx` | Style cleanup could break canvas layering or pointer behavior. | Recheck rendered modal before style extraction. | Screenshot/rendered proof before and after any style change. |

## Update rules

- Keep this file current when scope, owners, or proof links change.
- Keep unresolved items duplicated in `GAPS.md` as durable handoff records.
- Keep all updates restricted to docs/project surfaces for this request.

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | active | Normalize this tracker to the living-project workflow contract | future agent | 2026-06-10 | docs/projects/PROJECT_CARD_SCHEMA.md; docs/agent-workflows/living-project-task-protocol/templates/LIVING_TRACKER.md | Replace this seeded row with the current real project task during the next iteration | Project tracker has at least one current active/waiting/done row with evidence and next proof |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
