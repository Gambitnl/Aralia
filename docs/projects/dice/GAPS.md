# Dice Gaps

Status: active  
Last updated: 2026-05-31

Use this file for durable, in-project unresolved findings.

## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| D-G1 | not_started | in_scope_now | Agent | `docs/projects/dice/TRACKER.md` | narrow code scan | No deterministic/seeded RNG entry point for Dice service | `src/services/DiceService.ts`, `src/utils/combat/combatUtils.ts` | Replayability, tests, and seed-based simulations are impossible without policy | Define deterministic path and caller contract | Add deterministic fixture or seed contract test |
| D-G2 | not_started | in_scope_now | Agent | `docs/projects/dice/TRACKER.md` | narrow code scan | No dice roll history persistence for users or replay logs | `src/components/dice/DiceRollerModal.tsx`, `src/services/DiceService.ts` | Hard to debug outcomes or audit roll outcomes after session events | Specify history storage and retention policy | Add UI and state persistence definition |
| D-G3 | not_started | support_needed_now | Agent | `docs/projects/dice/TRACKER.md` | narrow code scan | Silent roll and visual roll paths share behavior expectations but differ by implementation path | `src/services/DiceService.ts`, `src/hooks/useDiceBox.ts`, `src/components/dice/DiceOverlay.tsx` | Divergent behavior can make outcomes inconsistent between gameplay and visual display | Define and document one RNG + result contract | Add integration test across both paths |

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
