# Mending Scenarios

Source references:
- `docs/spells/reference/level-0/mending.md`
- `public/data/spells/level-0/mending.json`

## Spell components worth exercising

- 1 minute casting time with a combat action fallback in the current combat-facing preview
- Touch range with a 5-foot targeting band
- Single object target only
- No explicit worn/carried, magical, fixed-to-surface, or size eligibility gates in the target data
- Verbal, somatic, and material components
- Two lodestones are listed as the material component and are not consumed
- Repairs one break or tear no larger than 1 foot in any dimension
- Leaves no trace of the former damage
- Can physically repair a magic item, but cannot restore its magic
- No first-class object HP pool exists yet, so the runtime records repair outcomes in `spellObjectRepairs` and carries optional `damageState` metadata on selected object refs

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Mending on a visible object within 5 feet during combat. | PASS | The target resolver accepts object targets in range with line of sight, `spellAbilityFactory` still collapses the minute cast into an action cost for combat-facing use, and `UtilityCommand` now records a structured repair outcome. |
| Try to cast Mending on an object farther than 5 feet away. | FAIL | `TargetResolver` rejects object targets beyond the spell's 5-foot range with an `out_of_range` rejection. |
| Try to cast Mending on an object you cannot see. | FAIL | `TargetResolver` checks line of sight for object targets and returns `line_of_sight_blocked` when sight is unavailable. |
| Try to cast Mending on a creature, including a construct creature. | FAIL | The spell's valid targets are objects only, so creature targets are rejected before any repair logic would matter. |
| Target a worn or carried magical object, such as a held key or worn cloak. | PASS | The reviewed target data leaves worn/carried and magical status as not applicable, so no extra boundary is encoded for selection. |
| Use two lodestones as the material component and expect them to be required but not consumed. | PASS | The JSON records `material: true`, `materialDescription: two lodestones`, and `isConsumed: false`. |
| Try to cast Mending without the lodestones and expect a component-enforcement gate. | BLOCKED | The inspected runtime surfaces did not show a material-component enforcement path for this spell. |
| Repair a broken key, torn cloak, or leaking wineskin and expect the object to become whole with no visible trace of damage. | PASS | The repair bridge now records a structured `spellObjectRepairs` entry with the selected object's metadata, the repair limit, and the success outcome. |
| Try to repair an intact object with no recorded break or tear and expect a no-op or rejection. | PASS | `UtilityCommand` records `rejectedRepairState: 'no_damage'` when the selected object lacks repair metadata. |
| Repair a break or tear larger than 1 foot and expect the cast to be rejected. | PASS | `UtilityCommand` now records `rejectedRepairState: 'too_large'` when the selected object's break exceeds the 1-foot limit. |
| Repair a damaged magic item and expect the physical damage to be fixed while the magic remains unchanged. | PASS | The repair bridge preserves magical-item metadata and records that the spell can physically repair the item without restoring magic. |
| Expect Mending to restore magic to a magic item. | PASS | The spell explicitly says it can repair a magic item but cannot restore magic, and the JSON encodes that limitation as `restoresMagicToMagicItem: false`. |
| Cast Mending outside combat and expect the spell to run as a one-minute exploration cast. | BLOCKED | The reviewed code shows a combat-facing action fallback, but no exploration-time cast scheduler or `explorationCost` consumer was found. |
| Inspect the repair record after a successful cast and expect the target object metadata to be preserved. | PASS | The runtime still lacks a mutable object durability pool, but the repair bridge preserves the target object id, name, position, damage metadata, and spell-side repair contract in `spellObjectRepairs`. |
