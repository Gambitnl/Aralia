# Primal Savagery Scenarios

Source references:
- `docs/spells/reference/level-0/primal-savagery.md`
- `public/data/spells/level-0/primal-savagery.json`

## Spell components worth exercising

- 1 action, somatic only, no verbal or material component
- Self range with a single creature target within 5 feet
- Line of sight required
- Melee spell attack with a hit-conditioned acid damage row
- 1d10 Acid damage, scaling to 2d10 / 3d10 / 4d10 at levels 5 / 11 / 17
- Teeth or fingernails sharpen for the attack, then return to normal

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Primal Savagery and expect the caster's teeth or fingernails to sharpen briefly, then return to normal after the attack resolves. | PASS | The spell-attack bridge emits transient Primal Savagery sharpen metadata before the attack and a matching inactive/revert log after resolution without leaving a persistent status on the caster. Focused proof: `npx vitest run src/commands/factory/__tests__/SpellCommandFactorySpellAttack.test.ts -t "Primal Savagery bridge"`. |
| Select one visible creature within 5 feet and resolve the spell against it. | PASS | `targeting.type` is `single`, `range` is `5`, `validTargets` is `creatures`, and `TargetResolver` accepts a creature in range with line of sight. |
| Attempt to target a creature 10 feet away; the cast should be rejected. | PASS | `TargetResolver` rejects creature targets beyond `targeting.range` with an `out_of_range` rejection. |
| Try to target an object, crate, door, or ground tile instead of a creature. | PASS | The spell does not allow object targets (`validTargets` is `creatures` only), and the creature-target resolver has no point-target branch for this spell. |
| Target an ally, enemy, or neutral creature that is still within 5 feet and visible. | PASS | No ally/enemy/self filter is set, so any creature in range that passes line of sight is eligible. |
| Resolve the hit branch on a valid creature in reach. | PASS | Primal Savagery now enters the spell-attack path as a melee spell attack; a hit applies the structured Acid damage row and records the expected attack metadata. Focused proof: `npx vitest run src/commands/factory/__tests__/SpellCommandFactorySpellAttack.test.ts -t "Primal Savagery bridge"`. |
| Resolve the miss branch on the same attack. | PASS | The spell-attack bridge now preserves a real miss path for Primal Savagery: a miss records the attack result, skips Acid damage, and still emits the transient revert log. Focused proof: `npx vitest run src/commands/factory/__tests__/SpellCommandFactorySpellAttack.test.ts -t "Primal Savagery bridge"`. |
| Apply Acid damage to a target with resistance, immunity, or vulnerability. | PASS | `DamageCommand` routes damage through `ResistanceCalculator`, so acid mitigation and amplification are part of the current damage path. |
| Cast the spell at character levels 5, 11, and 17. | PASS | The bridge records scaled Primal Savagery damage dice at 2d10 / 3d10 / 4d10 for character levels 5 / 11 / 17. Focused proof: `npx vitest run src/commands/factory/__tests__/SpellCommandFactorySpellAttack.test.ts -t "Primal Savagery bridge"`. |
| Cast the spell during combat, including a normal action-cost turn. | PASS | The spell is action-speed combat magic and the reviewed action executor handles spell casting inside the combat turn flow. |
| Cast the spell in a noncombat or exploration-only state with no combat turn queue. | BLOCKED | The reviewed slice is combat-engine driven and does not prove a dedicated noncombat execution path for this cantrip, even though the spell's exploration cost is 0 minute. |
