# Message Scenarios

Source references:
- `docs/spells/reference/level-0/message.md`
- `public/data/spells/level-0/message.json`

## Spell components worth exercising

- 1 action, somatic and material only
- Range 120 feet
- Single creature target, maximum 1 target
- No line-of-sight gate in the current targeting data
- Whispered message to only the target
- Target can reply in a whisper only the caster can hear
- Can pass through solid objects only when the caster is familiar with the target and knows it is beyond the barrier
- Blocked by magical silence, 1 foot of stone, metal, or wood, or a thin sheet of lead
- Communication utility with no concentration and no verbal component
- No shared-language prerequisite is modeled in the structured data

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Message on an allied creature within 120 feet during combat. | PASS | The spell is a single-creature, 120-foot utility cast, and the current targeting data allows any creature target without an ally-only restriction. |
| Cast Message on a hostile creature within 120 feet. | PASS | `validTargets: creatures` and the absence of an enemy/ally filter mean hostile creatures are legal targets as long as they are in range. |
| Cast Message on a neutral NPC or other non-hostile creature during exploration or social play. | PASS | The spell is modeled as communication utility, not a combat-only effect, and nothing in the current data restricts the target to allies. |
| Try to cast Message on an object or an empty tile. | FAIL | The spell row allows creatures only, and the current target resolver only validates creature targets for this spell. |
| Try to cast Message on a creature 121 feet away. | FAIL | `TargetResolver` rejects targets beyond the spell's 120-foot range with an out-of-range failure. |
| Try to cast Message on a creature behind a wall without the familiar-target/beyond-barrier condition. | FAIL | The reference text says solid-object casting is conditional, but the reviewed runtime path has no familiarity or barrier branch to enforce that rule. |
| Try to cast Message through a wall while being familiar with the target and knowing the target is beyond the barrier. | FAIL | The spell data records the exception, but the reviewed runtime path does not consume it, so the special-through-barrier case is not actually executed. |
| Expect only the target to hear the message. | FAIL | `UtilityCommand` currently logs a generic communication action and does not show any private audio-delivery or recipient-isolation behavior. |
| Expect the target to reply in a whisper that only the caster can hear. | FAIL | The spell JSON carries reply metadata, but no runtime reply-routing or caster-only receipt path was found in the reviewed code. |
| Cast Message while magical silence, 1 foot of stone, 1 foot of metal, 1 foot of wood, or a thin sheet of lead is between caster and target. | FAIL | The blocker list exists in the spell data, but no inspected runtime path enforces those blockers during cast or delivery. |
| Use Message for stealth or conversation coordination in a fight or during exploration. | PASS | The spell costs 1 action, has no concentration, and has no verbal component, so the current data supports it as a lightweight communication utility cast. |
| Require shared language or AI/social arbitration before Message can target a creature. | PASS | The structured targeting data marks communication prerequisites as `not_applicable`, and no shared-language or AI-arbitration gate appears in the reviewed runtime path. |
| Expect the runtime to track or translate the actual whispered words for a non-shared-language exchange. | BLOCKED | The reviewed code only shows generic communication logging; no inspected runtime system proves content-level whisper capture, translation, or social arbitration. |

