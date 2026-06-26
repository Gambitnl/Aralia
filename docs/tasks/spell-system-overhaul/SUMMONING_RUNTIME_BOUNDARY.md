# Summoning Runtime Boundary

Status: active boundary note, created 2026-06-01 for `SSO-SUMMONING-RUNTIME-PARITY-001`.

This note prevents future agents from treating every summon-related file as the authoritative runtime. Aralia currently has two summon-shaped paths, but only one is production-fed by spell casting.

## Current authority

| Surface | Current role | Evidence status |
| --- | --- | --- |
| `SummoningCommand` | Active command-runtime path for spell-created summons. | Spell command factory routes `SUMMONING` effects into command execution. |
| `DamageCommand` | Command-runtime cleanup path for summons that reach 0 HP. | Removes `isSummon` actors from combat state when damage drops them to 0 HP. |
| `CombatCharacter.summonMetadata` | Shared metadata envelope for command-created summons and hook-created helper summons. | Stores caster, spell, entity type, form name, source name, duration, and dismissability. |
| `useSummons` | Parallel UI/helper hook, not authoritative production summon runtime. | Imported in `CombatView`, but combat spell casting is not currently fed through this hook. |
| `CombatView` useSummons wiring | Placeholder/helper integration. | Does not make `useSummons` the production summon owner. |

## Contract for future changes

1. Do not route new production summon behavior through `useSummons` unless the ownership decision is made explicitly.
2. For active combat casting, treat `SummoningCommand` and command results as the current source of truth.
3. Keep `useSummons` metadata aligned while it exists, because tests or helper UI may still inspect it.
4. If `useSummons` is retained, document what it owns: helper state, preview state, side-panel state, or production summon state.
5. If `useSummons` is retired, remove or archive its placeholder wiring only after confirming no tests or UI surfaces rely on it.
6. Visual proof for summons should use command-created summons unless a later slice wires `useSummons` into production casting.

## What is already implemented

- Command-created summons are tagged with `isSummon`.
- Command-created summons store `summonMetadata.casterId` and `spellId`.
- Command-created summons now store `entityType`, `formName`, and `sourceName`.
- `useSummons` helper-created summons now store the same identity fields.
- Recasting a familiar through `SummoningCommand` removes the existing familiar from the same caster/spell before creating the replacement.
- Damage that drops an `isSummon` actor to 0 HP removes it from combat state and logs disappearance.

## What remains open

| Open work | Owning row |
| --- | --- |
| Decide whether `useSummons` should be retired, helper-only, or wired into command execution. | `SSO-SUMMONING-RUNTIME-PARITY-001` |
| Add player/AI summon form, CR, and count choice. | `SSO-SUMMONING-FORM-SELECTION-001` |
| Enforce summon initiative, command cost, control, obedience, hostility, and AI policy. | `SSO-SUMMONING-COMMAND-ECONOMY-001` |
| Define 2D/3D map categories for creature summons, mounts, invisible servants, disks, objects, and guardian-style constructs. | `SSO-SUMMONING-MAP-VISUALS-001` |
| Finish Find Familiar dismissal, pocket dimension, shared senses, touch spell delivery, and familiar AI/map behavior. | `SSO-LEVEL1-FAMILIAR-RUNTIME-001` |
| Capture rendered proof that summon tokens/actors appear, identify their type/form/source, and disappear cleanly. | `SSO-COMBAT-MAP-PRESENTATION-MATRIX-001` |

## Proof required before closing runtime parity

Runtime parity is not closed by comments or metadata alone. Closing it requires evidence that one authoritative path owns summon creation, updates, duration, cleanup, callbacks, concentration cleanup, form choice, command economy, and visual state.

Acceptable closure paths:

1. `SummoningCommand` remains authoritative, and `useSummons` is formally retired or documented as helper-only with tests adjusted to that contract.
2. `useSummons` becomes the production summon manager, and command execution delegates creation/update/removal into it or a shared service.
3. Both paths delegate to a shared summon service, and tests prove they produce the same state shape and cleanup behavior.

Until one of those paths is implemented and proved, keep `SSO-SUMMONING-RUNTIME-PARITY-001` open.

## 2026-06-01 familiar dismissal split

- `SSO-FAMILIAR-DISMISS-POCKET-001` now owns explicit familiar dismissal, temporary pocket-dimension state, and reappearance behavior.
- This remains separate from generic summon 0-HP cleanup: dismissal should preserve the familiar bond for later return, while 0-HP cleanup removes the map actor after defeat.

## 2026-06-01 familiar pocket-state foothold

- `CombatState.pocketedSummons` and `FamiliarPocketCommands.ts` now provide the runtime state transition for dismissing and recalling a familiar.
- This does not make the feature player-facing yet. Future work still needs action/UI wiring, recall placement validation, and rendered map proof.

## 2026-06-01 familiar pocket ability-factory foothold

- `AbilityCommandFactory` can now route `familiar_pocket` ability effects into `DismissFamiliarToPocketCommand` or `RecallFamiliarFromPocketCommand`.
- This keeps the future familiar action path command-owned. It does not yet create the player-facing abilities or prove state propagation.

## 2026-06-01 familiar pocket propagation foothold

- `useAbilitySystem` can now propagate familiar pocket command results through full roster replacement and `pocketedSummons` publication.
- `CombatView` currently owns the pocketed-summon list. This is a practical handoff, not a final combat-state architecture decision.

## 2026-06-01 familiar pocket caster actions

- `SummoningCommand` now adds `Dismiss Familiar` and `Recall Familiar` abilities to the caster after creating a familiar.
- These abilities use the command-owned `familiar_pocket` path; future work still needs proof, turn-order policy, placement validation, and rendered UI review.

## 2026-06-01 familiar shared-senses and touch-delivery split

- `SSO-FAMILIAR-SHARED-SENSES-001` now owns shared-senses and telepathy behavior.
- `SSO-FAMILIAR-TOUCH-DELIVERY-001` now owns routing eligible touch spells through the familiar.
- Both are separate from pocket dismissal/recall, which now has runtime/action/UI-path footholds but still lacks proof.

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
- This is still not rendered proof. Future work must run focused checks and inspect both map modes before closing `SSO-FAMILIAR-SHARED-SENSES-OBSERVER-001`.

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
