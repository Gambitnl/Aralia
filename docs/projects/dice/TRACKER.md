# Dice Tracker

Status: review-required
Last updated: 2026-06-08

## Purpose

Keep the Dice project handoff focused on observed runtime state, integration points, and unresolved decisions.

## Status vocabulary

- not_started
- active
- waiting
- blocked
- done
- superseded
- out_of_scope

## Active task queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| D-1 | done | Document Dice project cold-start state | Agent | 2026-05-31 | `docs/projects/dice/NORTH_STAR.md` | Keep docs aligned with runtime discovery | Confirm files exist and summarize gaps |
| D-2 | blocked | Add deterministic RNG + roll history plan | Agent | 2026-06-08 | `src/utils/combat/combatUtils.ts`, `src/systems/spells/mechanics/DiceRoller.ts`, `docs/projects/dice/NORTH_STAR.md` | Added seeded silent-path API and aligned legacy roller | Define visual RNG policy and roll-history scope before any D-G2 implementation |
| D-3 | not_started | Validate all Dice entry points against docs file map | Agent | 2026-05-31 | `src/App.tsx`, `src/components/layout/GameModals.tsx`, `src/contexts/DiceContext.tsx` | Reconcile docs with any changed code paths | Update `Last updated` and close if still aligned |

## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| D-G1 | done | in_scope_now | Agent | `docs/projects/dice/GAPS.md` | docs refresh + code scan | Deterministic seeded roll support now exists in Dice silent path | `src/utils/combat/combatUtils.ts`, `src/systems/spells/mechanics/DiceRoller.ts` | Replayability and deterministic tests were not possible before this refactor | Seeded silent-roll API is implemented; visual parity remains a follow-up | combatUtils + DiceRoller seeded-path tests |
| D-G2 | not_started | in_scope_now | Agent | `docs/projects/dice/GAPS.md` | docs refresh + code scan | No dice roll history persistence UI/service artifact | `src/components/dice` | Regression tracing and session replay are hard | Add scope and required retention policy | Add test/UX acceptance criterion |
| D-G3 | blocked_human_decision | support_needed_now | Agent | `docs/projects/dice/GAPS.md` | docs refresh + code scan | Silent and visual roll paths lack a shared deterministic + audit contract | `src/contexts/DiceContext.tsx`, `src/services/DiceService.ts`, `src/utils/combat/combatUtils.ts` | Behavior can diverge silently between silent and visual output | Approve deterministic policy + history contract before integration | Required Review Brief + cross-path acceptance test |

## Update rules

- Keep this file current when scope, owners, or proof links change.
- Keep unresolved items duplicated in `GAPS.md` as durable handoff records.
- Keep all updates restricted to docs/project surfaces for this request.
