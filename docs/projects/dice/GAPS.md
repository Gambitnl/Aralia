# Dice Gaps

Status: review-required
Last updated: 2026-06-08

Use this file for durable, in-project unresolved findings.

## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| D-G1 | done | in_scope_now | Agent | `docs/projects/dice/TRACKER.md` | narrow code scan | Deterministic/seeded RNG support added for silent Dice path | `src/utils/combat/combatUtils.ts`, `src/systems/spells/mechanics/DiceRoller.ts` | Replayability, tests, and seed-based checks were limited without this API | Add visual policy and cross-path contract before D-G2 execution | Rolled into follow-up acceptance for D-G2 |
| D-G2 | not_started | in_scope_now | Agent | `docs/projects/dice/TRACKER.md` | narrow code scan | No dice roll history persistence for users or replay logs | `src/components/dice/DiceRollerModal.tsx`, `src/services/DiceService.ts` | Hard to debug outcomes or audit roll outcomes after session events | Specify history storage and retention policy | Add UI and state persistence definition |
| D-G3 | blocked_human_decision | support_needed_now | Agent | `docs/projects/dice/TRACKER.md` | narrow code scan | Silent and visual roll paths share behavior expectations but differ by deterministic contract | `src/services/DiceService.ts`, `src/hooks/useDiceBox.ts`, `src/components/dice/DiceOverlay.tsx` | Divergent behavior can make outcomes inconsistent between gameplay and visual display | Finalize deterministic + history contract in review brief | Add a policy acceptance test |

## Classification reference

- `in_scope_now`: required before Dice feature can be considered stable in this area
- `support_needed_now`: required to avoid incorrect assumptions during expansion
- `adjacent_follow_up`: related but not required for current slice
- `out_of_scope`: clearly outside Dice project scope
- `blocked_human_decision`: requires owner policy choice
- `blocked_external_state`: requires external dependency or environment

## Update rules

- Keep each gap tied to evidence and a concrete next proof/check.
- Route non-Dice or cross-project debt to `docs/projects/GLOBAL_GAPS.md`.
