# Toll the Dead Scenarios

Source references:
- `docs/spells/reference/level-0/toll-the-dead.md`
- `public/data/spells/level-0/toll-the-dead.json`
- `src/commands/effects/DamageCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/types/spells.ts`

## Spell components worth exercising

- 1 action casting time
- Verbal and somatic only, no material component
- 60-foot range with line of sight required
- One visible creature target only
- No ally, enemy, or neutral restriction is declared
- Wisdom saving throw
- 1d8 Necrotic damage on a failed save
- No damage on a successful save
- 1d12 Necrotic damage if the target is missing any Hit Points
- Cantrip scaling at levels 5, 11, and 17 for both dice branches
- Single dolorous bell chime audible within 10 feet of the target on cast
- Combat action use is explicit; exploration casting is only described in data

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Toll the Dead on a visible ally creature within 60 feet. | PASS | `public/data/spells/level-0/toll-the-dead.json` keeps the target gate to creatures only, with no relation filter, so allies are legal if they are visible and in range. |
| Cast Toll the Dead on a visible enemy creature within 60 feet. | PASS | Same creature-only target contract as the ally case. |
| Cast Toll the Dead on a visible neutral creature within 60 feet. | PASS | No ally/enemy/neutral restriction is declared in the spell row. |
| Attempt to target an object, door, or other non-creature; the cast should be rejected. | PASS | The spell only lists `creatures` as valid targets, so the target resolver rejects object candidates. |
| Attempt to target empty ground where no creature stands; the cast should be rejected. | PASS | Single-creature targeting rejects a ground click with no creature target. |
| Attempt to target a creature more than 60 feet away; the cast should be rejected. | PASS | The range gate is 60 feet, and the reviewed target resolver rejects out-of-range targets before execution. |
| Attempt to target a creature without line of sight; the cast should be rejected. | PASS | `lineOfSight: true` is set in the spell data, so blocked sight lines fail the cast gate. |
| Let the target succeed on the Wisdom save and expect no damage. | FAIL | `DamageCommand` still treats `saveEffect: "none"` as full damage on success, so this is the same shared save-success bug tracked in G49. |
| Let the target fail the Wisdom save and expect Necrotic damage. | PASS | The damage row is a Necrotic `DAMAGE` effect, so failed saves flow through the normal damage path. |
| Let a wounded target fail the save and expect 1d12 Necrotic damage instead of 1d8. | FAIL | The JSON carries `hitPointState`, but the reviewed runtime only consumes save outcome and `damage.dice`; there is no hit-point-state execution bridge. |
| At character level 5, 11, and 17, expect the healthy-target branch to scale to 2d8, 3d8, and 4d8. | PASS | `SpellCommandFactory` applies `character_level` scaling to the damage dice, so the normal branch scales at the documented tiers. |
| At character level 5, 11, and 17, expect the wounded-target branch to scale to 2d12, 3d12, and 4d12. | FAIL | The wounded branch never reaches the runtime scaler because `hitPointState` is not consumed in the reviewed execution path. |
| Apply necrotic resistance, immunity, or vulnerability after a failed save. | PASS | `DamageCommand` routes final damage through `ResistanceCalculator.applyResistances(...)`, so necrotic mitigation or amplification still applies. |
| Hear the dolorous bell chime within 10 feet of the target on cast. | BLOCKED | The spell data includes `soundEmission`, but I found no reviewed runtime consumer that materializes the bell rider end to end. |
| Use Toll the Dead in combat as a normal action. | PASS | `combatCost.type` is `action`, and the combat ability path already consumes the spell. |
| Try to use Toll the Dead as an exploration or noncombat cast. | BLOCKED | `explorationCost` is present in the schema/data, but I found no noncombat executor in the reviewed slice. |
