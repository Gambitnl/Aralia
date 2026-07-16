# Absorbed: Dice (docs/projects/dice)

Absorbed into the planmap topic `dice` by the 2026-07 absorption wave.
The folder's git history is the archive; this doc keeps the still-live decision brief and gaps.

## What this project was

The shipped dice feature set: modal controls and 3D visual rolling used by gameplay UI.
Silent rolls support seeded RNG injection (`combatUtils`, `DiceRoller`); visual rolls go
through `DiceService`/`DiceOverlay`/`useDiceBox` (DiceBox engine randomness).

## Pending human decision (D-2 review brief — still open)

Question: should deterministic behavior cover only silent/system rolls, or also visual
`DiceBox` rolls with a persisted roll-history model?

| Decision axis | Option A | Option B | Option C |
|---|---|---|---|
| Deterministic policy scope | Silent/system only (implemented) | Silent + visual seeded through `DiceService` contract | No deterministic policy |
| Roll-history scope | None for now | Session-only ring buffer + optional export | Persist every roll in gameplay state |
| Consequence | Test/replay for non-visual logic first; visual audits limited | Unified audit/replay; needs API contract + storage migration | High debugging/replay risk |

Blocked work: D-G2 (roll-history persistence) should not start before this decision.

## Open gaps carried into the planmap

| Gap | Summary | Evidence |
|---|---|---|
| D-G2 | No dice roll history persistence for users or replay logs | `src/components/dice/DiceRollerModal.tsx`, `src/services/DiceService.ts` |
| D-G3 | Silent and visual roll paths lack a shared deterministic + audit contract (blocked on human decision above) | `DiceService.ts`, `useDiceBox.ts`, `DiceOverlay.tsx` |
| D-G4 | DiceBox initialization split between modal hook and overlay service; decide shared factory vs intentional split | `src/hooks/useDiceBox.ts`, `src/services/DiceService.ts` |
| D-G5 | Dice roller modal carries local canvas style concerns; verify rendered modal before CSS cleanup (pointer-events + canvas layering) | `src/components/dice/DiceRollerModal.tsx` |

## Done work on record

- Seeded silent-path RNG API landed and the legacy roller aligned (D-2 partial, 2026-06-08):
  `src/utils/combat/combatUtils.ts`, `src/systems/spells/mechanics/DiceRoller.ts`.
