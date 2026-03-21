# Spell Testing Procedures and Validation Workflows

This guide documents the current spell-validation and spell-testing workflow.
The important current-state correction is that the repo's real validation commands are npm run validate, npm run typecheck, and npm run build, supported by spell-specific scripts under scripts/ rather than by the older nonexistent validate:spells command.

## Verified Current Validation Surfaces

This pass confirmed:

- package.json exposes npm run validate, npm run validate:charset, npm run typecheck, and npm run build
- spell maintenance scripts exist at scripts/validateSpellJsons.ts, scripts/check-spell-integrity.ts, scripts/regenerate-manifest.ts, and scripts/generate-spell-manifest.mjs
- spell validation schema code exists at src/systems/spells/validation/spellValidator.ts
- spell status and reference surfaces exist under docs/spells/ and docs/SPELL_INTEGRATION_STATUS.md

## Recommended Current Workflow

### Automated checks

Use the repo-backed baseline checks:

- npm run validate
- npm run typecheck
- npm run build

Use spell-specific scripts when needed for deeper spell auditing or manifest refresh work.

### Manual integration checks

After structural validation, verify the spell in the main consumer surfaces that still matter:

- character creation or class spell access
- spellbook and character sheet presentation
- combat execution and targeting behavior
- glossary and spell reference visibility

## Important Corrections

- npm run validate:spells is not a current package.json script.
- The guide should not claim a single canonical spell count or fixed expected output unless it was freshly regenerated in this pass.
- The large CI and automation examples are only useful if they match the current repo; where unverified, they should be treated as aspirational process notes rather than guaranteed active workflow.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as the live spell testing and validation guide, but ground it in the real validate plus typecheck plus build flow and in the existing spell-maintenance scripts rather than the older validate:spells-first wording.
