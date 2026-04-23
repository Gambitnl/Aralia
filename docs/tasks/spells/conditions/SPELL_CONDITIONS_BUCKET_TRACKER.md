# Spell Conditions Bucket Tracker

Last Updated: 2026-04-14

## Bucket Purpose

This tracker exists for the `Conditions` bucket inside the spell-truth lane.

The bucket has to cover two separate comparison phases:

- canonical -> structured
- structured -> json

That split matters because the structured markdown block is the interpreted layer,
while the runtime spell JSON is what the game actually uses. A spell is not fully
understood just because a condition word appears somewhere in the prose.

This bucket is also wider than a single effect label. It has to separate:

- real status conditions
- custom condition-like labels
- markdown rows that mention conditions but do not correspond to runtime status
  condition effects

## Current Status

- Standard condition vocabulary in code:
  - `16` named conditions in `F:\Repos\Aralia\src\types\conditions.ts`
  - `12` of those are currently used by the live spell corpus
- Runtime spell JSON:
  - `47` spells currently contain at least one `STATUS_CONDITION` effect
  - `56` total status-condition effects across those spells
- Structured markdown:
  - `51` spell reference files currently contain a `Conditions Applied` row
- Current overlap:
  - `41` spells have both a markdown `Conditions Applied` row and a runtime
    `STATUS_CONDITION` effect
- Current split residue:
  - `6` runtime condition spells still do not have a markdown `Conditions Applied`
    row
  - `10` markdown `Conditions Applied` rows do not correspond to a runtime
    `STATUS_CONDITION` effect
- Gate checker status:
  - the glossary spell gate checker now has a dedicated `Conditions Runtime Review`
    block
  - this bucket is now a live runtime review surface, not just an inventory lane
  - the structured-vs-JSON audit now compares `Conditions Applied` explicitly
- Template policy:
  - `Conditions Applied` is now treated as a required structured markdown field
  - the runtime JSON already carries enough signal to support that requirement,
    so the remaining work is to normalize how the row is written, not whether it
    should exist at all

## Condition Vocabulary

### Standard Condition Names In Code

The codebase currently defines these standard conditions:

- Blinded
- Charmed
- Deafened
- Exhaustion
- Frightened
- Grappled
- Incapacitated
- Invisible
- Paralyzed
- Petrified
- Poisoned
- Prone
- Restrained
- Stunned
- Unconscious
- Ignited

### Standard Names Actually Used By Spells

The current spell corpus uses these standard names in runtime status-condition
effects:

- Blinded
- Charmed
- Frightened
- Grappled
- Ignited
- Incapacitated
- Invisible
- Paralyzed
- Poisoned
- Prone
- Restrained
- Unconscious

### Custom Condition Labels In Current Spells

The current spell corpus also uses these custom or descriptive labels:

- Bane
- Banished
- Blessed
- Confused
- Disadvantage on attacks vs. caster
- Muddled Thoughts
- No Healing
- Prone, Incapacitated
- Reactions Suppressed

Frostbitten has been moved out of this bucket. Frostbite is now tracked as an
attack-roll rider because it changes the target's next attack instead of giving
it a true condition.

## Key Mismatch Families

### Runtime Status Condition Missing Markdown Row

Meaning:
- the runtime JSON already applies a status condition, but the structured markdown
  file does not have a matching `Conditions Applied` row

Current examples:
- `chill-touch`
- `friends`
- `frostbite`
- `searing-smite`
- `shocking-grasp`
- `snare`

### Markdown `Conditions Applied` Row Without Runtime Status Condition

Meaning:
- the structured markdown has a `Conditions Applied` row, but the runtime JSON does
  not have a `STATUS_CONDITION` effect for that spell

Current examples:
- `calm-emotions`
- `compelled-duel`
- `crown-of-madness`
- `enthrall`
- `faerie-fire`
- `gust-of-wind`
- `invisibility`
- `pyrotechnics`
- `silence`
- `suggestion`

### Custom Condition Labels

Meaning:
- the runtime JSON applies something condition-like, but the label is not one of
  the standard 5e condition names

Current examples:
- `Bane`
- `Banished`
- `Blessed`
- `Confused`
- `Disadvantage on attacks vs. caster`
- `Muddled Thoughts`
- `No Healing`
- `Prone, Incapacitated`
- `Reactions Suppressed`

## Per-Phase Plan

### Phase 1: Inventory And Label

Goal:
- keep the bucket honest about which spells actually apply status conditions and
  which ones only mention condition-like language

Actions:
- maintain the current inventory by condition name
- split runtime effects into:
  - standard condition names
  - custom condition labels
- keep markdown `Conditions Applied` rows separate from runtime condition effects

### Phase 2: Decide Template Meaning

Goal:
- define the required `Conditions Applied` row so it can be compared reliably

Actions:
- decide whether the row should list raw labels, normalized condition names, or both
- decide how custom mechanic labels should be separated from standard condition names
- keep condition-like wording in prose separate from actual condition state

### Phase 3: Normalize Runtime Shape

Goal:
- make the runtime JSON condition surface easier to compare and gate

Actions:
- review custom labels one by one
- decide which ones should become first-class condition names
- decide which ones should stay descriptive mechanics labels

### Phase 4: Gate Checker Follow-Through

Goal:
- add a dedicated conditions review block once the field shape is stable

Actions:
- add a bucket-specific review block for structured -> json
- add a canonical -> structured view only if the canonical side has a stable
  comparison shape
- keep the bucket separate from the general `Effect Type` and `Save Outcome`
  mismatch families

## Progress Log

- 2026-04-14
  - created the first dedicated `Conditions` bucket tracker
  - inventoried the live corpus condition surface:
    - `47` runtime status-condition spells
    - `56` condition effects
    - `51` markdown `Conditions Applied` rows
    - `41` overlaps
    - `6` runtime-only condition spells missing the markdown row
    - `10` markdown-only rows without a runtime status-condition effect
  - identified the live custom condition labels:
    - `Bane`
    - `Banished`
    - `Blessed`
    - `Confused`
    - `Disadvantage on attacks vs. caster`
    - `Muddled Thoughts`
    - `No Healing`
    - `Prone, Incapacitated`
    - `Reactions Suppressed`
  - wired the glossary spell gate checker with a dedicated `Conditions Runtime
    Review` block so the selected spell can now show the structured row and the
    live runtime JSON side by side
  - marked `Conditions Applied` as a required structured markdown field in the
    current spell-truth plan

## Open Questions / Model Gaps

- `Conditions Applied` is required in the structured markdown plan; remaining
  decisions are about normalization:
  - raw labels, normalized names, or both?
  - how should custom mechanic labels be split from standard condition names?
- Should runtime JSON keep custom labels like `Reactions Suppressed` and `No Healing`,
  or should those be normalized into standard condition names or separate effect
  types?
- Should the bucket treat condition-like rows with `None` as explicit negative
  information, or as a missing condition summary?
- Should the future gate checker compare condition state at the spell level, the
  effect level, or both?
