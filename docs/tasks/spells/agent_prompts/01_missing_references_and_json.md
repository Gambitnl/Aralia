# Agent Prompt 01 - Create Missing References + Finalize Spell JSON (7 spells)

Repo: `AraliaV4/Aralia`

Goal: These spells must have reference markdown and V2 spell JSON that is both glossary-visible and mechanics-usable (SSOT).

Prereq reading:
- `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`

## Spells in scope (missing reference files; non-cantrip)
- Level 1: `absorb-elements`, `catapult`, `snare`, `tashas-caustic-brew`
- Level 2: `pyrotechnics`, `skywrite`
- Level 3: `intellect-fortress`

## What already exists
- Spell JSONs exist at `public/data/spells/level-{N}/{id}.json`.
- Some JSONs may be legacy/placeholder (notably `public/data/spells/level-3/intellect-fortress.json` was legacy earlier).
- Reference files currently exist only for levels `1..9` in `docs/spells/reference/`.

## Repo standards you must follow
- Reference "variable block" is authoritative for structured mechanics; do not widen/narrow targeting based on prose when variables are explicit.
- Spell schema is enforced by `src/systems/spells/validation/spellValidator.ts`:
  - `targeting.validTargets` allowed only: `self|creatures|allies|enemies|objects|point|ground`
  - Creature-type restrictions (Humanoid/Beast/etc) must be encoded via `targeting.filter.creatureTypes`
  - `targeting.type` allowed only: `self|single|multi|area|melee|ranged|point`
  - AoE uses `targeting.areaOfEffect.shape` in `Cone|Cube|Cylinder|Line|Sphere|Square`
- Spell glossary entries are manifest-driven (no per-spell glossary entry files):
  - Manifest: `public/data/spells_manifest.json`
  - Glossary spells index: `public/data/glossary/index/spells.json` (generated)
- IDs are dash-case and must match filenames (e.g. `blindness-deafness` style).

## Definitions to apply
- "V2": spell JSON passes `SpellValidator` in `src/systems/spells/validation/spellValidator.ts`.
- "Non-legacy": `legacy` is missing/false and `tags` does not include `legacy` (see `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`).
- "Mechanics-usable": not merely schema-valid; it encodes structured `effects` sufficient for the engine (attack/save/hybrid) unless the spell is inherently utility-only.

## Inputs
- Follow the **Source Gathering Standards** in `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`.
- Use **online official sources** and extract all spell text **verbatim** into the references (paraphrasing is strictly forbidden):
  - `Description`
  - `Higher Levels` (if present)
  - `Reaction Trigger` text (if applicable)
  - any other prose sections included

## Work
### 1) Create reference files (verbatim)
Create these files using the established reference format (copy any nearby reference file as a template):
- `docs/spells/reference/level-1/absorb-elements.md`
- `docs/spells/reference/level-1/catapult.md`
- `docs/spells/reference/level-1/snare.md`
- `docs/spells/reference/level-1/tashas-caustic-brew.md`
- `docs/spells/reference/level-2/pyrotechnics.md`
- `docs/spells/reference/level-2/skywrite.md`
- `docs/spells/reference/level-3/intellect-fortress.md`

Ensure the variable block includes (as applicable):
- Casting: `Casting Time Value`, `Casting Time Unit`, `Combat Cost`, `Reaction Trigger`
- Range: `Range Type`, `Range Distance`, `Range Unit` (miles used in some spells)
- Targeting: `Targeting Type`, `Targeting Max`, `Valid Targets`, `Line of Sight`
- AoE: `Area Shape`, `Area Size`, `Area Height`
- Components: `Verbal`, `Somatic`, `Material`, `Material Description`, `Material Cost GP`, `Consumed`
- Duration: `Duration Type`, `Duration Value`, `Duration Unit`, `Concentration`
- Effect summary fields where appropriate: `Effect Type`, `Attack Roll`, `Save Stat`, `Save Outcome`, `Damage Dice`, `Damage Type`, `Secondary Damage Dice/Type`, `Conditions Applied`, `Utility Type`
- Metadata: `School`, `Ritual`, `Classes`, `Source`, `Status`

### 2) Apply reference -> JSON
Run:
- `npx --no-install tsx scripts/update-spell-json-from-references.ts --level=1`
- `npx --no-install tsx scripts/update-spell-json-from-references.ts --level=2`
- `npx --no-install tsx scripts/update-spell-json-from-references.ts --level=3`

### 3) Ensure mechanics-usable `effects`
The updater is conservative about `effects`. If any of the 7 spells end up with placeholder/insufficient effects, manually edit:
- `public/data/spells/level-1/{id}.json`
- `public/data/spells/level-2/{id}.json`
- `public/data/spells/level-3/intellect-fortress.json`

Use schema guidance from:
- `src/systems/spells/validation/spellValidator.ts`

Practical rule:
- Combat-relevant spells should not be represented only by a generic `UTILITY` placeholder. Encode their core resolution as `DAMAGE`, `STATUS_CONDITION`, `DEFENSIVE`, etc, with correct `trigger` + `condition`.

### 4) Regenerate indexes + validate
Run:
- `npx --no-install tsx scripts/regenerate-manifest.ts`
- `node scripts/generateGlossaryIndex.js`
- `npm run validate`

### 4.5) Class coverage check (recommended)
After updating the JSONs, confirm each spell has accurate `classes`:
- Non-legacy spells should generally have `classes.length > 0`.
- If the codebase has an authoritative class spell-list registry, cross-check and report mismatches for user review.

### 5) Sanity check
- Confirm each spell appears in `public/data/glossary/index/spells.json` and loads in the glossary UI.

## Deliverable
- All 7 reference files exist (with verbatim prose).
- All 7 JSONs are V2, non-legacy, mechanics-usable, and `npm run validate` is green.
- Provide a short follow-up plan (bulleted) for scaling this workflow to any other spells that lack references, including: tooling, validation checkpoints, and when to check in with the user for schema decisions.

## After completion (required)
Append to this file:
- "Completion Notes"
- "Detected TODOs (Out of Scope)"
See `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`.
