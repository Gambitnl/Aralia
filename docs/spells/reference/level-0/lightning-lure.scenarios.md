# Lightning Lure Scenarios

Source references:
- `docs/spells/reference/level-0/lightning-lure.md`
- `public/data/spells/level-0/lightning-lure.json`

## Spell components worth exercising

- 1 action, verbal only
- Self range with a 15-foot targeting band
- One creature of your choice that you can see
- Enemy-only creature targeting
- Line of sight required
- Strength save
- Pull up to 10 feet in a straight line toward the caster
- Stop early on walls, blocked tiles, occupied spaces, or the caster's own space
- Lightning damage that should only apply if the target ends within 5 feet of the caster
- 1d8 lightning damage with cantrip scaling at levels 5, 11, and 17
- Map-backed and mapless combat should both be considered

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Lightning Lure on a visible enemy creature within 15 feet, with line of sight and clear space between the caster and target. | PASS | The spell row and JSON both describe a self-range cantrip with a 15-foot ranged target band, visible creature targeting, and enemy-only creature filters. `TargetResolver` enforces the range and sight gates before command execution. |
| Try to cast Lightning Lure on an ally creature within 15 feet. | FAIL | The structured target filter allows `creatures` and `enemies`, so an ally does not match the target rules. |
| Try to cast Lightning Lure on a noncreature object. | FAIL | The spell only allows creature targets; the creature-target resolver does not open an object branch for this row. |
| Try to cast Lightning Lure on a creature farther than 15 feet away. | FAIL | `TargetResolver` rejects creature targets beyond the spell's 15-foot range. |
| Try to cast Lightning Lure when line of sight is blocked, or in a mapless combat state where the spell cannot prove sight. | FAIL | The targeting row requires line of sight, and the resolver fails closed without battle-map sight evidence. |
| Resolve the Strength save, fail it, and pull the target up to 10 feet toward the caster on an open map. | PASS | `LightningLureBridgeCommand` rolls the Strength save before movement and only executes the pull branch on a failed save. Focused proof: `npx vitest run src/commands/factory/__tests__/LightningLureBridge.test.ts`. |
| Resolve the Strength save, succeed on it, and expect no pull or damage. | PASS | The bridge exits after a successful Strength save, leaving the target unmoved and skipping the damage branch. Focused proof: `npx vitest run src/commands/factory/__tests__/LightningLureBridge.test.ts`. |
| Pull the target through a path with a wall, blocked tile, or occupied space in the way. | PASS | `MovementCommand.applyPull` validates each step and stops when the path is blocked or occupied. |
| Pull the target toward the caster when the caster's tile would be the next landing space. | PASS | `MovementCommand.applyPull` breaks before moving onto the caster's space. |
| Pull the target so it ends more than 5 feet away from the caster after a legal path. | PASS | The bridge checks the moved target's post-pull distance from the caster and skips lightning damage when the target remains outside the 5-foot gate. Focused proof: `npx vitest run src/commands/factory/__tests__/LightningLureBridge.test.ts`. |
| Pull the target so it ends within 5 feet of the caster after a legal path. | PASS | The bridge applies lightning damage only after a failed save, legal pull resolution, and a final position within 5 feet of the caster. Focused proof: `npx vitest run src/commands/factory/__tests__/LightningLureBridge.test.ts`. |
| Cast Lightning Lure at caster levels 5, 11, and 17. | PASS | The spell JSON carries character-level scaling, and `SpellCommandFactory` applies the tiered damage-dice upgrade path for cantrips. |
| Try to rely on mapless combat for the pull behavior alone. | PASS | `MovementCommand.applyPull` can still resolve straight-line movement without map bounds, stopping only on occupied-space or collision checks that are available in state. |
