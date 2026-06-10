# Combat System Audit Or Proof

Status: review-required
Last updated: 2026-06-09

This file stores concise proof summaries for the Combat System living project.

## Proof Log

| Date | Proof | Result | Evidence |
|---|---|---|---|
| 2026-06-09 | 3D defense-badge parity verified against source and focused actor tests | Passed | `src/components/BattleMap/characters/CharacterActor.tsx`, `src/components/BattleMap/characters/__tests__/CharacterActor.defense.test.tsx` |
| 2026-06-09 | Combat log persistence verified against source and focused hook tests | Passed | `src/hooks/combat/useCombatLog.ts`, `src/components/Combat/CombatView.tsx`, `src/hooks/combat/__tests__/useCombatLog.test.ts` |
| 2026-06-09 | War Caster OA spell-selection path verified against source and focused tests | Passed | `src/hooks/combat/useActionExecutor.ts`, `src/hooks/combat/useTurnManager.ts`, `src/components/Combat/CombatView.tsx`, `src/hooks/combat/__tests__/useActionExecutor.test.ts` |
| 2026-06-09 | Sentinel OA stop-in-place verified against source and focused tests | Passed | `src/hooks/combat/useActionExecutor.ts`, `src/hooks/combat/__tests__/useActionExecutor.test.ts` |
| 2026-06-09 | Combat living-project docs audit and gap registry sync after Sentinel slice | Passed | `node scripts/audit-living-project-docs.cjs`, `docs/projects/combat/NORTH_STAR.md`, `docs/projects/combat/TRACKER.md`, `docs/projects/combat/GAPS.md`, `docs/projects/combat/COLD_START_AGENT_PROMPT.md` |
| 2026-06-09 | Death-save slice verified against source and focused tests | Passed | `src/hooks/combat/useTurnManager.ts`, `src/hooks/combat/useTurnOrder.ts`, `src/utils/combat/deathSaveUtils.ts`, `src/commands/effects/DamageCommand.ts`, `src/hooks/combat/__tests__/useTurnManager.deathSaves.test.ts`, `src/commands/effects/__tests__/ConcentrationBreakPathParity.test.ts`, `src/hooks/combat/__tests__/useTurnManager.durations.test.ts` |
| 2026-06-09 | AI loop cap and auto-controlled ally coverage verified against source and focused tests | Passed | `src/hooks/combat/useCombatAI.ts`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/combat/useActionExecutor.ts`, `src/hooks/combat/__tests__/useCombatAI.test.ts` |
| 2026-06-09 | 2D token defense-badge slice verified against source, focused tests, and visual inspection | Passed | `src/components/BattleMap/CharacterToken.tsx`, `src/components/BattleMap/__tests__/CharacterToken.test.tsx`, `misc/design.html?step=scenarios` |

## What The Proof Covers

- Death saves, downed-state recovery, concentration cleanup, and rules-level turn processing are implemented in source.
- The stale architecture note about a missing death-save system has been routed out of the open gap queue.
- The AI turn loop now has explicit coverage for the three-action cap, move/ability sequencing, and auto-controlled allies.
- The simple combat log now hydrates from and mirrors to localStorage under an encounter-scoped key, so a refresh can restore the same fight's visible history without widening the save system.
- War Caster opportunity attacks now surface eligible single-target action-cast spells in the same prompt that already serves weapon OAs, and the chosen spell is handed to the spell executor as a reaction-cost cast.
- Sentinel opportunity attacks now zero the mover's turn movement through the same combat hook path that resolves the hit.
- The 2D BattleMap token layer now exposes resistance, vulnerability, and immunity badges on the token perimeter, with tooltip details and a visual proof pass on the Fire Elemental / Skeleton resistance scenario.
- The 3D BattleMap actor layer now mirrors the same resistance, vulnerability, and immunity facts as a compact always-on badge row. This proof is source-backed and focused-test-backed; a live rendered 3D screenshot was not captured because the demo route was blocked during this pass.
- The Combat North Star parses cleanly again after the Sentinel docs pass, so the schema audit sees Combat as valid.
- The current combat queue is blocked on the G30 Required Review Brief and should not receive implementation sub-agents until that decision is answered.

## What Remains Open

- G30 remains blocked on a human decision, with the visual Required Review Brief now recorded in `NORTH_STAR.md`.
