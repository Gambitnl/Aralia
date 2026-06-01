# Dice Tracker

Status: active  
Last updated: 2026-05-31

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
| D-2 | active | Add deterministic RNG + roll history plan | Agent | 2026-05-31 | `src/components/dice`, `src/services/DiceService.ts` | Capture implementation requirements in follow-up planning | Define acceptance criteria with feature owner |
| D-3 | not_started | Validate all Dice entry points against docs file map | Agent | 2026-05-31 | `src/App.tsx`, `src/components/layout/GameModals.tsx`, `src/contexts/DiceContext.tsx` | Reconcile docs with any changed code paths | Update `Last updated` and close if still aligned |

## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| D-G1 | not_started | in_scope_now | Agent | `docs/projects/dice/GAPS.md` | docs refresh + code scan | No deterministic seeded roll support in Dice | `src/services/DiceService.ts`, `src/utils/combat/combatUtils.ts` | Future replay/testing and fairness checks cannot be guaranteed | Specify API and owner before implementation | Update docs once decision is made |
| D-G2 | not_started | in_scope_now | Agent | `docs/projects/dice/GAPS.md` | docs refresh + code scan | No dice roll history persistence UI/service artifact | `src/components/dice` | Regression tracing and session replay are hard | Add scope and required retention policy | Add test/UX acceptance criterion |
| D-G3 | not_started | support_needed_now | Agent | `docs/projects/dice/GAPS.md` | docs refresh + code scan | Multiple Dice RNG/roll paths without unified policy | `src/components/dice`, `src/services/DiceService.ts`, `src/utils/combat/combatUtils.ts` | Behavior can diverge silently between silent and visual rolls | Normalize roll policy before feature expansion | Add a policy doc or tests |

## Update rules

- Keep this file current when scope, owners, or proof links change.
- Keep unresolved items duplicated in `GAPS.md` as durable handoff records.
- Keep all updates restricted to docs/project surfaces for this request.
