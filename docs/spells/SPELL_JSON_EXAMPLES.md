# Spell JSON Examples

Last Updated: 2026-04-09

This file is a current orientation guide to real spell JSON examples in the repo. It no longer claims to be the canonical schema reference. The live spell model now spans the shared runtime types, the validator, the scaffold that creates new spells, and the engine that interprets structured scaling. The most trustworthy examples are still the spell files that already live under ../../public/data/spells/.

## What Changed In This Refresh

Older versions of this document bundled a large set of hand-written example payloads and described them as complete reference templates. That was no longer safe to keep as-is because the validator and the live spell files have continued to evolve.

This file now does three things instead:
- points to real spell JSON files that exist in the repo today
- summarizes what each example is useful for
- reminds the reader to validate against the current validator rather than copying an old doc block blindly

## Current Template Surfaces

Use these in this order:
1. ../../src/types/spells.ts
   - shared runtime spell template and the broadest statement of what the JSON is meant to house
2. ../../src/systems/spells/validation/spellValidator.ts
   - the machine gate that decides whether a spell file is acceptable right now
3. ../../scripts/add_spell.js
   - the starter scaffold for new spell files, manifest wiring, and glossary visibility
4. ../../src/systems/spells/mechanics/ScalingEngine.ts
   - the runtime interpreter for structured higher-level scaling
5. real spell JSON files under ../../public/data/spells/level-N/
   - the best concrete examples of what the repo is actually carrying today
6. ../../public/data/spells_manifest.json and ../../scripts/check-spell-integrity.ts
   - use these when placement, manifest wiring, or glossary discoverability changed

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
- ../../public/data/spells/level-1/alarm.json
  - ritual-capable utility spell
  - useful for seeing that ritual stays separate from castingTime in runtime JSON
- ../../public/data/spells/level-9/prismatic-wall.json
  - geometry-heavy spell
  - useful for point anchoring, alternate shape handling, and richer area/range structure

## Current Reading Rules

When you inspect a spell example, check these things against the validator rather than against an older doc snippet:
- root spell metadata and class list format
- castingTime, including combatCost and explorationCost where applicable
- range and targeting, including explicit units and point-anchored placement when the spell creates a placed zone
- effects, including trigger, condition, and description
- effect-type-specific payloads such as damage, healing, defensive, summoning, terrain, utility, or status-condition records
- higherLevels plus higherLevelScaling when the spell improves with slot level or character level

## Current Geometry And Scaling Habits

These are the newer patterns that the live template and scaffold now expect authors to understand:
- `range.distanceUnit` should be explicit instead of assuming every number means feet
- `targeting.type: "point"` is the intended anchor for placed walls, globes, and zones
- `targeting.areaOfEffect` can carry richer geometry, including `sizeType`, `shapeVariant`, height, and width-related facts
- `targeting.spatialDetails` exists for spells whose geometry cannot be described cleanly by one flat range/area pair
- `higherLevels` is still the readable prose surface
- `higherLevelScaling` is the structured runtime surface for cantrip tiers, slot-level bonuses, breakpoint tables, and other modeled scaling rules

Important caveat:
- migrated data sometimes still contains intentionally plain or empty-string descriptions inside effect records
- for new work, prefer meaningful effect descriptions where possible, but validate against the actual schema instead of assuming every example is prose-rich

## Current Schema Habits Worth Preserving

These patterns continue to matter in the live repo:
- validTargets is plural
- spell schools, damage types, and class names use the repo's current casing conventions
- effect types and nested mechanic fields should follow the validator, not older free-form prose
- level folders matter; the manifest path should agree with the spell level
- the scaffold in ../../scripts/add_spell.js is a better new-file starting point than copying an older spell by hand
- the spell-integrity script is part of the maintenance flow when manifest or class-list wiring changes

## What This File Is Not

This file is not:
- a promise that every example here covers every edge-case mechanic
- a substitute for reading the current validator
- a complete historical dump of every migration-era example payload

If you need exact shape rules, read the validator first. If you need a concrete payload, open one of the real spell JSON files listed above.

## Validation Commands

- npm run validate:spells
- npm run validate:spell-markdown
- npm run validate
- npx tsx scripts/check-spell-integrity.ts
- npm run typecheck
- npm run build
