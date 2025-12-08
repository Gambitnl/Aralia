# @WORKFLOW-SPELL-CONVERSION

Single-source workflow for converting legacy spell data into the current JSON format.

**Scope**: Applies to all spell migrations (cantrips and leveled).  
**Sources**: `docs/spells/SPELL_JSON_EXAMPLES.md`, `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`, `src/types/spells.ts`.

---

## Required Inputs
- Spell source text (card/SRD) with casting time, range, components, duration, effects, upcast rules.
- Class access list (base class + subclasses).
- Legacy data (if converting existing file).

### Cantrip/Level-0 Guardrails (must satisfy before editing)
- Path: `public/data/spells/level-0/{id}.json` only; remove/replace any flat `public/data/spells/{id}.json` after field comparison.
- Required fields: `ritual: false`, `castingTime.combatCost.type` present, `trigger` + `condition` on every effect, plural `validTargets`, Title Case damage types/schools/classes.
- Use current schema primitives where appropriate: `trigger.type` supports `on_attack_hit`; effects may use `controlOptions`, `taunt`, `forcedMovement`, AoE `Square/height`, `saveModifiers`, `requiresStatus`, `escapeCheck`, `familiarContract`, `dispersedByStrongWind`.
- Run the Field Comparison Check against any legacy file first (ritual, combatCost, tags, arbitrationType, strict enums/casing).

---

## Canonical Targets (New Format)
- File location: `public/data/spells/level-{0-9}/{spell-id}.json` (cantrips → `level-0`).
- ID/file name: kebab-case (e.g., `fire-bolt.json`, `absorb-elements.json`).
- Enums/casing: lower_snake for time units (`action`, `bonus_action`, `reaction`), Title case for schools/damage types/classes (`Evocation`, `Fire`, `Wizard`), ALLCAPS for effect types (`DAMAGE`, `DEFENSIVE`, etc.).

---

## Field Mapping (Legacy → New)
- `damage` → `effects[].damage.dice`
- `damageType` → `effects[].damage.type`
- `areaOfEffect` → `targeting.areaOfEffect` (primary AoE). Use `effects[].areaOfEffect` only for secondary explosions (e.g., Ice Knife).
- `saveType` → `effects[].condition.saveType`
- `description` → `description`
- Add required fields that legacy lacked: `classes`, `school`, `components`, `duration`, `targeting.validTargets`, `effects[].subtype`, and BaseEffect fields (`trigger`, `condition`, optional `scaling`).

---

## Class Normalization
- Use base classes and allowed subclasses only (see SALVAGED_SPELL_CONTEXT). Format: `BASE CLASS - SUBCLASS` for subclass entries.
- Filter out legacy tags like `"BARD (LEGACY)"`.

---

## Conversion Steps
1) **Read Examples**: Open `docs/spells/SPELL_JSON_EXAMPLES.md`; pick the closest pattern (damage, save AoE, defensive reaction, healing, control, utility).
2) **Create Target File**: Place in `public/data/spells/level-{N}/{spell-id}.json` (level 0 → `level-0`).
3) **Populate Core Fields**: `id`, `name`, `level`, `school`, `classes`, `tags`, `ritual?`.
4) **Casting/Range/Components/Duration**: Ensure units and casing match enums; include `reactionCondition` for reactions; mark `concentration`.
5) **Targeting**:
   - Single: `type: "single"`, `range`, `validTargets`, optional `lineOfSight`.
   - Area: `type: "area"`, `range`, `areaOfEffect { shape, size }`, `validTargets`.
   - Multi: `type: "multi"`, `range`, `maxTargets`, `validTargets`.
   - Self: `type: "self"`.
6) **Effects (BaseEffect REQUIRED)**:
   - `trigger`: `immediate | after_primary | turn_start | turn_end | on_enter_area | on_exit_area | on_end_turn_in_area | on_target_move | on_target_attack | on_target_cast | on_caster_action | on_attack_hit`
     - Use `on_enter_area` for spells that trigger when creatures enter (e.g., Create Bonfire on move-in)
     - Use `on_end_turn_in_area` for end-of-turn zone effects (e.g., Create Bonfire lingering damage)
     - Use `on_exit_area` when leaving the zone triggers an effect (e.g., Grease/slow zones that punish leaving)
     - Use `on_target_move` for spells that trigger on target movement (e.g., Booming Blade)
   - `trigger.frequency` (optional): `every_time | first_per_turn | once | once_per_creature`
   - `trigger.consumption` (optional): `unlimited | first_hit | per_turn` (for riders)
   - `trigger.attackFilter` (optional): filter by `weaponType` ("melee"/"ranged")
   - `condition`: `hit | save | always` (+ `saveType`, `saveEffect` when save)
   - `condition.targetFilter` (optional): Filter effects by creature properties
     - `{ "creatureType": ["Undead"] }` for effects that only apply to certain types
   - `scaling`: optional (`slot_level` or `character_level`; include `bonusPerLevel` or custom formula)
   - Then add effect-specific fields (damage/healing/defensive/status_condition/etc.).
7) **Upcasting/Scaling**:
   - Cantrips: `character_level` scaling, include customFormula (e.g., 1/5/11/17 progression).
   - Leveled: `slot_level` scaling and `higherLevels` text where applicable.
8) **Glossary Entry**: Create/update `public/data/glossary/entries/spells/{spell-id}.md`; include frontmatter with `seeAlso` auto-links if your workflow supports it.
9) **Status File**: Mark progress in `docs/spells/STATUS_LEVEL_0.md` or `STATUS_LEVEL_1.md` (`[D] Data Only`).
10) **Integration Verification**: After migration, run `docs/spells/SPELL_INTEGRATION_CHECKLIST.md` for the spell and mark completion in the status file (e.g., add an “Integration” checkbox/column when updating status).

---

## Validation & Checks
- Run `npm run validate` to ensure schema compliance.
- Verify:
  - All effects include `trigger` and `condition`.
  - Enum casing matches (`action`, `Evocation`, `Fire`, `DAMAGE`).
  - AoE resides under `targeting.areaOfEffect` (primary), not a top-level field.
  - `classes` normalized; no legacy tags.
  - Touch spells: `range.type: "touch"` and `targeting.range: 5`.
  - Reactions: include `reactionCondition`; `castingTime.unit: "reaction"`.
  - Material components with cost: `materialCost` and `isConsumed` set appropriately.

---

## Common Patterns (Use from Examples)
- Direct attack: `type: "single"`, `condition: { type: "hit" }`, `DAMAGE`.
- Save-based AoE: `type: "area"`, `condition: { type: "save", saveType, saveEffect }`, `DAMAGE`.
- Defensive reaction (Shield/Absorb Elements): `castingTime.unit: "reaction"`, `DEFENSIVE` (+ secondary `DAMAGE` for Absorb Elements).
- Healing touch: `range.type: "touch"`, `targeting.range: 5`, `HEALING`.
- Control: `STATUS_CONDITION` with duration and save.

---

## Deliverable Definition
- Validated spell JSON in correct `level-{N}` folder.
- Glossary entry created/updated.
- Status file updated.
- Validation script passes.
