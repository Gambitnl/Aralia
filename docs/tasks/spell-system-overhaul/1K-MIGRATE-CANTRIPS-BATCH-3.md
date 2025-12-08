# 1K - Migrate Cantrips (Batch 3)

**Scope**: Convert five cantrips to the new JSON format (create if missing), validate, and record integration results in this task file (do not touch shared status files).

## Spells in this batch (5)
- light (missing locally — create new JSON)
- mind-sliver (missing locally — create new JSON)
- mold-earth (missing locally — create new JSON)
- primal-savagery (missing locally — create new JSON)
- sapping-sting (missing locally — create new JSON)

## Required Reading (read in order)
1. `docs/tasks/spell-system-overhaul/@WORKFLOW-SPELL-CONVERSION.md`
2. `docs/spells/SPELL_JSON_EXAMPLES.md`
3. `docs/tasks/spell-system-overhaul/SALVAGED_SPELL_CONTEXT.md`
4. `docs/tasks/spell-system-overhaul/SPELL-WORKFLOW-QUICK-REF.md`
5. `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`

## Execution Steps
1. For each spell:
   - Apply the conversion workflow; place JSON in `public/data/spells/level-0/{id}.json`.
   - Create/update glossary entry `public/data/glossary/entries/spells/{id}.md`.
   - Run `npm run validate` (or `npm run validate:spells`) and fix errors.
   - Run `SPELL_INTEGRATION_CHECKLIST.md` for this spell and note results below.
2. **Do NOT edit shared status files** (`STATUS_LEVEL_0.md`, manifests, or shared checklists). Record completion here.

## Per-Spell Checklist (fill here, not elsewhere)
- light: Data ✅ / Validation ✅ / Integration ✅ (notes: All checks pass.)
- mind-sliver: Data ✅ / Validation ✅ / Integration ✅ (notes: All checks pass.)
- mold-earth: Data ✅ / Validation ✅ / Integration ✅ (notes: All checks pass.)
- primal-savagery: Data ✅ / Validation ✅ / Integration ✅ (notes: All checks pass.)
- sapping-sting: Data ✅ / Validation ✅ / Integration ✅ (notes: All checks pass.)

---

## System Gaps & Follow-up

- [ ] **Light**: The `UTILITY` effect is purely descriptive and does not model the light source's radius or the conditional saving throw for hostile creatures.
    - *Context*: The current schema cannot represent a light source's properties (bright/dim radius) or a conditional save based on the target.
    - *Recommendation*: Create a new `LightEffect` type with fields for `brightRadius`, `dimRadius`, and `isColorable`. Add support for conditional effects to the `BaseEffect` trigger/condition system.

- [ ] **Mind Sliver**: The debuff mechanic is described in a string, making it impossible for the game engine to parse and apply the modifier.
    - *Context*: There is no support for applying temporary, roll-specific modifiers.
    - *Recommendation*: Create a new `TEMPORARY_MODIFIER` effect type with fields like `modifierDice`, `targetRoll`, and a structured `duration`.

- [ ] **Mold Earth**: The spell's three distinct choices are modeled as three separate, generic `UTILITY` effects, which the engine cannot interpret as a choice.
    - *Context*: The system lacks a way to present a player with a choice between different effects within a single spell.
    - *Recommendation*: Implement a `CHOICE` or `MODAL` effect structure that can contain an array of other effects, from which the caster can choose one.

- [ ] **Sapping Sting**: The damage and "Prone" condition are modeled as two separate effects, which implies two separate saving throws.
    - *Context*: The current `condition` object does not support multiple effects resulting from a single failed save.
    - *Recommendation*: Enhance the `condition` object to support an `onFailure` array, allowing multiple effects to be explicitly linked to a single failed saving throw.
