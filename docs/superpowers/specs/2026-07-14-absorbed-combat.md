# Absorbed: Combat System (docs/projects/combat)

Status: active reference — absorbed into planmap topic `world-reactions` on 2026-07-15.
The living-project folder was deleted (git history is the archive). This doc keeps the
combat-engine ownership map and the durable rules decisions future agents rely on.

## Ownership map (evidence-verified 2026-06)

- `src/systems/combat`: subsystems — riders (`AttackRiderSystem`), events
  (`AttackEventEmitter`, `MovementEventEmitter`), `SavePenaltySystem`,
  `OpportunityAttackSystem`, `SustainActionSystem`.
- `src/hooks/combat/*`: orchestration — `useTurnManager` (initiative flow, round
  boundaries, end-of-turn), `useTurnOrder` (schedule math), `useCombatEngine`
  (damage/saves/zones/tick transitions), `useActionExecutor` (action semantics, OA,
  War Caster, Sentinel, logging), `useCombatAI` (idle->thinking->acting->done with a
  3-action cap; auto-controlled allies reuse the same path), `useCombatOutcome`.
- `src/utils/combat/*`: `combatUtils.ts` (state conversion + class combat palettes),
  `actionEconomyUtils.ts` (movement recalc from live speed at turn reset),
  `createEnemyFromMonster.ts`, `resistanceUtils.ts` (zone-aware damage context),
  `combatAI.ts`.
- `src/components/Combat`: `CombatView.tsx` (live host), `ReactionPrompt.tsx`,
  `EncounterModal.tsx`, `MonsterPicker.tsx`.
- Rendering is a separate layer under `src/components/BattleMap` and is never the
  rule owner.

## Durable decisions (keep; do not relitigate without new evidence)

- D-01/D-02: the death-save slice is resolved in source; stable downed characters stay
  in the turn loop (cleanup/repeat saves/durations continue) but stop rolling death
  saves once `isStable`. The old architecture-doc claim that the system is absent is
  stale.
- D-03: shared three-action AI cap for turn safety; per-creature budgets need a new
  policy decision, not a reopened loop guard.
- D-04: Sentinel OA zeroes the mover's current-turn movement via a temporary stop
  effect attached to the OA hit path.
- D-05: War Caster OA reuses the reaction prompt, exposes only single-target
  action-cast spells, and hands the cast to the spell executor as a reaction-cost cast.
- D-06: combat log persists per encounter through localStorage (`useCombatLog.ts`),
  hydrates on mount for the same encounter key; not a global save file.
- D-07/D-08: resistance/vulnerability/immunity exposure stays a compact badge row —
  2D token perimeter and always-on 3D actor badges — never a renderer rewrite.
- D-09/D-10 (Remy, 2026-06-10, DECISION_BLITZ D6): Code Modularization Audit owns the
  split plan for `useAbilitySystem.ts` / `useCombatEngine.ts` (and App-shell/provider
  movement). Combat's lane is contributing invariants and focused regression tests
  (rules, action sequencing, reactions, log semantics) BEFORE any code movement.

## Work absorbed into the planmap topic

Open: G30 invariants/tests contribution for the CMA split plan; CMA-G18 accept/defer
the `useActionExecutor` / `CombatView` / `EncounterModal` / `types/combat` split route
(no longer decision-blocked after D6); G31 allied party-member AI tactics; G32
`AttackRiderSystem` predicate extraction + narrow rider type exports (do not reopen
the already-landed dead-import and singleton-isolation work — `setInstance` /
`createFresh` / `src/test/combatEmitters.ts` exist).

Done and backdated: G33 total-party defeat now routes through teardown into GAME_OVER
(was a silent rewardless END_BATTLE back to PLAYING) — whole-game systems audit W01,
2026-07-11. The 2026-06 hardening wave closed G11 class palettes, G19 zone
resistance, G21 speed recalc, G23 log persistence, G24/G25 OA feats, G26 AI await
sequencing, G27 OA reach, G28/G29 concentration cleanup parity, and G20 2D/3D defense
badge parity.
