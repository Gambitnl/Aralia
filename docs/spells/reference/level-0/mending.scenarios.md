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
- No first-class object durability or damage-state model was found in the inspected runtime surfaces

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Mending on a visible object within 5 feet during combat. | PASS | The target resolver accepts object targets in range with line of sight, and `spellAbilityFactory` currently collapses the minute cast into an action cost for combat-facing use. |
| Try to cast Mending on an object farther than 5 feet away. | FAIL | `TargetResolver` rejects object targets beyond the spell's 5-foot range with an `out_of_range` rejection. |
| Try to cast Mending on an object you cannot see. | FAIL | `TargetResolver` checks line of sight for object targets and returns `line_of_sight_blocked` when sight is unavailable. |
| Try to cast Mending on a creature, including a construct creature. | FAIL | The spell's valid targets are objects only, so creature targets are rejected before any repair logic would matter. |
| Target a worn or carried magical object, such as a held key or worn cloak. | PASS | The reviewed target data leaves worn/carried and magical status as not applicable, so no extra boundary is encoded for selection. |
| Use two lodestones as the material component and expect them to be required but not consumed. | PASS | The JSON records `material: true`, `materialDescription: two lodestones`, and `isConsumed: false`. |
| Try to cast Mending without the lodestones and expect a component-enforcement gate. | BLOCKED | The inspected runtime surfaces did not show a material-component enforcement path for this spell. |
| Repair a broken key, torn cloak, or leaking wineskin and expect the object to become whole with no visible trace of damage. | FAIL | `UtilityCommand` has no repair branch, and the reviewed runtime path does not mutate any object repair state. |
| Repair a break or tear larger than 1 foot and expect the cast to be rejected. | FAIL | The data stores a 1-foot repair limit, but no runtime consumer was found that enforces the size gate. |
| Repair a damaged magic item and expect the physical damage to be fixed while the magic remains unchanged. | FAIL | The reference text and JSON preserve the "cannot restore magic" limitation, but the current runtime still lacks the repair executor needed to perform the physical fix. |
| Expect Mending to restore magic to a magic item. | PASS | The spell explicitly says it can repair a magic item but cannot restore magic, and the JSON encodes that limitation as `restoresMagicToMagicItem: false`. |
| Cast Mending outside combat and expect the spell to run as a one-minute exploration cast. | BLOCKED | The reviewed code shows a combat-facing action fallback, but no exploration-time cast scheduler or `explorationCost` consumer was found. |
| Inspect the target object after a successful repair and expect a tracked durability or broken-state field to update. | BLOCKED | No first-class object durability or damage-state model was found in the inspected runtime surfaces. |

