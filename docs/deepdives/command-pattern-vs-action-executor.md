# Command pattern and useActionExecutor: overlap map

Task: agora-ab40. Written 2026-09-20 by dd-commands.
Planning surfaces: planmap topics `command-base-runtime`, `command-factory-runtime`,
`command-effects-runtime`, and `world-reactions` (gap CMA-G18).
Domain doc: `docs/architecture/domains/commands.md`.

## 1. Verdict

The two systems are not two engines for the same mechanic. They are two phases of one
call, and `useAbilityExecution` runs both in order. The hook path owns the turn: turn
ownership, resource payment, voluntary movement, opportunity attacks, and combat-event
emission. The command path owns the effect: attack rolls, damage, conditions, riders,
summons, and concentration. Three real defects come from the seam between them, not
from full duplication. A long-cast spell starts a ritual and also casts. A spell attack
emits a fabricated hit or miss before the real roll. Hook-path damage never forces a
concentration save. Migration must close the seam, not merge the two files.

## 2. Inventory

| File | Lines | What it does | Who calls it |
| --- | --- | --- | --- |
| `src/commands/base/CommandExecutor.ts` | 64 | Runs a command list against one `CombatState`. Returns success, final state, and the failed command. The rollback variant was deleted 2026-09-21; see F9. | `src/hooks/ability/useAbilityExecution.ts:63`, `src/hooks/ability/useConcentration.ts:54`, `src/commands/effects/ReactiveEffectCommand.ts:23`, `src/components/DesignPreview/steps/spells/shieldScenario.tsx:22`. No other production file. |
| `src/commands/base/SpellCommand.ts` | 238 | Declares the `SpellCommand` interface, `CommandContext`, `CommandMetadata`, and the delegated reactive payload. | Every command class and both factories. |
| `src/commands/base/BaseEffectCommand.ts` | 163 | Abstract base. Supplies `getCaster`, `getTargets`, `updateCharacter`, and `addLogEntry`. Holds the snapshot-versus-live rule. | 18 command classes in `src/commands/effects/`. |
| `src/commands/factory/SpellCommandFactory.ts` | 2534 | Turns a spell and its targets into a command list. | `src/hooks/ability/useAbilityExecution.ts:738`. |
| `src/commands/factory/AbilityCommandFactory.ts` | 1601 | Turns an ability into a command list. Also holds `WeaponAttackCommand`, the full attack-roll resolver. | `src/hooks/ability/useAbilityExecution.ts:1384`. `SpellCommandFactory.ts:37` imports `WeaponAttackCommand`. |
| `src/commands/factory/AbilityEffectMapper.ts` | 87 | Maps ability effect rows to spell effect rows. | `AbilityCommandFactory.ts`. |
| `src/hooks/combat/useActionExecutor.ts` | 1799 | Validates and commits one `CombatAction`. Owns turn ownership, the ritual gate, movement, opportunity attacks, sustain, break free, and ability events. | `src/hooks/combat/useTurnManager.ts:405`. `applyImmediateAbilityTurnEffects` is also called by `src/components/DesignPreview/steps/classes/subclasses/barbarian/WildHeartDemo.tsx:113`. |
| `src/hooks/combat/useTurnManager.ts` | 479 | Composes the turn pipeline, the combat engine, the visuals, and the action executor. Wraps `onCharacterUpdate` to clean up concentration at 0 HP. | `CombatView.tsx:72`, `useBattleMap.ts:38`, `BattleMapDemo.tsx:46`, `PreviewCombatScenarios.tsx:56`, `ClassBattlefieldDemo.tsx:21`. |
| `src/hooks/useAbilitySystem.ts` | 583 | Composite hook. Joins targeting, validation, action economy, reactions, concentration, and ability execution. | `BattleMap.tsx:47`, `BattleMap3D.tsx:50`, `CombatView.tsx`, `useBattleMap.ts`, and the combat previews. |
| `src/hooks/ability/useAbilityExecution.ts` | 1688 | Not named in the task body. It is the file that joins the two systems: it calls `onExecuteAction` first, then builds commands and runs `CommandExecutor`. | `src/hooks/useAbilitySystem.ts:367`. |

## 3. Findings

### F1. The two systems run in series, not in parallel

`useAbilityExecution` calls the hook path first and the command path second.
Evidence: `src/hooks/ability/useAbilityExecution.ts:1250` and `:1336` call
`onExecuteAction`. Line `:1384` then builds commands and `:1395` runs
`CommandExecutor.execute`. `onExecuteAction` is `executeAction` from
`useActionExecutor`, wired at `src/hooks/combat/useTurnManager.ts:405`. No mechanic is
executed twice by design.

