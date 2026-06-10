# Combat System Runbook

Status: review-required
Last updated: 2026-06-09

## Resume Steps

1. Read `NORTH_STAR.md` for the current scope and status.
2. Read `TRACKER.md` for the open task queue and next proof target.
3. Read `GAPS.md` for the active gap list and classifications.
4. Cross-check `docs/architecture/domains/combat.md` for the current rules map.
5. Check `src/hooks/combat/useTurnManager.ts`, `src/utils/combat/deathSaveUtils.ts`, and `src/commands/effects/DamageCommand.ts` when validating death-save or concentration behavior.
6. Check `src/hooks/combat/useCombatLog.ts` and `src/components/Combat/CombatView.tsx` when validating combat log persistence or encounter-scoped reload recovery.
7. Keep `G30` review-required and do not split `useAbilitySystem`, `useCombatEngine`, or `App.tsx` until the Required Review Brief is answered.
8. If AI turn-loop assumptions come up again, check `src/hooks/combat/useCombatAI.ts`, `src/hooks/combat/useTurnManager.ts`, and `src/hooks/combat/useActionExecutor.ts`; G3 is already resolved and should not be reopened without new evidence.
9. If reaction prompts come up again, remember that weapon OAs, skip behavior, enemy auto-OAs, Sentinel stop-in-place, and War Caster spell substitutions are already closed in source/tests.
10. If G20 comes up again, use `misc/design.html?step=scenarios` as the regression reference for the 2D Fire Elemental / Skeleton token badges and `CharacterActor.defense.test.tsx` as the current proof for the mirrored 3D actor badge row; do not reopen the slice unless new evidence shows a regression.

## Verification

- Run focused combat tests for the selected gap.
- Run `node scripts/audit-living-project-docs.cjs`.
- Run `git diff --check` before closeout.
- If exported signatures or hooks/state surfaces change, run the dependency sync command named in `AGENTS.md`.

## Notes

The death-save slice is closed, the AI loop cap / auto-controlled ally slice is also closed, Sentinel OA stop-in-place is closed, and War Caster OA spell substitution is now closed. The combat log now survives refreshes through an encounter-scoped localStorage path. G20 now has 2D token-badge proof from the resistance scenario and 3D actor-overlay proof from focused actor tests. Combat has no assignable implementation gap until the G30 Required Review Brief is answered.
