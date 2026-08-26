# Deepdive: dice rollers against the roll contract

Board task: agora-6256. Written 2026-09-20 by dd-dice.
Planning surface: Plan Map topic `dice` (`public/planmap/topics.json:5633`), spec
`docs/superpowers/specs/2026-07-14-absorbed-dice.md`.

## 1. Verdict

The D-G3 roll contract is built, tested and correct, but almost no game roll goes
through it. `src/systems/dice/rollContract.ts` has exactly one production consumer,
`src/services/DiceService.ts`, which has exactly one production consumer,
`src/contexts/DiceContext.tsx`. Only two features call that path: the lockpicking
modal and the de-escalation check. All other game rolls (143 production call sites in
78 files) go through `rollDice`, `rollD20` and `rollDamage` in
`src/utils/combat/combatUtils.ts`, which default to `Math.random` and record nothing.
A third roller, `rollDiceString` in `src/services/npcGenerator.ts`, has its own parser
and a `Date.now()` seed. A second 3D dice path, `src/hooks/useDiceBox.ts`, lets the
physics engine decide the result, which the D-G3 decision forbids. Route the game
through the contract in this order: fix the lockpicking dishonesty bug first, then
give the contract the two missing features (`minRoll` and `isCritical`) plus an
explicit-seed entry point, then migrate the call sites.

## 2. Inventory

| File | Lines | What it does | Who calls it |
|---|---|---|---|
| `src/systems/dice/rollContract.ts` | 240 | Pure `executeRoll(spec, seed)` over `SeededRandom`, plus the `DiceAuditLog` singleton (500-record ring buffer, `perform`/`attachPresentation`/`reproduce`/`configure`). | Production: `src/services/DiceService.ts:11` ONLY. Tests: `src/systems/dice/__tests__/rollContract.test.ts`, `src/services/__tests__/DiceService.audit.test.ts`. |
| `src/utils/combat/combatUtils.ts` | 1624 | The legacy roller family: `rollDieGroup` (line 293), `rollDice` (343), `rollD20` (353), `rollDamage` (411). Each takes an optional `DiceRandomSource` that defaults to `Math.random`. `resolveAttack` (1602) is a pure resolver and takes a d20 value, so it is not a roller. | 143 production call sites in 78 files. `rollDice` 90, `rollDamage` 30, `rollD20` 23. Examples: `src/systems/puzzles/lockSystem.ts:76`, `src/hooks/combat/useActionExecutor.ts:524`, `src/commands/factory/AbilityCommandFactory.ts:777`, `src/App.tsx:1322`. |
| `src/services/DiceService.ts` | 261 | Singleton around `@3d-dice/dice-box`. `roll()` (163) and `visualRoll()` (178) both call `DiceAuditLog.perform`. `visualRoll` attaches the displayed faces (221) and has a 30-second watchdog (208). | `src/contexts/DiceContext.tsx:10` ONLY. |
| `src/services/npcGenerator.ts` | 649 | NPC generation. `rollDiceString` (53) is a private third dice parser. `npcGeneratorRng` (39) is a `SeededRandom` seeded from `Date.now()`. Used at lines 380 and 382 for height and weight. | Private to the file. |
| `src/contexts/DiceContext.tsx` | 162 | React provider exposing `roll` and `visualRoll`. | `src/components/puzzles/LockpickingModal.tsx:68`, `src/hooks/useDeEscalation.ts:36`, `src/components/dice/DiceOverlay.tsx:21`. Nothing calls the silent `roll`. |
| `src/hooks/useDiceBox.ts` | 533 | A second, independent `@3d-dice/dice-box` lifecycle. Its `roll()` (442) returns whatever the physics produced. No contract call. | `src/components/dice/DiceRollerModal.tsx:45`, mounted by `src/components/layout/GameModals.tsx:837`. |
| `src/systems/spells/mechanics/DiceRoller.ts` | 67 | Thin static wrapper over `combatUtils.rollDamage` and `rollD20`. | `src/systems/spells/mechanics/SavingThrowResolver.ts:46`. |
| `src/utils/random/seededRandom.ts` | 80+ | The `SeededRandom` Lehmer PRNG. `nextInt(min, max)` is max-exclusive (line 42). | The contract and npcGenerator both use it correctly. |