### F2. A long-cast spell started a ritual and also cast — RESOLVED

RESOLVED 2026-09-21 (agora-f821.38). Remy ruled on the combat sheet (q4,
2026-09-20 23:21Z): start the ceremony only.

The defect: `executeAction` intercepted a spell whose casting time is in minutes or
hours, started a ritual, and returned plain `true`. `useAbilityExecution` read that
`true` as "the action was accepted" and continued to `executeSpell`, so the spell also
resolved in full on the same click.

The fix: accepted and resolved are now different outcomes. `CombatAction` carries a
`ritualStarted` flag (`src/types/combat.ts`); the ritual gate in
`useActionExecutor.ts` sets it on the envelope it was handed before returning `true`;
and both execution paths in `src/hooks/ability/useAbilityExecution.ts` read it and stop
before the cast. The instant-cast path is gone — the slow cast runs over the turns in
the ritual runtime, and `BattleMapHUD` already reads that progress in combat through
`RitualProgressPanel`.

The blind spot is closed too. The old ritual test called `executeAction` alone and
could not see composed behavior. `src/hooks/__tests__/useAbilitySystem.ritualGate.test.ts`
now wires the real executor to the real ability system and casts a ten-minute spell
through the seam: START_RITUAL is dispatched, no command is ever built, no damage or
condition reaches the target, and no spell slot is spent. It was confirmed red against
the old code before the fix landed.

### F3. A spell attack emits a fabricated hit or miss before the real roll (high severity)

`buildLegacyAttackResult` (`src/hooks/combat/useActionExecutor.ts:514-553`) rolls a
real d20 at `:524` and builds a hit or miss record. `handleAbilityEvents` uses that
record at `:1428` when the action carries no `attackResults`.

Path B (abilities) avoids this. It sets `suppressAbilityEvents: true`
(`useAbilityExecution.ts:1333`), runs the commands, then replays the action with the
real `attackResults` (`:1404-1412`).

Path A (spells) does neither. The action built at `:1248` has no
`suppressAbilityEvents`, and Path A never replays `attackResults`. Every spell with an
attack roll therefore emits `unit_attack` with a fabricated result, and
`resolveOnTargetAttackReactiveEffects` (`useActionExecutor.ts:709-798`) decides Armor
of Agathys-style retaliation from that fabricated result. The command layer then rolls
the true attack and emits a second, possibly opposite, `unit_attack`.

### F4. Three separate attack-roll implementations exist

1. `WeaponAttackCommand`, `src/commands/factory/AbilityCommandFactory.ts:776-840`. It
   applies advantage sources, the high-ground elevation rule, cover, attack riders, the
   caster crit threshold, and the Shield reaction.
2. `handleOpportunityAttacks`, `src/hooks/combat/useActionExecutor.ts:924-957`. It
   applies advantage, disadvantage, and a finesse rule only. It has no cover, no
   elevation, no riders, and no Shield reaction, and it fixes the critical hit at 20.
3. `buildLegacyAttackResult`, `src/hooks/combat/useActionExecutor.ts:514-553`. It is
   smaller again and computes the proficiency bonus with a different formula.

### F5. Attack riders never apply to an opportunity attack

`AttackRiderSystem` is imported only by command-side files:
`src/commands/effects/RegisterRiderCommand.ts:25`,
`src/commands/factory/AbilityCommandFactory.ts:48`,
`src/commands/effects/ConcentrationCommands.ts:21`, and
`src/utils/combat/multiattackUtils.ts:40`. No file in `src/hooks/` imports it.

Riders live on `character.riders`
(`src/systems/combat/AttackRiderSystem.ts:200-215`), so they survive the React update.
The hook-side opportunity attack never reads them. Hunter's Mark, Hex, and Divine Favor
therefore add no damage to an opportunity attack.

### F6. Hook-path damage never forces a concentration save

`DamageCommand` runs the save (`src/commands/effects/DamageCommand.ts:635-690`).
`handleDamage` in `src/hooks/combat/engine/useCombatEngine.ts:655-762` does not. It
applies defenses, on-damage riders, death saves, and repeat saves, but it holds no
concentration code. `useTurnManager.ts:186-250` covers only the 0 HP case, and its own
comment calls that a fallback cleanup.

All hook-path damage therefore skips the save. Call sites:
`useActionExecutor.ts:778` (reactive retaliation), `:993` (opportunity attack),
`:1132` (movement debuff), `:1179` (spell zone), `:1719` (sustain), and
`useCombatEngine.ts:1196`, `:1272`, `:1325`, `:1347` (environment and scheduled
effects).

