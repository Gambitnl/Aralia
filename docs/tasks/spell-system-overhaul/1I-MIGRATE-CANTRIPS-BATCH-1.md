# Path 2.F: Migrate Cantrips Batch 1 (5 spells)

## MISSION
Convert the first batch of 5 high-priority cantrips from Old Format to New Format, adhering to the "Iron Rules" acceptance criteria.

**Spells in this batch:**
- `acid-splash`
- `blade-ward`
- `booming-blade`
- `chill-touch`
- `create-bonfire`

## DELIVERABLE
A Pull Request with 5 new JSON files, 5 new glossary files, an updated manifest, and this file marked with completion for each spell.

## RESULTS
- [x] `acid-splash`
- [x] `blade-ward`
- [x] `booming-blade`
- [x] `chill-touch`
- [x] `create-bonfire`

## System Gaps & Follow-up
- [ ] **`booming-blade`**: The trigger for the secondary damage is "if the target willingly moves".
    - *Context*: The current schema's `trigger.type` does not support conditional triggers based on character actions like movement.
    - *Recommendation*: Add a `custom` trigger type or a more robust conditional trigger system to the schema. For now, the mechanic is noted in the effect's `description`.
- [ ] **`create-bonfire`**: Damage should trigger "when a creature moves into the bonfire's space for the first time on a turn".
    - *Context*: The current schema's `trigger.type` does not support triggers based on entering an area.
    - *Recommendation*: Add an `on_enter_area` trigger type to the schema. For now, the mechanic is noted in the effect's `description`.
- [ ] **`chill-touch`**: The disadvantage effect on Undead is conditional.
    - *Context*: The current schema does not support targeting conditions based on creature type (e.g., Undead).
    - *Recommendation*: Add a `targetType` condition to the `condition` object in the effect schema. For now, the condition is noted in the effect's `description`.
