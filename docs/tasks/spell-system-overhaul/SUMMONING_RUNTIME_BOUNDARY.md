# Summoning Runtime Boundary

Status: active boundary note, created 2026-06-01 for `SSO-SUMMONING-RUNTIME-PARITY-001`; implemented/open tables refreshed 2026-07-01 against the current tree.

This note prevents future agents from treating every summon-related file as the authoritative runtime. Aralia currently has two summon-shaped paths, but only one is production-fed by spell casting.

## Current authority

| Surface | Current role | Evidence status |
| --- | --- | --- |
| `SummoningCommand` | Active command-runtime path for spell-created summons. | Spell command factory routes `SUMMONING` effects into command execution. |
| `DamageCommand` | Command-runtime cleanup path for summons that reach 0 HP. | Removes `isSummon` actors from combat state when damage drops them to 0 HP. |
| `CombatCharacter.summonMetadata` | Shared metadata envelope for command-created summons and hook-created helper summons. | Stores caster, spell, entity type, form name, source name, duration, and dismissability. |
| `useSummons` | Helper/test-only hook, not authoritative production summon runtime. | No longer imported by `CombatView`; combat spell casting stays command-owned unless a future parity slice deliberately promotes the hook. |

## Contract for future changes

1. Do not route new production summon behavior through `useSummons` unless this boundary is reopened and updated explicitly.
2. For active combat casting, treat `SummoningCommand` and command results as the current source of truth.
3. Keep `useSummons` metadata aligned while it exists, because tests or future preview-only UI may still inspect it.
4. If `useSummons` is promoted later, update this boundary first and prove commands and the hook share one creation/update/removal contract.
5. Visual proof for summons should use command-created summons unless a later slice wires `useSummons` into production casting.

## What is already implemented (verified 2026-07-01)

- Command-created summons are tagged with `isSummon`.
- Command-created summons store `summonMetadata.casterId` and `spellId`.
- Command-created summons now store `entityType`, `formName`, and `sourceName`.
- `useSummons` helper-created summons now store the same identity fields, but the hook is retained for helper tests rather than production spell casting.
- Recasting a familiar through `SummoningCommand` removes the existing familiar from the same caster/spell before creating the replacement.
- Damage that drops an `isSummon` actor to 0 HP removes it from combat state and logs disappearance.
- `src/commands/effects/CommandedSummonCommand.ts` — generic "command your summon" orders execute through the same combat-log/command pipeline as other spell actions (routed via `AbilityCommandFactory`).
- `src/commands/effects/SummonDismissCommand.ts` — `dismissAction`/`dismissable` metadata is now an executable dismiss action for non-familiar summons (e.g. Find Steed), separate from the familiar pocket flow.
- `src/commands/effects/SummonReturnHomeCommand.ts` — planar/service summons (no-agreement or service-complete) can be returned home through the command pipeline.
- `src/types/spellControlledEntity.ts` — typed runtime shape for controllable utility entities (Mage Hand-style persistent helpers with movement/manipulation limits), referenced from `src/types/spells.ts`.
- Familiar dismissal/pocket (`FamiliarPocketCommands.ts`), shared senses (`FamiliarSharedSensesCommand.ts` + `visibilityObserverPolicy.ts` observer delegation in both map modes), and touch-spell delivery (targeting bridge + reaction spend + 2D/3D delivery cue) all have implemented runtime paths — see the dated foothold sections below.
- Extensive live-data test coverage exists under `src/commands/__tests__/SummoningCommand.*LiveData.test.ts` (~35 spells: Find Familiar, Conjure Fey/Animals/Elemental, Animate Dead, Spiritual Weapon, True Polymorph, Planar Ally, etc.), plus binding/domination-control live-data tests; some of these are uncommitted concurrent work as of 2026-07-01.

## What remains open (refreshed 2026-07-01)

| Open work | Owning row |
| --- | --- |
| Define 2D/3D map categories for creature summons, mounts, invisible servants, disks, objects, and guardian-style constructs. | `SSO-SUMMONING-MAP-VISUALS-001` |
| Familiar dismissal, pocket dimension, shared senses, and touch spell delivery: runtime paths are all implemented (see footholds below). Recall placement, pocketed-familiar turn-order policy, and the shared-senses observer label now have focused proof. Failed-first rendered proof on 2026-07-02 found the overlay defect; the `Z_INDEX.COMBAT_OVERLAY` fix now renders the label legibly in both 2D and 3D. | `SSO-LEVEL1-FAMILIAR-RUNTIME-001` |
| Capture rendered proof that summon tokens/actors appear, identify their type/form/source, and disappear cleanly. | `SSO-COMBAT-MAP-PRESENTATION-MATRIX-001` |