### F7. Two reactive trigger branches in the command layer are dead

`ReactiveEffectCommand` registers listeners for `on_target_attack` and
`on_target_move` (`src/commands/effects/ReactiveEffectCommand.ts:135-166`). Those
listeners fire only from `attackEvents.emitPreAttack` and
`movementEvents.emitMovement`. Neither method has a production caller. The only calls
are in tests: `src/systems/combat/__tests__/AttackEventEmitter.test.ts`,
`src/systems/combat/__tests__/MovementEventEmitter.test.ts`, and
`src/commands/effects/__tests__/ReactiveEffectCommand.test.ts`. The live path for
`on_target_attack` is `useActionExecutor.ts:709-798`, which reads the
`reactiveTriggers` array instead.

The header of `src/systems/combat/AttackEventEmitter.ts:25` states
"Called by: useActionExecutor". That is wrong. `useActionExecutor.ts` does not import
`attackEvents`.

### F8. The `unit_move` event has no listener

`useActionExecutor.ts:1103-1110` emits `unit_move`. No file calls
`combatEvents.on('unit_move', ...)`. The only `combatEvents.on` call in production is
`ReactiveEffectCommand.ts:176`, for `unit_cast`. Command-side forced movement does not
emit `unit_move` at all, so the event is not a trustworthy movement feed today.

### F9. Rollback and undo were dead code — RESOLVED, both deleted

RESOLVED 2026-09-21 (agora-f821.55). Remy ruled on the combat sheet (q5,
2026-09-20 23:21Z): delete the hook and reverse T3.

`CommandExecutor.executeWithRollback` had no caller, in production or in tests, and
no command class ever implemented the optional `undo` method declared on
`SpellCommand`. Both are now removed from `src/commands/base/CommandExecutor.ts` and
`src/commands/base/SpellCommand.ts`. `CommandExecutor.execute` is the one real path.

The earlier decision T3 in `docs/projects/PROJECT_COMPLETION_ARCHIVE.md` kept rollback
as an explicit fallback; that record now carries a REVERSED note. A dev-mode turn
rewind remains a separate future idea (agora-db71.33/.34); it is not built here and it
is not a reason to keep an interface member nothing implements.

### F10. The movement split is deliberate and almost complete

Voluntary movement is hook-owned (`useActionExecutor.ts:1072-1285`). Forced movement,
pull, teleport, speed change, and stop are command-owned
(`src/commands/effects/MovementCommand.ts:86-101`). Spell-zone triggers have parity:
the hook uses `AreaEffectTracker`, and the command uses
`src/commands/effects/commandAreaMovementEffects.ts`, whose header states that intent.
Opportunity attacks correctly do not fire for forced movement or teleport
(`src/systems/combat/reactions/OpportunityAttackSystem.ts:91`).

Two gaps remain. Movement-trigger debuffs run only in the hook
(`useActionExecutor.ts:1120-1136`). The `unit_move` event is emitted only by the hook.

### F11. Action cost is paid twice, from the same base state

`executeAction` pays the cost at `useActionExecutor.ts:1679`. `useAbilityExecution`
pays it again at `:1253` and `:1338`, then overwrites the final caster with
`applyResourceSnapshotToCaster` (`src/hooks/actionUtils.ts:57-64`). Both calls reach
the same helper, `consumeActionCost` in `src/utils/combat/actionEconomyUtils.ts`, and
both start from the same pre-payment character
(`src/hooks/combat/useActionEconomy.ts:190-192`). The result is equal today. This is a
trap, not a defect: a change to one call site alone creates a silent double charge.

### F12. Ownership map today

| Mechanic | Owner today | Correct owner |
| --- | --- | --- |
| Turn ownership, out-of-turn cost check | hook, `useActionExecutor.ts:1487-1496` | hook |
| Action, bonus action, reaction, movement payment | both, see F11 | hook only |
| Dash, Disengage, Stand Up, Rage, Action Surge | hook, `useActionExecutor.ts:209-492` | hook |
| Voluntary movement, facing, tile effects | hook, `:1072-1285` | hook |
| Opportunity attacks | hook, `:809-1060` | command, see decision D3 |
| Forced movement, pull, teleport | command, `MovementCommand.ts:86-101` | command |
| Ritual start | hook, ritual gate in `useActionExecutor.ts` | hook, and it now stops the cast, see F2 |
| Attack rolls | both, see F4 | command |
| Damage from a cast or an attack | command, `DamageCommand.ts` | command |
| Damage from zones, environment, reactions | hook, `useCombatEngine.ts:655` | either, but the concentration save must run |
| Conditions | shared writer `applyRuntimeStatusCondition` | shared writer, as now |
| Attack riders | command only, see F5 | command, reached by every attack |
| Concentration break at 0 HP | both, `DamageCommand.ts:646` and `useTurnManager.ts:186` | command, hook fallback retired |
| Concentration save on damage | command only, see F6 | command, reached by every damage source |

