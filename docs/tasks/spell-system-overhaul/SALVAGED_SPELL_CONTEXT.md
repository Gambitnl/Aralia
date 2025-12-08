# SALVAGED_SPELL_CONTEXT

Notes rescued from legacy spell documentation while archiving old-format guides.

---

## Sources
- `docs/guides/SPELL_DATA_CREATION_GUIDE.md` (legacy spell JSON guide)

---

## Class/Subclass Normalization (from SPELL_DATA_CREATION_GUIDE.md)
- **Current standard**: Use Title Case display names (e.g., `Wizard`, `Paladin - Oath of Vengeance`). Convert any legacy ALLCAPS data to this format during migration.
- Legacy guide expected UPPERCASE with the format `BASE CLASS - SUBCLASS` (e.g., `CLERIC - WAR DOMAIN`); keep this note only for interpreting old files.
- Explicit rule to **filter out legacy tags** such as `"BARD (LEGACY)"` and to exclude subclasses not on the official list.
- Official subclass list was enumerated for all casting classes (Artificer/Barbarian/Bard/Cleric/Druid/Fighter/Monk/Paladin/Ranger/Rogue/Sorcerer/Warlock/Wizard) to ensure only supported subclasses appeared in `classes[]`.

## Glossary Linking Behavior (from SPELL_DATA_CREATION_GUIDE.md)
- `seeAlso` in glossary frontmatter was meant to be auto-populated by the AI based on spell description/mechanics to build cross-links between spells and related terms.

## Legacy Spell JSON Structure Highlights (from SPELL_DATA_CREATION_GUIDE.md)
- Top-level fields included `effects[]` entries with generic `type`/`attack`/`saveRequired`/`damage`/`areaOfEffect`/`special`, plus an `engineHook` block for implementation notes (`isImplemented`, `notes`).
- Casting/range/components/duration used capitalized enum strings (`"Bonus Action"`, `"Feet"`, `"Minute"`), differing from the current lowercase enums.
- Example JSON placed `effects` as loosely typed payloads (e.g., `{ "type": "Buff", ... }`), not the current discriminated union with `BaseEffect` and `EffectCondition`.

## Legacy → New Field Mapping (from SPELL-WORKFLOW-QUICK-REF.md)
- Old fields commonly seen:
  - `damage` → `effects[0].damage.dice`
  - `damageType` → `effects[0].damage.type`
  - `areaOfEffect` → `targeting.areaOfEffect`
  - `saveType` → `effects[0].condition.saveType`
  - `description` → `description`
- Required additions when converting old payloads:
  - Add `classes`, `school`, `components`, `duration`, `targeting.validTargets`, `effects[].subtype`, and `BaseEffect` fields (`trigger`, `condition`, optional `scaling`).

### Migration Reminders (apply when using legacy context)
- Do **not** leave or create flat `public/data/spells/{id}.json`; migrate to `public/data/spells/level-{N}/{id}.json` (cantrips → `level-0`) after field comparison.
- Normalize enums and add required fields: `ritual`, `castingTime.combatCost.type`, `trigger` + `condition` on every effect, plural `validTargets`, Title Case damage types/schools/classes.
- Use current schema primitives where applicable: `on_attack_hit`, `controlOptions`, `taunt`, `forcedMovement`, AoE `Square/height`, `saveModifiers`, `requiresStatus`, `escapeCheck`, `familiarContract`, `dispersedByStrongWind`.

## Legacy AoE Placement (from SPELL_PROPERTIES_REFERENCE.md)
- Legacy spells sometimes used a top-level `areaOfEffect` or `effects[].areaOfEffect` instead of the canonical `targeting.areaOfEffect`.
- Current standard: `targeting.areaOfEffect` for primary AoE; `effects[].areaOfEffect` only for secondary AoE (e.g., Ice Knife secondary explosion).
