# Spell Data Creation Guide

This guide documents the current structured spell-data workflow.
The important current-state correction is that the V2 schema direction is real, but some of the older migration wording still overstates which commands and status labels are active in the current repo.

## Verified Current Anchors

This pass confirmed:

- spell JSON files live under public/data/spells/level-N/
- the spell manifest lives at public/data/spells_manifest.json
- schema validation lives at src/systems/spells/validation/spellValidator.ts
- spell maintenance scripts include validateSpellJsons.ts, check-spell-integrity.ts, regenerate-manifest.ts, and generate-spell-manifest.mjs
- supporting reference docs exist at docs/spells/SPELL_JSON_EXAMPLES.md, docs/spells/SPELL_INTEGRATION_CHECKLIST.md, and docs/SPELL_INTEGRATION_STATUS.md

## Current Guidance

When creating or updating spell JSON:

1. Keep the spell file in the correct level folder.
2. Match the current structured schema in src/types/spells.ts and spellValidator.ts.
3. Treat effects, targeting, casting time, duration, components, and classes as first-class structured fields.
4. Validate using the real repo flow:
   - npm run validate
   - npm run typecheck
   - npm run build
5. Use the dedicated spell scripts under scripts/ when the manifest or spell-integrity artifacts need to be refreshed.

## Important Corrections

- The repo does not currently expose npm run validate:spells in package.json.
- Older migration language about bronze or silver status tiers should be treated as historical tracking language unless a specific current status file still uses it.
- The guide should point to the real spell-reference and status surfaces that still exist today rather than to a narrower imagined migration checklist.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as the detailed spell JSON authoring guide for the current structured spell-data lane, but use the repo's real validation and manifest commands rather than the older validate:spells-centered workflow.
