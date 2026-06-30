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
| Choose Weather Sensor and expect a visible omen that also records the local weather prediction for the next 24 hours. | PASS | `UtilityCommand` now records a selected `activeMinorUtilityEffects` artifact for Weather Sensor with a one-round expiry, sensory-effect object data, and weather-prediction metadata. |
| Choose Bloom and expect a flower, seed pod, or leaf bud to change state. | PASS | The selected Bloom mode now creates a plant-effect utility artifact against the selected object or point, preserving the blossom/seed-pod/leaf-bud manipulation options. |
| Choose Sensory Effect and expect a harmless 5-foot cube of leaves, fairies, breeze, animal sound, or odor. | PASS | The selected Sensory Effect mode now records the 5-foot Cube sensory-effect artifact and its data-authored manipulation options. |
| Choose Fire Play and expect a candle, torch, or campfire to light or snuff. | PASS | The selected Fire Play mode now records a target-object fire-state-change artifact with the light/snuff manipulation options for candles, torches, and campfires. |
| Try Fire Play on a held or worn torch and expect a separate ownership gate. | BLOCKED | The spell text does not add an ownership gate, and the reviewed runtime slice does not show a Druidcraft-specific held/worn object check to confirm or reject the case safely. |
