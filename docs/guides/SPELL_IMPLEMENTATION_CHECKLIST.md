# Spell Implementation Checklist

Last Updated: 2026-03-11
Purpose: Current implementation checklist for adding or repairing spell JSON in the live repo.

## How To Use This Checklist

Use this when you are actively creating or updating a spell JSON file.

This checklist assumes:
- spell files live under public/data/spells/level-{N}/
- the manifest is public/data/spells_manifest.json
- validation truth is defined by src/systems/spells/validation/spellValidator.ts

It does not assume a package command called validate:spells, because that script is not present in the current package.json.

## Phase 1: Research

- [ ] Confirm the spell's current status in docs/spells/STATUS_LEVEL_{N}.md
- [ ] Read one similar spell JSON from the same level band
- [ ] Review docs/spells/SPELL_JSON_EXAMPLES.md
- [ ] Check docs/spells/SPELL_INTEGRATION_CHECKLIST.md for the broader integration surface
- [ ] If the spell touches a known mechanic like concentration, terrain, light, or summon behavior, inspect a current spell that already uses that mechanic

## Phase 2: File And Metadata Setup

- [ ] Place the file under public/data/spells/level-{N}/
- [ ] Make the filename kebab-case and match id
- [ ] Fill out current root fields expected by the validator, including:
  - id
  - name
  - aliases
  - level
  - school
  - source
  - legacy
  - classes
  - ritual
  - rarity
  - attackType
  - castingTime
  - range
  - components
  - duration
  - targeting
  - effects
  - arbitrationType
  - aiContext
  - description
  - higherLevels
  - tags

## Phase 3: Effect And Targeting Structure

- [ ] Every effect includes trigger and condition
- [ ] Effect type values match the current validator exactly
- [ ] Damage, healing, defensive, utility, terrain, movement, summoning, and status payloads match current schema expectations
- [ ] targeting.validTargets uses the current plural field name
- [ ] Area-of-effect shape, size, and optional fields match the current validator if used
- [ ] Class names match the current validator whitelist rather than older normalization assumptions in stale docs

## Phase 4: Manifest And Validation

- [ ] If spell files were added, removed, or moved, regenerate the manifest with npx tsx scripts/regenerate-manifest.ts
- [ ] Run focused spell validation with:
  - npx tsx scripts/validateSpellJsons.ts
  - npx tsx scripts/check-spell-integrity.ts
- [ ] Run the broader repo validation flow with:
  - npm run validate
  - npm run typecheck
  - npm run build
- [ ] Fix any schema, manifest, class-list, or path issues before moving on

## Phase 5: Integration Checks

- [ ] Verify the spell appears in the expected class or race spell surface
- [ ] Verify the spell resolves through the spellbook or character sheet surface if relevant
- [ ] Verify the spell can be selected or loaded where the gameplay flow expects it
- [ ] Verify the combat or runtime path still understands the effect structure you used
- [ ] If the spell depends on a partially implemented mechanic, record that clearly instead of calling the spell fully complete

## Phase 6: Documentation Follow-Through

- [ ] Update the relevant docs/spells/STATUS_LEVEL_{N}.md entry if current truth changed
- [ ] Update a nearby note only if your work actually changed the documented state
- [ ] Avoid copying stale Gold, Bronze, or Silver claims forward without re-verification

## High-Risk Failure Points

- [ ] File path does not match the spell level
- [ ] id and filename drift apart
- [ ] A required root field from the current validator is missing
- [ ] Effect payload shape reflects an older example rather than the live validator
- [ ] Manifest was not regenerated after file changes
- [ ] A doc still says the spell is missing even though the file now exists

## Completion Standard

Treat a spell update as complete only when:
- focused spell checks pass
- broader repo validation passes for the touched surface
- the spell's manifest entry is correct
- the relevant gameplay surface still consumes it cleanly
- the nearby status docs no longer contradict the repo

## Related References

- docs/guides/SPELL_ADDITION_WORKFLOW_GUIDE.md
- docs/guides/SPELL_DATA_CREATION_GUIDE.md
- docs/guides/SPELL_TROUBLESHOOTING_GUIDE.md
- docs/spells/SPELL_JSON_EXAMPLES.md
- docs/spells/SPELL_INTEGRATION_CHECKLIST.md
- docs/SPELL_INTEGRATION_STATUS.md