## 3. Findings

1. **The contract reaches two features.** `DiceAuditLog` is imported by one
   production file (`src/services/DiceService.ts:11`). `DiceService` is imported by
   one production file (`src/contexts/DiceContext.tsx:10`). `useDice()` is consumed by
   `src/components/puzzles/LockpickingModal.tsx:68` and
   `src/hooks/useDeEscalation.ts:36` only. Every other roll in the game is outside the
   audit log.

2. **Lockpicking shows the player a die that does not decide the outcome.**
   `src/components/puzzles/LockpickingModal.tsx:135` does
   `await visualRoll('1d20')` and throws the value away. The next statement (line 138)
   calls `attemptLockpick`, which rolls its own `rollDice('1d20')` at
   `src/systems/puzzles/lockSystem.ts:76`. The same pattern repeats at
   `LockpickingModal.tsx:173` (break, resolved at `lockSystem.ts:144`) and
   `LockpickingModal.tsx:204` (disarm). The displayed face and the applied face are two
   unrelated rolls. This is the exact failure D-G3 was decided to prevent.

3. **De-escalation is the correct pattern.** `src/hooks/useDeEscalation.ts:43-55`
   reads `a.rolls[0].value` back out of the returned `RollResult` and uses it. Any
   migration must copy this shape.

4. **`useDiceBox` lets the physics decide.** `src/hooks/useDiceBox.ts:442-459` returns
   the dice-box result directly and `src/components/dice/DiceRollerModal.tsx:100`
   reports `lastResult.total` to its `onRollComplete` caller. No `DiceAuditLog.perform`
   happens. The D-G3 decision says the physics animation is flavor, so this path
   contradicts the decision. The spec at
   `docs/superpowers/specs/2026-07-14-absorbed-dice.md` calls this path
   "presentation-only" and folds it under D-G4, but the modal is mounted in the live
   game (`src/components/layout/GameModals.tsx:833`), not in a sandbox.

5. **The injected-RNG seam exists but no live code uses it.** `rollDieGroup`
   (`combatUtils.ts:293-298`), `rollD20` (`:356`) and `rollDamage` (`:412`) take a
   `DiceRandomSource` that defaults to `Math.random`. 31 call sites pass an `rng`, but
   every one is either a Design Preview scenario with a fixed constant (for example
   `src/components/DesignPreview/steps/raceDomain/leaves/goldDragonbornRaceLeaf.tsx:493`
   passes `() => 0.5`) or a pass-through of an optional parameter that live code leaves
   undefined. `attackRollRng` is supplied only from
   `src/components/DesignPreview/steps/PreviewCombatScenarios.tsx:3494` and the
   scenario-control files; `src/hooks/useAbilitySystem.ts:370` passes none, so
   `src/commands/factory/AbilityCommandFactory.ts:777` uses `Math.random` in play.
   The Plan Map feature "Seeded silent-path RNG API + legacy roller alignment" is
   marked `done`, which is true for the API and false for the alignment.

6. **The contract cannot express two things the legacy roller can.** `RollSpec`
   (`rollContract.ts:45-49`) carries `notation`, `advantage` and `disadvantage`.
   `rollDamage` also takes `isCritical` (double the dice count) and `minRoll` (floor
   each die, for Elemental Adept). 30 `rollDamage` call sites depend on `isCritical`,
   for example `src/utils/combat/multiattackUtils.ts:274` and
   `src/systems/spells/mechanics/witchBoltOngoingResolution.ts:534`. No migration of
   damage rolls is possible until `RollSpec` grows these fields.

7. **The contract cannot accept a caller-supplied seed.** `DiceAuditLog.perform`
   (`rollContract.ts:176`) derives the seed itself from the private `baseSeed` and
   `nextIndex`. The 31 sites that inject a deterministic RNG, and the seeded voyage
   stream at `src/data/naval/voyageEvents.ts:59`, have no way to keep their
   determinism through `perform`. An explicit-seed entry point is a prerequisite for
   migrating them.

