# Spell System Contributor Onboarding Guide

Last Updated: 2026-03-11
Purpose: Orient contributors to the current spell-data workflow, the live verification surface, and the docs that still matter during the first-wave doc pass.

## What This Guide Is

Use this file as a current-state starting point for spell work in the repo.

It is not:
- a promise that every spell surface is fully modernized
- a substitute for the level-specific status docs
- the only spell workflow reference

This guide is intentionally narrower than older versions. It focuses on the repo as it exists now.

## Verified Current Spell Surfaces

The spell system currently spans these verified anchors:
- spell JSON lives under public/data/spells/level-0 through public/data/spells/level-9
- the generated index lives at public/data/spells_manifest.json
- schema validation is anchored in src/systems/spells/validation/spellValidator.ts
- spell JSON maintenance scripts currently include:
  - scripts/validateSpellJsons.ts
  - scripts/check-spell-integrity.ts
  - scripts/regenerate-manifest.ts
  - scripts/generate-spell-manifest.mjs
- reference docs still actively used in this area include:
  - docs/spells/SPELL_JSON_EXAMPLES.md
  - docs/spells/SPELL_INTEGRATION_CHECKLIST.md
  - docs/SPELL_INTEGRATION_STATUS.md
  - the level-specific status docs under docs/spells/

## Current Command Surface

The repo does not currently expose the package command npm run validate:spells.

The verified package-level commands relevant to spell contributors are:
- npm run validate
- npm run typecheck
- npm run build
- npm test

Spell-specific scripts that can be run directly are:
- npx tsx scripts/validateSpellJsons.ts
- npx tsx scripts/check-spell-integrity.ts
- npx tsx scripts/regenerate-manifest.ts

Use npm run validate as the general repo validation entry point, then use the spell-specific scripts when you need focused feedback.

## First Read Order

Before editing spell data, read these in order:
1. docs/guides/SPELL_ADDITION_WORKFLOW_GUIDE.md
2. docs/guides/SPELL_DATA_CREATION_GUIDE.md
3. docs/guides/SPELL_IMPLEMENTATION_CHECKLIST.md
4. docs/spells/SPELL_JSON_EXAMPLES.md
5. docs/spells/SPELL_INTEGRATION_CHECKLIST.md

Then check:
- docs/SPELL_INTEGRATION_STATUS.md
- the relevant docs/spells/STATUS_LEVEL_{N}.md file

## Practical Starting Workflow

1. Pick the spell and confirm its current status in the relevant level-status doc.
2. Read one similar spell JSON from the same level band under public/data/spells/level-{N}/.
3. Use docs/spells/SPELL_JSON_EXAMPLES.md as structure guidance, not as a guarantee that every example is the latest runtime pattern.
4. Create or update the spell JSON.
5. Regenerate the manifest if file paths or spell inventory changed.
6. Run spell-specific checks plus the broader repo checks.
7. Test the integration points you actually touched.
8. Update the status docs or related notes if your change altered current truth.

## What To Verify Before Calling A Spell Done

At minimum, verify:
- the JSON matches the current validator expectations
- the spell appears correctly in public/data/spells_manifest.json
- class access, targeting, and effect structure are internally coherent
- the relevant UI or combat surface still consumes the spell cleanly
- any status doc you touched still matches the repo after your edit

Do not rely on older docs that still mention flat spell JSON placement or the missing package command npm run validate:spells.

## Common Pitfall During The Current Migration

The spell documentation surface still contains older workflow language in some places.

When docs disagree:
- trust the current repo layout first
- trust the actual package scripts and spell scripts second
- treat older gold-standard or complete-migration wording as provisional unless re-verified

## Where To Go Next

- For implementation order: docs/guides/SPELL_IMPLEMENTATION_CHECKLIST.md
- For debugging current failures: docs/guides/SPELL_TROUBLESHOOTING_GUIDE.md
- For broader status context: docs/SPELL_INTEGRATION_STATUS.md
- For deep architecture orientation: docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md
