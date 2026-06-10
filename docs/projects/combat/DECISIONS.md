# Combat System Decisions

Status: active
Last updated: 2026-06-09

This file records the durable combat-rules decisions that matter to the next
agent. It stays short so the current policy is easy to recover.

## Decisions

| ID | Decision | Status | Evidence | Notes |
|---|---|---|---|---|
| D-01 | The death-save slice is considered resolved in source and docs; the old architecture note that said the system was absent is stale. | recorded | `src/hooks/combat/useTurnManager.ts`, `src/hooks/combat/useTurnOrder.ts`, `src/utils/combat/deathSaveUtils.ts`, `src/commands/effects/DamageCommand.ts`, `src/hooks/combat/__tests__/useTurnManager.deathSaves.test.ts`, `src/commands/effects/__tests__/ConcentrationBreakPathParity.test.ts` | Keep the open combat queue focused on the next concrete gap instead of reopening the generic death-save bucket. |
| D-02 | Stable downed player characters stay in the turn loop so turn-boundary cleanup, repeat saves, and duration processing can continue, but they stop rolling death saves once `isStable` is true. | recorded | `src/hooks/combat/useTurnManager.ts`, `src/hooks/combat/useTurnOrder.ts` | This preserves the current runtime shape while documenting why the death-save gap is closed. |
| D-03 | The AI loop keeps a shared three-action cap for turn safety, and auto-controlled allies reuse the same move/ability loop as enemy AI. | recorded | `src/hooks/combat/useCombatAI.ts`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/combat/useActionExecutor.ts`, `src/hooks/combat/__tests__/useCombatAI.test.ts` | Future per-creature action budgets or deeper tactical tuning need a separate policy decision instead of reopening the bounded-loop guard. |
| D-04 | Sentinel opportunity attacks zero the mover's current-turn movement with a temporary stop effect, so the turn reset still rebuilds movement from the live speed model instead of inventing a one-off speed state. | recorded | `src/hooks/combat/useActionExecutor.ts`, `src/hooks/combat/__tests__/useActionExecutor.test.ts` | Keep the stop-in-place rule attached to the OA hit path so later combat work does not route it through an unrelated movement mechanic. |
| D-05 | War Caster opportunity attacks reuse the existing reaction prompt, but only expose single-target action-cast spells and hand the chosen spell back to the spell executor as a reaction-cost cast. | recorded | `src/hooks/combat/useActionExecutor.ts`, `src/hooks/combat/useTurnManager.ts`, `src/components/Combat/CombatView.tsx`, `src/hooks/combat/__tests__/useActionExecutor.test.ts` | This preserves weapon OA behavior, skip behavior, enemy auto-OA behavior, and Sentinel's case-insensitive feat check while keeping spell resolution in the spell system. |
| D-06 | The combat log persists per encounter through localStorage and hydrates on mount when the same encounter key is supplied; `clearLogs` clears the same scoped history. | recorded | `src/hooks/combat/useCombatLog.ts`, `src/components/Combat/CombatView.tsx`, `src/hooks/combat/__tests__/useCombatLog.test.ts` | This keeps refresh recovery without turning the log into a global save file. Export/backfill history remains a separate follow-up if it becomes necessary. |
| D-07 | Resistance, vulnerability, and immunity exposure should stay as a compact 2D token-perimeter badge row with tooltip detail, not a broad BattleMap rewrite. The 3D renderer can mirror the pattern later, but the current slice should not widen into a renderer refactor. | recorded | `src/components/BattleMap/CharacterToken.tsx`, `src/components/BattleMap/__tests__/CharacterToken.test.tsx`, `misc/design.html?step=scenarios` | This keeps the combat UI readable without touching combat math or reopening the BattleMap architecture boundary. |
| D-08 | The 3D parity follow-through for resistance, vulnerability, and immunity should stay as a compact always-on actor badge row on `CharacterActor`, mirroring the 2D token language without forcing a VFX or renderer rewrite. | recorded | `src/components/BattleMap/characters/CharacterActor.tsx`, `src/components/BattleMap/characters/__tests__/CharacterActor.defense.test.tsx` | This keeps the 3D combatant readable at a glance while preserving the existing HP orb, nameplate, and selection ring stack. |
| D-09 | G30 modularization is review-required before implementation because `useAbilitySystem.ts`, `useCombatEngine.ts`, and `App.tsx` cross Combat, Commands, Spells, Layout, and App-shell ownership. | pending human review | `docs/projects/combat/NORTH_STAR.md` Required Review Brief, `docs/projects/combat/GAPS.md` G30, `docs/projects/code-modularization-audit/GAPS.md` CMA-G4 | Do not assign Combat implementation work until the owner boundary and required preservation tests are named. |

## Open Follow-Up

- Resolve the G30 Required Review Brief before assigning any more Combat implementation work.
