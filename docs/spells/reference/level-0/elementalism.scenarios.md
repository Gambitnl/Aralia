# Elementalism Scenarios

Source references:
- `docs/spells/reference/level-0/elementalism.md`
- `public/data/spells/level-0/elementalism.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/types/spellEffectMetadata.ts`
- `src/systems/spells/targeting/TargetValidationUtils.ts`

## Spell components worth exercising

- 1 action casting time
- Verbal and somatic only
- 30-foot ranged point-or-object targeting with line of sight
- Exactly one of five on-cast elemental modes
- Player-chosen mode resolution rather than AI arbitration
- Beckon Air: breeze, dust/leaves, and open door or shutter interaction
- Beckon Earth: dust or sand coverage and one-word writing in dirt or sand
- Beckon Fire: harmless embers, colored/scented smoke, and small-flame ignition
- Beckon Water: cool mist, light dampening, or one cup of clean water with evaporation timing
- Sculpt Element: crude shaping of dirt, sand, fire, smoke, mist, or water in a 1-foot cube
- Combat and exploration utility with no concentration and no higher-level scaling

## Scenario matrix

| Scenario | Current result | Evidence |
| --- | --- | --- |
| Cast Elementalism with no supplied mode label. | PASS | The spell is a `choose_one` menu with `playerInputRequired: true`, and the runtime keeps a deterministic first-option fallback when no choice is provided. |
| Cast Elementalism as a normal one-action, nonconcentrating utility cantrip within 30 feet and line of sight. | PASS | The structured spell row records 1 action, 30-foot ranged point targeting, line of sight, instantaneous duration, and zero exploration-time cost. |
| Try to target an ally or enemy creature directly. | FAIL | The structured target list only allows `point` and `objects`, so creatures are not valid targets for this spell. |
| Try to cast beyond 30 feet or without line of sight. | BLOCKED | The data requires both constraints, but the reviewed runtime slice does not prove the exact rejection path end to end. |
| Choose Beckon Air and expect a breeze that ripples cloth, stirs dust or leaves, and closes unheld open doors or shutters. | PASS | `UtilityCommand` now records a selected Beckon Air minor utility artifact with the breeze manipulation options, including the unheld-door/shutter close option. |
| Choose Beckon Air and expect held-open doors or shutters to remain unaffected. | PASS | The Beckon Air artifact preserves the data-authored note that held-open doors and shutters are not affected, keeping the boundary visible to object-interaction surfaces. |
| Choose Beckon Earth and expect a thin shroud of dust or sand to cover a 5-foot square. | PASS | The selected Beckon Earth mode records a 5-foot-square Dust Or Sand Shroud artifact with the cover-surface manipulation option. |
| Choose Beckon Earth and expect one handwritten word to appear in dirt or sand. | PASS | The same Beckon Earth artifact preserves the `write_one_word` manipulation option for handwriting surfaces. |
| Choose Beckon Fire and expect harmless embers plus colored, scented smoke that can light candles, torches, or lamps, with scent lingering for 1 minute. | PASS | The selected Beckon Fire mode records harmless embers/smoke with color/scent options, small-flame ignition metadata, and a one-minute expiry for the scented smoke. |
| Choose Beckon Water and expect cool mist or 1 cup of clean water that evaporates in 1 minute. | PASS | The selected Beckon Water mode records a Cool Mist Or Clean Water artifact with dampening and one-cup clean-water options plus a one-minute expiry. |
| Choose Sculpt Element and expect dirt, sand, fire, smoke, mist, or water in a 1-foot cube to hold a crude shape for 1 hour. | PASS | The selected Sculpt Element mode records a one-cubic-foot Crude Elemental Shape artifact with the allowed element options and a one-hour expiry. |

## Gap mapping

- This review stays in the existing G30 structured-spell-execution family for utility mode execution. I did not add a duplicate parent gap.
