# Mage Hand Scenarios

Source references:
- `docs/spells/reference/level-0/mage-hand.md`
- `public/data/spells/level-0/mage-hand.json`

## Spell components worth exercising

- 1 action, verbal and somatic only
- 30-foot ranged area cast with line of sight
- Choose a point rather than a creature
- A 5-foot cube at the chosen point
- A spectral hand that should appear and persist for 1 minute
- No concentration
- Later-turn Magic action control
- The hand can move up to 30 feet as part of that control
- The hand vanishes if it is more than 30 feet from the caster or if the caster casts Mage Hand again
- Allowed interactions: manipulate object, open unlocked door or container, stow/retrieve items from an open container, pour vial contents
- Restrictions: cannot attack, activate magic items, or carry more than 10 pounds
- Relevant in both combat and exploration play

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Mage Hand on an empty point within 30 feet, with line of sight, and expect the target click to resolve as a point. | PASS | `useTargetValidator` accepts area casts at a ground point when range and line of sight are valid, and `buildSelectedSpellTargetsForPosition` returns a point target for empty tiles. |
| Try to cast Mage Hand on a point farther than 30 feet away. | FAIL | `useTargetValidator` rejects the cast as out of range before execution. |
| Try to cast Mage Hand where line of sight is blocked. | FAIL | `useTargetValidator` runs the shared `hasLineOfSight` check for spell casts and rejects blocked sight lines. |
| Cast Mage Hand and expect a spectral hand instance to be created at the chosen point. | FAIL | `SpellCommandFactory` routes utility spells to `UtilityCommand`, but `UtilityCommand` has no Mage Hand or `controlledEntity` execution branch; the cast only logs a generic utility message. This maps to the existing controlled-entity family in G16 rather than a new family. |
| On a later turn, spend a Magic action to control the hand and move it up to 30 feet. | FAIL | The structured spell data records later-turn Magic-action control and a 30-foot move budget, but the reviewed runtime path does not consume that controlled-entity payload. |
| Keep the hand active for 1 minute and expect it to expire naturally after that duration. | FAIL | The 1-minute duration is present in the spell data, but no live hand state or expiry bridge was found in the runtime. |
| Recast Mage Hand while a prior hand is active and expect the old hand to vanish. | FAIL | The recast-ending rule is present in data, but the reviewed command path does not create a persistent hand to clean up. |
| Use Mage Hand to manipulate an object, open an unlocked door or container, stow or retrieve an item, or pour a vial. | FAIL | The allowed-interactions list is structured in the spell row, but the runtime never instantiates a hand object that could perform those actions. |
| Try to make the hand attack or activate a magic item. | BLOCKED | The spell data forbids both actions, but the repo evidence does not show an executable hand instance that can be tested against those restrictions. |
| Try to lift or carry more than 10 pounds with the hand. | FAIL | The carry-capacity limit exists in data, but there is no runtime bridge enforcing it. |
| Click an occupied square and expect the hand's placement to resolve collision or occupied-space behavior. | BLOCKED | The point-selection helper can classify occupied tiles, but the repo does not show a first-class Mage Hand placement object or collision model to validate against. |
| Use Mage Hand outside combat and expect the same helper to persist as an exploration tool. | BLOCKED | The inspected evidence covers combat targeting and utility command routing; a separate exploration execution path for controlled utility helpers was not found. |

