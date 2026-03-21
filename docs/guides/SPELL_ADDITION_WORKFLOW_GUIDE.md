# Guide: Adding or Updating Spells (Development Process)

This guide documents the current developer workflow for adding or updating spell data in Aralia.
The important current-state correction is that spell work should be validated through the repo's real validation and manifest scripts, not through the older nonexistent validate:spells command.

## Verified Current Spell Data Shape

This pass confirmed:

- spell JSON lives under public/data/spells/level-N/
- the spell manifest lives at public/data/spells_manifest.json
- schema validation lives at src/systems/spells/validation/spellValidator.ts
- the repo exposes npm run validate, npm run validate:charset, npm run typecheck, and npm run build in package.json
- spell-specific maintenance scripts exist under scripts/, including validateSpellJsons.ts, check-spell-integrity.ts, regenerate-manifest.ts, and generate-spell-manifest.mjs

## Recommended Current Workflow

1. Choose the correct level folder under public/data/spells/level-N/.
2. Copy a nearby spell JSON as a reference when helpful.
3. Update the spell JSON to match the current structured schema.
4. Run the real validation flow:
   - npm run validate
   - npm run typecheck
   - npm run build
5. If the manifest or spell inventory needs regeneration, use the dedicated spell scripts under scripts/.
6. Re-check the spell in the relevant integration surfaces such as character creation, spellbook, combat, glossary, and the spell reference docs when applicable.

## References That Still Matter

- docs/spells/SPELL_JSON_EXAMPLES.md
- src/types/spells.ts
- src/systems/spells/validation/spellValidator.ts
- docs/SPELL_INTEGRATION_STATUS.md
- docs/spells/SPELL_INTEGRATION_CHECKLIST.md
- docs/tasks/spell-system-overhaul/

## Important Corrections

- npm run validate:spells is not a current package.json command in this repo.
- Spell contribution work now sits inside a broader spell-data and manifest workflow, not a tiny isolated JSON edit loop.
- Class normalization, manifest maintenance, and spell reference surfaces still matter, but they should be described as repo-backed follow-through rather than as assumptions about a single AI assistant flow.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as the live high-level spell addition workflow guide, but anchor it to npm run validate plus the existing spell scripts and current spell-reference surfaces rather than the older validate:spells-centered wording.