## Proof required before closing runtime parity

Runtime parity is not closed by comments or metadata alone. Closing it requires evidence that one authoritative path owns summon creation, updates, duration, cleanup, callbacks, concentration cleanup, form choice, command economy, and visual state.

Acceptable closure paths:

1. `SummoningCommand` remains authoritative for production spell-created summons.
2. `useSummons` stays helper/test-only and must not become a production summon path without reopening this boundary.
3. If a later design promotes `useSummons`, command execution must delegate creation/update/removal into it or a shared service with parity proof.

## 2026-07-01 useSummons production wiring retirement

- `CombatView` no longer imports `useSummons`, removing the unused placeholder callbacks that made the hook look like a second production summon owner.
- `useSummons` remains covered by `src/systems/spells/effects/__tests__/SummoningSystem.test.ts` as helper/test-only state, preserving its metadata alignment without routing live spell casting through it.
- Focused proof passed with `node node_modules\vitest\vitest.mjs run --dir src src\systems\spells\effects\__tests__\SummoningSystem.test.ts` (1 file / 7 tests), and an import-only search found `useSummons` imported only by that test file.

## 2026-07-01 summon form/count routing refresh

- Current summon-spirit form choices use the existing mode-choice input path, and `SummoningCommand` preserves the selected form on the created actor.
- Focused proof passed with `node node_modules\vitest\vitest.mjs run --dir src src\commands\__tests__\SummoningCommand.summonBeastLiveData.test.ts src\commands\__tests__\SummoningCommand.conjureAnimalsLiveData.test.ts` (2 files / 4 tests).
- The maintained Conjure Animals spell is the 2024 spectral-pack version, not a CR/count menu, and a current corpus scan found no spell JSON using `countByCR`. Future count-by-CR imports should open a fresh source-backed row instead of relying on the retired SSO form-selection row.

## 2026-07-01 command-economy / hostility refresh

- Visible verifier thread `019f1f7a-1712-7f20-8735-5c04d8947477` classified the command-economy row as still real: command counters existed, but Summon Greater Demon did not yet have a live actor bridge or AI hostility policy.
- `UtilityCommand` now creates the live Summon Greater Demon actor from `public/data/spells/level-4/summon-greater-demon.json`, preserving no-action verbal commands, no-command behavior, control-save, true-name, control-break, blood-circle, lifecycle, and command-budget metadata on `summonMetadata`.
- `combatAI` now treats an uncontrolled Summon Greater Demon as hostile to living non-demons, reusing the existing attack/movement planner rather than normal team allegiance.
- Focused proof passed with `node node_modules\vitest\vitest.mjs run --dir src src\commands\__tests__\SummoningCommand.summonGreaterDemonLiveData.test.ts src\utils\combat\__tests__\combatAI.test.ts` (2 files / 23 tests), and the adjacent command-economy slice passed with 7 files / 33 tests. The older `useTurnManager.summonGrace.test.ts` still fails independently because the grace actor remains in hook state; that cleanup failure is not used as command-economy closure proof.

Until one of those paths is implemented and proved, keep `SSO-SUMMONING-RUNTIME-PARITY-001` open.

## 2026-06-01 familiar dismissal split

- `SSO-FAMILIAR-DISMISS-POCKET-001` now owns explicit familiar dismissal, temporary pocket-dimension state, and reappearance behavior.
- This remains separate from generic summon 0-HP cleanup: dismissal should preserve the familiar bond for later return, while 0-HP cleanup removes the map actor after defeat.

## 2026-06-01 familiar pocket-state foothold

- `CombatState.pocketedSummons` and `FamiliarPocketCommands.ts` now provide the runtime state transition for dismissing and recalling a familiar.
- 2026-07-02 focused scheduler proof in `src/hooks/combat/__tests__/useTurnOrder.familiarPocket.test.ts` confirms the turn-order contract: while the familiar is pocketed and absent from `characters`, the scheduler skips that id; after recall restores the actor, the familiar resumes its shared after-caster slot.
- This does not make the feature player-facing complete yet. Action wiring, recall placement, and turn-order policy now have focused proof; rendered 2D/3D pocket/recall and shared-senses observer proof remains open.

## 2026-06-01 familiar pocket ability-factory foothold

- `AbilityCommandFactory` can now route `familiar_pocket` ability effects into `DismissFamiliarToPocketCommand` or `RecallFamiliarFromPocketCommand`.
- This keeps the future familiar action path command-owned. It does not yet create the player-facing abilities or prove state propagation.

## 2026-06-01 familiar pocket propagation foothold

- `useAbilitySystem` can now propagate familiar pocket command results through full roster replacement and `pocketedSummons` publication.
- `CombatView` currently owns the pocketed-summon list. This is a practical handoff, not a final combat-state architecture decision.