## 4. Decisions for Remy

### D1. What must happen when a player casts a long spell during a fight? — RULED

RULED by Remy, combat sheet q4, 2026-09-20 23:21Z: option 2 — start the ceremony only.
The combat screen starts the ritual and cancels the immediate cast; the slow cast runs
over the turns.

Done 2026-09-21 (agora-f821.38), exactly as the option described: `executeAction` now
reports "handled as a ritual" on the action envelope instead of plain success, and
`useAbilityExecution` no longer continues to the cast. See F2 for the resolved state.

### D2. Keep or retire command rollback? — RULED: retire

RULED by Remy, combat sheet q5, 2026-09-20 23:21Z: option 1. Delete
`executeWithRollback` and the `undo` member, and reverse T3.

Done 2026-09-21 (agora-f821.55). Nothing called the code, no command supported it, and
a partial rollback is worse than none. See F9 for the resolved state.

Remy's side note on option 3 — "flag it as a dev mode only option, implement it in
combat for dev mode" — is recorded as a separate future turn-rewind idea
(agora-db71.33/.34). It is not a reason to keep this hook, and it is not built here.

### D3. Which lane owns the attack roll?

Three implementations exist. See F4. Only one applies cover, elevation, riders, the
crit threshold, and the Shield reaction.

Options:

1. Opportunity attacks build a `WeaponAttackCommand` and run it through
   `CommandExecutor`. The hook keeps only the reaction prompt and the Sentinel stop.
2. The hook keeps its own roll, and the missing rules are copied into it.

Recommendation: option 1. It deletes two attack-roll implementations and gives
opportunity attacks cover, elevation, riders, and Shield at no extra cost. It is the
larger job, because `WeaponAttackCommand` needs a `CombatState` and the hook holds a
character array.

## 5. Follow-up work

1. **Stop the ritual double cast.** `useActionExecutor.ts:1500-1537` must report a
   result that is distinct from plain success, and `useAbilityExecution.ts:1250` must
   not continue to `executeSpell`. Acceptance: a test casts a spell with a ten-minute
   casting time through `useAbilitySystem`; the ritual is dispatched, and no damage, no
   condition, and no spell slot change reaches the target.
2. **Delete the fabricated attack result.** Remove `buildLegacyAttackResult`
   (`useActionExecutor.ts:514-553`). Give Path A the same treatment as Path B: set
   `suppressAbilityEvents` on the action built at `useAbilityExecution.ts:1248`, and
   replay the action with the real `attackResults` after `CommandExecutor.execute` at
   `:750`. Acceptance: a spell attack emits exactly one `unit_attack` event, and its
   `isHit` equals the roll recorded by the command.
3. **Route opportunity attacks through the command attack resolver.** Replace the roll
   block at `useActionExecutor.ts:924-1010` with a `WeaponAttackCommand` run.
   Acceptance: an opportunity attack applies cover, the high-ground rule, an active
   Hunter's Mark rider, and the caster crit threshold, each proven by a test.
4. **Make hook-path damage force the concentration save.** Add the save to
   `handleDamage` in `useCombatEngine.ts:655-762`, or route that damage through
   `DamageCommand`. Acceptance: an opportunity attack on a concentrating caster rolls a
   Constitution save at DC 10 or half the damage, and a failure runs the
   `BreakConcentrationCommand` cleanup.
5. **Remove or wire the dead reactive listeners.** Decide on the `on_target_attack` and
   `on_target_move` branches at `ReactiveEffectCommand.ts:135-166`, on
   `AttackEventEmitter.emitPreAttack`, and on `MovementEventEmitter.emitMovement`. Fix
   the false header at `AttackEventEmitter.ts:25`. Acceptance: no production file
   registers a listener that no production file can fire, and the header names the real
   callers.

Board ids: agora-f821.38 (item 1), agora-f821.39 (item 2), agora-f821.41 (item 3),
agora-f821.43 (item 4), agora-f821.45 (item 5).

## 6. Workflow gaps

1. WF-G197. The `gap add` command line in the deepdive prompt omits the required
   `--proof` flag. A copied command fails.
2. WF-G198. The Plan Map has no topic for the hook-side action executor. The command
   lane has three topics, but `useActionExecutor` appears only inside
   `world-reactions`, as gap CMA-G18. Work found here has no correct home.
