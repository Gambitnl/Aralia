# Guidance Scenarios

Source references:
- `docs/spells/reference/level-0/guidance.md`
- `public/data/spells/level-0/guidance.json`
- `src/types/spellCheckMetadata.ts`
- `src/types/spells.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/systems/spells/targeting/TargetResolver.ts`

## Spell components worth exercising

- 1 action casting time
- Touch range with a 5-foot targeting window
- Line of sight required
- Verbal and somatic only
- No material component and no consumable item payload
- Targets creatures and allies, not objects
- The target must be a willing creature in the spell text
- Duration is 1 minute and requires concentration
- The spell creates a 1d4 ability-check modifier for one skill chosen by the caster
- The bonus should apply while the spell is active and should not touch saves or attack rolls
- The spell does not carry higher-level scaling

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Guidance on a visible allied creature within 5 feet. | PASS | `TargetResolver` accepts allied creature targets, the row is touch range with a 5-foot target window, and `lineOfSight: true` is enforced. |
| Cast Guidance on the caster themself. | PASS | The row has no `self` restriction, and the target filter accepts allied creatures; self is treated as the caster's own ally. |
| Cast Guidance on an allied creature that is not willing. | PASS | The spell now marks `willing: required`, and `TargetValidationUtils` rejects targets that are explicitly flagged unwilling while preserving unknown-consent ally flows. |
| Cast Guidance on a hostile enemy creature. | PASS | Negative cast attempt: the row targets `allies` and `creatures`; `TargetResolver` rejects non-allies for this targeting contract. |
| Cast Guidance on an object, crate, or door. | PASS | Negative cast attempt: `validTargets` does not include objects, and `TargetResolver` returns `objects_not_allowed` when object targeting is disallowed. |
| Cast Guidance from more than 5 feet away or without line of sight. | PASS | Negative cast attempt: the row is touch range with a 5-foot targeting window and `lineOfSight: true`, so out-of-range or hidden targets are rejected. |
| Cast Guidance again while already concentrating on another concentration spell. | PASS | `SpellCommandFactory` inserts `BreakConcentrationCommand` before `StartConcentrationCommand`, so a new concentration spell replaces the old one instead of stacking. |
| Make the chosen-skill ability check during exploration. | PASS | The cast stores a Guidance status on the touched creature, and `rollAbilityCheck` now reads the chosen skill's 1d4 rider while the spell is active. |
| Make the chosen-skill ability check during combat. | PASS | The same Guidance status feeds the combat check utility, so the chosen skill's 1d4 applies when the actual combat check resolves. |
| Make an attack roll or saving throw while Guidance is active. | PASS | The modifier is scoped to `appliesTo: ability_check`, and the spell has no save or attack-rider payloads. |
| Cast Guidance with no material component or one-use item to spend. | PASS | `components.material` is false, `isConsumed` is false, and there is no limited-use or consumable payload on the spell. |
