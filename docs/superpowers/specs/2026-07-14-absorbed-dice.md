# Absorbed: Dice (docs/projects/dice)

Absorbed into the planmap topic `dice` by the 2026-07 absorption wave.
The folder's git history is the archive; this doc keeps the still-live decision brief and gaps.

## What this project was

The shipped dice feature set: modal controls and 3D visual rolling used by gameplay UI.
Silent rolls support seeded RNG injection (`combatUtils`, `DiceRoller`); visual rolls go
through `DiceService`/`DiceOverlay`/`useDiceBox` (DiceBox engine randomness).

## Decision resolved (Remy, 2026-07-21): Option B — one shared contract

Silent and visual rolls go through the SAME deterministic seed + audit contract;
a visual roll is presentation on top of the same underlying roll. Built 2026-07-21:

- `src/systems/dice/rollContract.ts` — pure `executeRoll(spec, seed)` core plus the
  `DiceAuditLog` session ring buffer (capacity 500). Every roll records its exact
  seed/spec/mode/context/outcome and can be reproduced after the fact via
  `reproduce()`. Roll-history scope = session-only ring buffer (Option B middle column).
- `src/services/DiceService.ts` — both `roll()` (silent) and `visualRoll()` route
  through the contract. The bundled `@3d-dice/dice-box` cannot be forced to land on
  predetermined faces (verified against the shipped bundle), so the contract outcome
  is authoritative and the physics faces are attached to the audit record
  (`presented`, with a `matchesOutcome` flag) instead of deciding the result.
- Tests: `src/systems/dice/__tests__/rollContract.test.ts` (16),
  `src/services/__tests__/DiceService.audit.test.ts` (4).

D-G2 (persist roll history beyond the session) is now unblocked if wanted.

## Open gaps carried into the planmap

| Gap | Summary | Evidence |
|---|---|---|
| D-G2 | No dice roll history persistence for users or replay logs | `src/components/dice/DiceRollerModal.tsx`, `src/services/DiceService.ts` |
| D-G3 | RESOLVED 2026-07-21 — shared deterministic + audit contract live (`src/systems/dice/rollContract.ts`); silent + visual both route through it via `DiceService`. Residual: the recreational `DiceRollerModal`/`useDiceBox` path stays presentation-only (fold under D-G4's factory decision) | `rollContract.ts`, `DiceService.ts` |
| D-G4 | DiceBox initialization split between modal hook and overlay service; decide shared factory vs intentional split | `src/hooks/useDiceBox.ts`, `src/services/DiceService.ts` |
| D-G5 | Dice roller modal carries local canvas style concerns; verify rendered modal before CSS cleanup (pointer-events + canvas layering) | `src/components/dice/DiceRollerModal.tsx` |

## Done work on record

- Seeded silent-path RNG API landed and the legacy roller aligned (D-2 partial, 2026-06-08):
  `src/utils/combat/combatUtils.ts`, `src/systems/spells/mechanics/DiceRoller.ts`.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/superpowers/specs/2026-07-14-absorbed-dice.md","sha256WithoutMarker":"eb4c390ee33053dc39817820abd7c4baf1b5de3e931d9a8e098dc4422979ee21","markedAtUtc":"2026-08-09T20:24:24.664Z"} -->