## 2026-06-01 familiar pocket caster actions

- `SummoningCommand` now adds `Dismiss Familiar` and `Recall Familiar` abilities to the caster after creating a familiar.
- These abilities use the command-owned `familiar_pocket` path; command proof, placement validation, turn-order policy, and rendered shared-senses observer review now have focused coverage.

## 2026-06-01 familiar shared-senses and touch-delivery split

- `SSO-FAMILIAR-SHARED-SENSES-001` now owns shared-senses and telepathy behavior.
- `SSO-FAMILIAR-TOUCH-DELIVERY-001` now owns routing eligible touch spells through the familiar.
- Both are separate from pocket dismissal/recall, which now has runtime/action/UI-path footholds and focused command/scheduler proof but still needs passing rendered map proof.

## 2026-06-01 familiar shared-senses foothold

- Command-created familiars now preserve shared-senses metadata and grant the caster a `Use Familiar Senses` ability when the spell data supports it.
- This does not yet switch map visibility/observer state; `SSO-FAMILIAR-SHARED-SENSES-001` remains waiting for execution and proof.

## 2026-06-01 familiar shared-senses execution foothold

- `FamiliarSharedSensesCommand` now activates the caster-side shared-senses state for an on-map familiar.
- The command records the familiar as `activeEffects[].mechanics.observerCharacterId`, preserves telepathy range/cost metadata, enforces the current telepathy range, and logs the activation.
- This still does not prove or implement the 2D/3D observer handoff. The remaining gap is to make map visibility, camera/readability, and rendered proof consume the active effect instead of treating this as a log-only action.

## 2026-06-01 familiar shared-senses observer policy

- `visibilityObserverPolicy.ts` now resolves a caster with active familiar shared senses to the familiar observer id.
- `BattleMap.tsx` and `BattleMap3D.tsx` both use the shared policy and display a compact "Viewing through <familiar>" label when the observer is delegated.
- This now has passing rendered proof. The 2026-07-02 scratch Playwright failed-first pass found `Viewing through Owl Familiar` in the DOM with no browser errors, but the 2D screenshot clipped/covered the label and the 3D screenshot did not show it. The follow-up `Z_INDEX.COMBAT_OVERLAY` fix produced passing ignored captures at `.agent/scratch/g7-fixed-2d-shared-full.png` and `.agent/scratch/g7-fixed-3d-shared-full.png`.

## 2026-06-01 familiar touch-delivery targeting foothold

- `useTargetValidator` now treats eligible touch-range spells as deliverable through the caster's on-map familiar when that familiar is within its telepathy range and adjacent to the target.
- The line-of-sight check uses the familiar as the source for this delivered case, so the targeting bridge is not just a range bypass.
- This is not full Find Familiar delivery yet. Reaction consumption, explicit delivery feedback, and rendered 2D/3D proof remain open under `SSO-FAMILIAR-TOUCH-DELIVERY-001` and `SSO-FAMILIAR-TOUCH-REACTION-001`.

## 2026-06-01 familiar touch-delivery reaction foothold

- Familiar touch delivery now requires the familiar to have a reaction available before target validation accepts the delivered touch spell.
- When the spell path uses familiar delivery, `useAbilitySystem` spends the familiar reaction at the same boundary where the caster pays the spell action/resource cost.
- This still needs focused proof and rendered 2D/3D delivery feedback before the delivery rows can close.

## 2026-06-01 familiar touch-delivery map cue

- `useAbilitySystem` now emits a short-lived `SpellDeliveryVisual` when a touch spell is delivered through the familiar.
- `BattleMapOverlay` renders the 2D cue as a cyan dotted line and `FAMILIAR TOUCH` origin label from familiar to target.
- `VFXSystem` renders the matching 3D cue as a cyan delivery line and label.
- This still needs focused proof and rendered inspection before the visual row can close.

## 2026-06-01 ability-system helper path repair

- A read-only helper-path check confirmed that `useAbilitySystem` was importing helper modules from `src/hooks/combat/abilitySystem`, but the equivalent helper files live at `src/hooks/*`.
- `useAbilitySystem` now imports the existing helper files directly, and those helper files now use corrected relative imports for their current location.
- This repair is recorded as `SSO-ABILITY-SYSTEM-HELPER-PATH-001` until a focused TypeScript/build proof is allowed.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/SUMMONING_RUNTIME_BOUNDARY.md","sha256WithoutMarker":"eb26d53de2550ca95681b929c922f6c7efc96b7351b36d67a235f49b280cd0d2","markedAtUtc":"2026-06-25T22:29:38.593Z"} -->
