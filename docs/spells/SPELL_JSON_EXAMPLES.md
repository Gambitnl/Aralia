# Spell JSON Examples

Last Updated: 2026-03-12

This file is a current orientation guide to real spell JSON examples in the repo. It no longer claims to be the canonical schema reference. The source of truth for the spell shape is ../../src/systems/spells/validation/spellValidator.ts, and the most trustworthy examples are the spell files that already live under ../../public/data/spells/.

## What Changed In This Refresh

Older versions of this document bundled a large set of hand-written example payloads and described them as complete reference templates. That was no longer safe to keep as-is because the validator and the live spell files have continued to evolve.

This file now does three things instead:
- points to real spell JSON files that exist in the repo today
- summarizes what each example is useful for
- reminds the reader to validate against the current validator rather than copying an old doc block blindly

## Current Source Of Truth

Use these in this order:
1. ../../src/systems/spells/validation/spellValidator.ts
2. ../../public/data/spells_manifest.json
3. real spell JSON files under ../../public/data/spells/level-N/
4. ../../scripts/check-spell-integrity.ts when placement or manifest wiring changed

## Verified Real Example Files

These files were re-checked during the 2026-03-12 pass and are good starting points when reading the current spell shape:
- ../../public/data/spells/level-0/fire-bolt.json
  - simple damage cantrip
  - useful for character-level scaling and straightforward DAMAGE effects
- ../../public/data/spells/level-1/shield.json
  - defensive reaction spell
  - useful for reaction casting time and defensive effect structure
- ../../public/data/spells/level-1/absorb-elements.json
  - multi-effect reaction spell
  - useful for reading chained or mixed effect intent
- ../../public/data/spells/level-1/magic-missile.json
  - multi-target damage spell
  - useful for seeing current targeting and scaling choices
- ../../public/data/spells/level-1/find-familiar.json
  - summoning spell
  - useful for long casting time, material-cost fields, and summoning structure
- ../../public/data/spells/level-0/light.json
  - structured utility effect that carries light metadata
  - useful for the modern light-source lane
- ../../public/data/spells/level-0/mind-sliver.json
  - damage plus save-penalty rider
  - useful for modern save-rider data
- ../../public/data/spells/level-0/mold-earth.json
  - terrain manipulation spell
  - useful for modern terrain manipulation structure

## Current Reading Rules

When you inspect a spell example, check these things against the validator rather than against an older doc snippet:
- root spell metadata and class list format
- castingTime, including combatCost and explorationCost where applicable
- range and targeting
- effects, including trigger, condition, and description
- effect-type-specific payloads such as damage, healing, defensive, summoning, terrain, utility, or status-condition records

Important caveat:
- migrated data sometimes still contains intentionally plain or empty-string descriptions inside effect records
- for new work, prefer meaningful effect descriptions where possible, but validate against the actual schema instead of assuming every example is prose-rich

## Current Schema Habits Worth Preserving

These patterns continue to matter in the live repo:
- validTargets is plural
- spell schools, damage types, and class names use the repo's current casing conventions
- effect types and nested mechanic fields should follow the validator, not older free-form prose
- level folders matter; the manifest path should agree with the spell level
- the spell-integrity script is part of the maintenance flow when manifest or class-list wiring changes

## What This File Is Not

This file is not:
- a promise that every example here covers every edge-case mechanic
- a substitute for reading the current validator
- a complete historical dump of every migration-era example payload

If you need exact shape rules, read the validator first. If you need a concrete payload, open one of the real spell JSON files listed above.

## Validation Commands

- npm run validate
- npx tsx scripts/check-spell-integrity.ts
- npm run typecheck
- npm run build

That command list replaces older doc wording that referenced validate:spells or other narrower spell-only package scripts that are not present in the current repo.
