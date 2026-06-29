# Blade Ward Scenarios

Source references:
- `docs/spells/reference/level-0/blade-ward.md`
- `public/data/spells/level-0/blade-ward.json`
- `src/commands/effects/AttackRollModifierCommand.ts`
- `src/commands/effects/ConcentrationCommands.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`

## Spell components worth exercising

- 1 action casting time with no reaction timing path
- Verbal and somatic only, with no material component
- Self range and self-only target selection
- Line of sight is not required by the row
- 1 minute duration with concentration
- Incoming attack-roll modifier only
- Applies a 1d4 penalty to any incoming attack roll while active
- No damage, resistance, save, or higher-level scaling row

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Blade Ward on yourself as an action before hostile creatures act. | PASS | The structured row is self-only, uses a 1-action casting time, and the runtime command factory maps `ATTACK_ROLL_MODIFIER` into `AttackRollModifierCommand` for the caster/target pair. |
| Try to use Blade Ward as a reaction to being attacked. | FAIL | The row is `Casting Time Unit: action` and `Combat Cost: action`, not reaction. |
| While Blade Ward is active, an enemy makes a melee weapon attack roll against the protected caster. | PASS | The effect is `Attack Roll Direction: incoming`, `Attack Roll Kind: any`, and the command stores the rider as a live incoming attack modifier. |
| While Blade Ward is active, an enemy makes a spell attack roll against the protected caster. | PASS | The modifier is not limited to weapon attacks; the structured row says `Attack Roll Kind: any`, so spell attacks are covered too. |
| While Blade Ward is active, the caster makes an outgoing attack roll against an enemy. | FAIL | The row only applies to incoming attack rolls against the caster, so the caster's own attacks are not the affected side of the rule. |
| A landed hit that still gets through Blade Ward should also have damage reduced by the spell. | FAIL | Blade Ward has no defensive resistance or damage-reduction payload in the structured row; the mechanical contract is attack-roll penalty only. |
| Try to cast Blade Ward on an ally, enemy, or object instead of the caster. | FAIL | The row lists `validTargets: self`, `Range Type: self`, and `Targeting Max: 1`, so non-self targets are outside the current contract. |
| Break concentration after casting Blade Ward, then resolve another incoming attack roll. | PASS | `SpellCommandFactory` starts concentration for the spell and `BreakConcentrationCommand` removes riders by spell id, so the incoming penalty is cleared when concentration ends. |
| Cast Blade Ward during exploration, then enter combat before the minute is up. | BLOCKED | The row clearly persists for 1 minute with concentration, but the reviewed runtime slice does not prove the exploration-to-combat handoff or timeout boundary in a way that is safe to claim here. |
