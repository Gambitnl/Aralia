# Agent Prompt 04 - Targeting Type Standards vs Non-Standard Reference Values + Attack/Save Mechanics Compatibility

Repo: `AraliaV4/Aralia`

Goal: Normalize reference `Targeting Type` and ensure it aligns with what the engine actually consumes for mechanics (attacks vs saves vs always).

Prereq reading:
- `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`

## V2 schema constraints (must comply)
From `src/systems/spells/validation/spellValidator.ts`:
- `targeting.type` must be one of: `self | single | multi | area | melee | ranged | point`
- `targeting.validTargets` must be one of: `self|creatures|allies|enemies|objects|point|ground`

Interpretation:
- `Targeting Type` (in references) should describe *how targets are selected* (single/multi/area/etc).
- "creature/object" belongs in `Valid Targets`, plus `targeting.filter` when restricting creature types.

## Creature type validation requirement
The codebase already defines canonical creature types in:
- `src/types/creatures.ts` (`CreatureType` enum)

When a spell uses `targeting.filter.creatureTypes`, the values should be validated against a canonical registry.
If the spell needs non-core subtype tags (e.g. "Goblinoid"), the registry should be extended (or a separate subtype registry should be introduced), and the validation rules should be updated accordingly.

Deliverable expectation:
- Identify the canonical registry file(s) and enforce validation (in schema or in data validation scripts).
- If a required creature type does not exist in the registry, add it (or define the subtype strategy) rather than leaving unvalidated free-text.

## Non-standard reference `Targeting Type` values currently present
These appear in `docs/spells/reference/**/*.md`:
- `creature` (37 spells)
- `object` (2 spells)
- `creature or object` (1 spell)
- `creature_or_object` (1 spell)
- `creatures` (1 spell)
- `N/A` (1 spell)

### Spells using them
- `creature` (37):
  - `danse-macabre`, `dominate-person`, `dream`, `enervation`, `geas`, `greater-restoration`, `hold-monster`, `immolation`, `modify-memory`, `negative-energy-flood`, `planar-binding`, `raise-dead`, `rarys-telepathic-bond`, `reincarnate`, `scrying`, `chain-lightning`, `disintegrate`, `flesh-to-stone`, `harm`, `heal`, `mental-prison`, `ottos-irresistible-dance`, `soul-cage`, `clone`, `dominate-monster`, `feeblemind`, `maze`, `mind-blank`, `power-word-stun`, `reality-break`, `telepathy`, `foresight`, `imprisonment`, `power-word-heal`, `power-word-kill`, `time-ravage`, `true-resurrection`
- `object`:
  - `holy-weapon`, `passwall`
- `creature or object`:
  - `true-polymorph`
- `creature_or_object`:
  - `awaken`
- `creatures`:
  - `animal-shapes`
- `N/A`:
  - `blade-of-disaster`

## Task
### 1) Define the canonical standards
Find where mechanics consume targeting and effects:
- Search usage of `spell.targeting.type`, `spell.targeting.validTargets`, `spell.targeting.filter`
- Search how attack vs save is represented:
  - `effects[].condition.type` (`hit|save|always`)
  - `effects[].condition.saveType` and `saveEffect`
  - `effects[].trigger` and `attackFilter`

Likely files to inspect:
- `src/hooks/combat/useTargeting.ts`
- `src/utils/spellAbilityFactory.ts`
- `src/systems/spells/effects/triggerHandler.ts`
- `src/systems/spells/validation/spellValidator.ts`

### 2) Create a mapping table for reference -> V2
For each non-standard `Targeting Type` value:
- Define the correct V2 `targeting.type`
- Define what belongs in `validTargets` and `filter`
Examples:
- `Targeting Type: creature` -> usually `targeting.type: single` (unless it clearly targets multiple)
- `Targeting Type: object` -> `targeting.type: single` and `validTargets: ["objects"]`
- `creature or object` -> `targeting.type: single` and `validTargets: ["creatures","objects"]`
- `N/A` -> determine intent (often area/point-based or special); document and fix per spell

### 3) Fix the source of truth
Pick one strategy (or both):
- Update the reference markdown files to use only standard `Targeting Type` values
- Update `scripts/update-spell-json-from-references.ts` to translate non-standard values safely and log warnings (so refs can later be cleaned)

### 4) Mechanics audit for attacks vs saves
Document what fields the mechanics require for:
- spell attack rolls (melee/ranged spell attack)
- saving throws (including half damage, negate condition)
- hybrid spells (attack + secondary AoE save)

### 5) Apply changes and verify
Update at least 5 spells from the list above to match standards and ensure:
- spell JSON remains schema-valid
- mechanics still behave as intended

## Commands
- `npx --no-install tsx scripts/update-spell-json-from-references.ts --level={N}` (if editing references)
- `npm run validate` (must pass at end)

## Deliverable
- Standards documented + mappings implemented.
- References normalized (or robustly auto-mapped).
- Mechanics compatibility for attack/save confirmed.
- A follow-up plan for rolling the normalization across all spells (not just 5), including how to batch changes safely and when to request user decisions.