8. **The audit log never gets the world seed.** `configure({ baseSeed })`
   (`rollContract.ts:167`) is called only in tests
   (`src/systems/dice/__tests__/rollContract.test.ts:100`,
   `src/services/__tests__/DiceService.audit.test.ts:17`). In play, `baseSeed` is
   `Date.now() ^ Math.random()` set at module load (`rollContract.ts:162`). Individual
   records stay reproducible because each stores its own seed, but a whole session is
   not reproducible from the campaign seed.

9. **A third dice parser exists.** `src/services/npcGenerator.ts:53` splits on `d` and
   supports no sign and no flat modifier. Its stream `npcGeneratorRng`
   (`npcGenerator.ts:39`) is seeded from `Date.now()`, so NPC height and weight
   (`:380`, `:382`) are not reproducible. The same file already shows the correct
   pattern: `townRng` (`:356`) is keyed on `(worldSeed, burgId, npc id)` and is
   deterministic.

10. **Two grammars agree, which makes migration safe.** `executeRoll`
    (`rollContract.ts:83`, `:109-151`) and `rollDamage` (`combatUtils.ts:426-457`) use
    the same `([+-]?)(?:(\d+)d(\d+)|(\d+))` regex, the same whitespace strip and the
    same zero return for empty notation. Advantage semantics differ for multi-die
    formulas: `executeRoll` rolls every die twice, `rollD20` rolls only the single d20
    twice. For `1d20` they agree.

11. **`src/data/naval/voyageEvents/index.ts` is dead.** Only
    `src/systems/naval/VoyageManager.ts:25` imports `'../../data/naval/voyageEvents'`,
    which resolves to the 288-line file, not the 265-line directory index. The index
    holds its own `rollDice` call sites (`:42`, `:221`) that no build reaches. Any
    call-site count for a migration must exclude it.

12. **No guard stops the next unaudited roll.** There is no lint rule and no test that
    forbids `Math.random` or a direct legacy-roller import. `src/` holds 321 production
    `Math.random` occurrences. Without a gate, a migration regresses.

## 4. Decisions for Remy

**Q1. What happens to `combatUtils.rollDice` / `rollD20` / `rollDamage`?**

- A. Retire them. Migrate all 143 call sites to the contract and delete the legacy
  family.
- B. Keep them as the parser, and make them delegate: the exported functions call
  `DiceAuditLog.perform` when no `rng` is injected. Call sites do not change.
- C. Keep both, and migrate only player-visible rolls (attacks, saves, checks). Leave
  flavor rolls (NPC height, gathering yield) on `Math.random`.

Recommendation: **B**. It audits all 143 sites in one edit instead of 143, it keeps
the current signatures so nothing downstream breaks, and it leaves the injected-RNG
seam usable for Design Preview scenarios. A is the same end state but costs a
78-file migration and a large regression surface. C keeps two systems alive forever
and re-creates the lockpicking bug class every time a flavor roll becomes visible.

**Q2. What is the `DiceRollerModal` / `useDiceBox` path for?**

- A. A recreational dice tray with no game effect. Keep the physics result, and
  document that it is not a game roll.
- B. A real roll surface. Route it through the contract like `DiceService` does, and
  make the physics faces presentation only.
- C. Retire the modal's own engine and route the tray through `DiceService`, closing
  D-G4 by deleting the second DiceBox lifecycle.

Recommendation: **C**. `useDiceBox` (533 lines) and `DiceService` (261 lines) are two
maintained copies of the same engine lifecycle, and `onRollComplete` at
`DiceRollerModal.tsx:100` already hands a total to a caller, so the "no game effect"
claim in A is not enforced by anything. C closes D-G4 and D-G3's residual in one
change. Pick B instead if the tray must keep its own canvas styling.

**Q3. Does a session have to replay from the campaign seed?**

- A. Yes. Call `DiceAuditLog.configure({ baseSeed: worldSeed })` at campaign load, so
  a whole session replays.
- B. No. Per-record reproduction is enough; leave the `Date.now()` base seed.

Recommendation: **A**. The cost is one call at campaign load. It makes the D-G2
roll-history feature meaningful, and it matches how `townRng`
(`npcGenerator.ts:356`) already keys on the world seed. One consequence: with a fixed
base seed, loading a save and repeating an action gives the same die, so save-scumming
changes character. Say so if that is not wanted.

