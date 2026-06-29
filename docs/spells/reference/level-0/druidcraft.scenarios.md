# Druidcraft Scenarios

Source references:
- `docs/spells/reference/level-0/druidcraft.md`
- `public/data/spells/level-0/druidcraft.json`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/UtilityCommand.ts`
- `src/types/spells.ts`

## Spell components worth exercising

- 1 action casting time
- Verbal and somatic only
- 30-foot ranged point/object targeting with line of sight
- Exactly one of four on-cast modes
- Weather Sensor: a Tiny harmless omen that predicts local weather for the next 24 hours and lasts 1 round
- Bloom: a flower, seed pod, or leaf bud changes state immediately
- Sensory Effect: a harmless effect that fits in a 5-foot cube and may be visual, auditory, or olfactory
- Fire Play: light or snuff a candle, torch, or campfire
- Utility-only cantrip with no concentration or higher-level scaling
- Deterministic player choice, not AI arbitration
- Exploration-friendly use case as well as combat-side cast timing

## Scenario matrix

| Scenario | Current result | Evidence |
| --- | --- | --- |
| Cast Druidcraft and choose one of the four listed modes before the spell resolves. | PASS | The row is `modeChoice: choose_one`, `aiContext.playerInputRequired` is true, and `SpellCommandFactory` plus `UtilityCommand` both resolve the selected menu entry from the declared control options. |
| Cast Druidcraft with no supplied mode choice. | PASS | The factory still has a fallback path for unfinished casts, but the spell data clearly marks the choice as player-provided rather than AI-arbitrated. |
| Try to target an ally or enemy creature. | FAIL | The targeting block only lists `point` and `objects` as valid targets; creatures are not valid targets for this spell. |
| Try to use the spell beyond 30 feet or without line of sight. | BLOCKED | The spell data requires 30-foot range and line of sight, but the reviewed runtime slice does not prove the exact point/object targeting rejection path end to end. |
| Use Druidcraft in exploration as a quick, non-concentration utility cast. | PASS | The spell is instantaneous, has no concentration, and carries zero exploration-time cost in the JSON row. |
| Choose Weather Sensor and expect a visible omen that also records the local weather prediction for the next 24 hours. | FAIL | `UtilityCommand` only has generic logging for unmatched utility modes here; there is no Druidcraft-specific weather branch consuming the row's weather-sensor metadata. |
| Choose Bloom and expect a flower, seed pod, or leaf bud to change state. | FAIL | The spell data carries Bloom as a control option, but the runtime path does not create a plant-state effect for it. |
| Choose Sensory Effect and expect a harmless 5-foot cube of leaves, fairies, breeze, animal sound, or odor. | FAIL | The reviewed runtime does not emit a sensory-cube effect; it falls back to generic control-option logging instead. |
| Choose Fire Play and expect a candle, torch, or campfire to light or snuff. | FAIL | The spell row declares Fire Play, but the utility runtime has no fire-toggle branch for this option, so the effect does not execute as described. |
| Try Fire Play on a held or worn torch and expect a separate ownership gate. | BLOCKED | The spell text does not add an ownership gate, and the reviewed runtime slice does not show a Druidcraft-specific held/worn object check to confirm or reject the case safely. |

