# Chill Touch Scenarios

Chill Touch is a level-0 Necromancy cantrip with these core modeled facts:

- Cast as an action with verbal and somatic components only.
- Uses a melee spell attack against a creature target within 5 feet.
- Requires line of sight and is creature-only; objects are not valid targets in the current data model.
- On a hit, it deals 1d10 Necrotic damage.
- On a hit, it applies a no-healing rider and has an Undead-only rider that applies disadvantage against the caster.
- Its damage scales at character levels 5, 11, and 17 through the row's structured cantrip scaling data.

Current evidence used for these scenarios:

- [Chill Touch reference](./chill-touch.md)
- [`public/data/spells/level-0/chill-touch.json`](../../../../public/data/spells/level-0/chill-touch.json)
- [`src/commands/factory/SpellCommandFactory.ts`](../../../../src/commands/factory/SpellCommandFactory.ts)
- [`src/commands/effects/StatusConditionCommand.ts`](../../../../src/commands/effects/StatusConditionCommand.ts)
- [`src/systems/spells/targeting/TargetValidationUtils.ts`](../../../../src/systems/spells/targeting/TargetValidationUtils.ts)

| Scenario | Current result | Evidence |
|---|---|---|
| Cast Chill Touch at a visible creature within 5 feet and the melee spell attack hits. | PASS | The spell is modeled as a melee spell attack, the target list is creature-only, and the factory routes hit-gated damage and status rows through the command system. |
| Cast Chill Touch at a creature ally within 5 feet and the melee spell attack hits. | PASS | The spell does not carry a hostile-only, willing-only, or self-only restriction; current data accepts any creature target. |
| Try to cast Chill Touch on an object or other non-creature token. | PASS | `validTargets` is `creatures`, and the current combat targeting path only builds creature refs for spell commands. |
| Try to cast Chill Touch on a creature that is out of reach, fully hidden, or behind total cover. | BLOCKED | The row requires melee reach and line of sight, but the reviewed runtime files do not prove the exact reach/cover rejection path end to end. |
| On a hit, Chill Touch deals its base damage payload. | PASS | The effect row is structured as 1d10 Necrotic damage and the command factory supports damage effects for hit-gated rows. |
| On a hit, the target cannot regain Hit Points until the start of the caster's next turn. | PASS | Focused G27 proof verifies Chill Touch's hit-gated status row preserves `hitPointState.mode: healing_lockout`, blocks HP restoration through the shared healing helper while active, and allows healing again once the rider is gone. |
| On a hit against an Undead creature, the target gains the disadvantage rider against the caster only. | PASS | Focused G61 proof verifies the Undead-only hit row creates an outgoing attack-disadvantage active effect scoped to the caster who landed Chill Touch, while non-Undead targets do not receive that rider. |
| At character levels 5, 11, and 17, the damage should scale to 2d10, 3d10, and 4d10. | FAIL | The row stores cantrip scaling in `customFormula`, but the reviewed runtime scaling path consumes `scalingTiers` or `bonusPerLevel` and does not parse `customFormula`. This is the same G26-family scaling gap, so it is not re-registered here. |