## 5. Follow-up work

All ten are filed on the board under campaign agora-f821. Ids are given per item.

1. (agora-f821.1) **Fix the lockpicking display-versus-outcome split.** `LockpickingModal.tsx:135`,
   `:173`, `:204` must pass the rolled d20 into `attemptLockpick`, `attemptBreak` and
   the disarm path; `lockSystem.ts:76`, `:144`, `:171`, `:209` must accept an optional
   supplied d20. Acceptance: a test drives the modal with a pinned `visualRoll` result
   and asserts the resolved margin uses that face.
2. (agora-f821.2) **Add `minRoll` and `isCritical` to `RollSpec`.** `rollContract.ts:45` and
   `executeRoll` must double the dice count on `isCritical` and floor each die at
   `minRoll`, matching `combatUtils.ts:444-448` and `:310`. Acceptance: a parity test
   asserts `executeRoll` and `rollDamage` agree over a formula corpus under a shared
   RNG.
3. (agora-f821.3) **Add an explicit-seed entry point to `DiceAuditLog`.** `perform` must accept an
   optional `seed` so callers with their own deterministic stream keep it and still get
   a record. Acceptance: the same seed twice yields identical outcomes and two records.
4. (agora-f821.4) **Make the legacy rollers delegate to the contract** (pending Q1 = B).
   `combatUtils.ts:293`, `:343`, `:353`, `:411` call `DiceAuditLog.perform` when no
   `rng` is injected, and keep the pure path when one is. Acceptance:
   `combatUtils_rollDice.test.ts` stays green and a new test asserts a record appears
   for every un-injected call.
5. (agora-f821.5) **Seed the audit log from the campaign seed** (pending Q3 = A). Acceptance: two
   loads of the same save produce the same first roll.
6. (agora-f821.7) **Retire the third dice parser in `npcGenerator`.** Delete `rollDiceString`
   (`npcGenerator.ts:53`), seed `npcGeneratorRng` (`:39`) from the world seed, and roll
   height and weight (`:380`, `:382`) through `executeRoll`. Acceptance: the same
   `(worldSeed, town, npc id)` gives the same height and weight across runs.
7. (agora-f821.9) **Close D-G4: one DiceBox lifecycle** (pending Q2). Acceptance: one file owns the
   `@3d-dice/dice-box` import and init, and `DiceRollerModal` rolls produce audit
   records.
8. (agora-f821.11) **Delete the dead `src/data/naval/voyageEvents/index.ts`.** Acceptance: the file is
   gone, `VoyageManager` still resolves `VOYAGE_EVENTS`, naval tests stay green.
9. (agora-f821.14) **Add a guard test against new unaudited rollers.** Acceptance: the test fails when
   a new legacy-roller import is added to a file not on an allowlist.
10. (agora-f821.18) **Correct the Plan Map dice topic.** Acceptance: the topic `status_note` states the
    reach of the contract with the call-site counts in this document.

## 6. Workflow gaps

All four are filed in `tools/agora/WORKFLOW_GAPS.md`.

1. (WF-G176) `docs/superpowers/specs/2026-07-14-absorbed-dice.md` says D-G3 is RESOLVED and the
   Plan Map dice topic repeats it, but the contract reaches 2 of 145 production roll
   sites. A "resolved" decision with an unmigrated codebase reads as finished work to
   the next agent.
2. (WF-G181) The Plan Map dice topic marks "Seeded silent-path RNG API + legacy roller alignment"
   `done` (built 2026-06-08). The API landed; the alignment did not. No live call site
   passes a seeded stream.
3. (WF-G185) `docs/deepdives/` was an empty directory with no README and no naming convention.
   Nothing told this agent what a deepdive document must contain.
4. (WF-G187) The deepdive prompt template gives a `gap add` invocation without `--proof`, which the command requires, so the first filing always warns and needs a `gap update` repair. That repair itself failed once with a 400 file-open error while the daemon still held `tools/agora/WORKFLOW_GAPS.md`, and only worked on retry.
