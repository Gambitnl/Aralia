# Spell Integration Checklist

Last Updated: 2026-03-12

This file is the live spell-integration checklist for the current repo. It no longer treats older build-order diagrams or per-component ownership claims as current truth. Use it to verify a spell against the current validator, manifest, loading path, UI surfaces, and combat-execution path.

## What This Checklist Actually Proves

Use this file when you need to answer two questions:
- Is the spell data structurally valid and discoverable by the app?
- Does the spell reach the main player-facing and combat-facing surfaces without obvious drift?

This file does not claim that every spell has bespoke end-to-end implementation. Some mechanics still rely on a mix of structured command execution, spell-to-ability translation, and older fallback behavior.

## Verified Current Anchors

These surfaces were re-checked during the 2026-03-12 doc pass:
- Validator: ../../src/systems/spells/validation/spellValidator.ts
- Manifest: ../../public/data/spells_manifest.json
- Integrity script: ../../scripts/check-spell-integrity.ts
- Global spell loader: ../../src/context/SpellContext.tsx
- On-demand spell loader: ../../src/services/SpellService.ts
- Character spell aggregation bridge: ../../src/utils/spellUtils.ts
- Current spell-to-ability bridge: ../../src/utils/character/spellAbilityFactory.ts
- Glossary spell index: ../../public/data/glossary/index/spells.json
- Glossary spell modal: ../../src/components/Glossary/SingleGlossaryEntryModal.tsx

Important drift correction:
- Older versions of this document pointed to src/utils/spellAbilityFactory.ts and markdown-backed spell glossary entries. The current repo uses src/utils/character/spellAbilityFactory.ts, keeps a deprecated bridge at src/utils/spellUtils.ts, and the glossary spell index now marks spell-backed entries with hasSpellJson while filePath is often null.

## Preflight Data Checks

Before checking UI or combat behavior, verify the spell against the current data lane.

1. File placement
- Spell JSON lives under ../../public/data/spells/level-N/
- Cantrips live under level-0
- The manifest path should match the spell level folder

2. Schema alignment
- Validate against ../../src/systems/spells/validation/spellValidator.ts
- Required root surfaces include castingTime, range, components, duration, targeting, and effects
- Effect records must include trigger, condition, and description fields, even when the description is currently terse or empty in migrated data
- Use current enum casing and current field names such as validTargets, creatureTypes, saveModifiers, controlOptions, forcedMovement, familiarContract, and dispersedByStrongWind where applicable

3. Manifest and integrity checks
- The spell must appear in ../../public/data/spells_manifest.json
- Run ../../scripts/check-spell-integrity.ts after manifest regeneration or broad spell edits
- That script checks manifest paths, missing spell files, schema validity, and class spell-list references

## Current Verification Flow

### A. Structural Verification
- Confirm the spell file is in the correct level folder
- Confirm the manifest entry points at that file
- Run npm run validate
- Run the spell-integrity script if the change touched spell placement, manifest generation, or class spell lists

### B. Spell Loading Verification
- Confirm ../../src/context/SpellContext.tsx can load the spell from the manifest
- Confirm ../../src/services/SpellService.ts can resolve the spell by id
- Confirm the spell survives the aggregated character-spell path through ../../src/utils/spellUtils.ts

### C. Character-Creation Verification
- Confirm the spell appears for the right class, subclass, or racial source
- Confirm level gating is sensible for the current creator flow
- Confirm the selected spell survives character assembly and appears in the resulting spellbook data

### D. Spellbook And Resource Verification
- Confirm the spell is visible in the spellbook or other character-sheet entry surface when the character should know or prepare it
- Confirm slot consumption or cantrip behavior matches the expected resource path
- Confirm prep toggles and spell slot displays still line up with the spell level

### E. Combat Or Execution Verification
- For battle-map or tactical casting, confirm the current bridge is ../../src/utils/character/spellAbilityFactory.ts
- Do not assume the old Gold or Silver maturity labels still describe the true execution path
- Check whether the spell relies on structured command handling, spell-to-ability translation, or both
- Verify the pieces that matter for the spell: targeting, action cost, area handling, effect application, and resource consumption

### F. Glossary Verification
- Confirm the spell appears under ../../public/data/glossary/index/spells.json
- Confirm glossary lookups still resolve through ../../src/components/Glossary/SingleGlossaryEntryModal.tsx and the glossary context lane
- Do not assume there is a standalone markdown spell-entry file just because an older doc said so

## Commands Still Worth Running

Use the current repo commands, not older command names from pre-refresh docs.

- npm run validate
- npx tsx scripts/check-spell-integrity.ts
- npm run typecheck
- npm run build
- npm test

There is no validate:spells package script. Older docs that referenced it were stale.

## Known Interpretation Limits

This checklist is intentionally honest about uncertainty.

- A spell can be schema-valid and manifest-visible without every edge-case mechanic being fully verified in combat
- Some older docs still describe spell maturity through Gold, Silver, and Bronze shorthand; that shorthand is not treated as canonical here unless a level-status doc was freshly re-audited
- Cross-cutting mechanics such as light sources, save-penalty riders, terrain manipulation, concentration, and object targeting should be checked against the current repo behavior, not against older migration assumptions

## How To Use This File During The Remaining Overhaul

Treat this checklist as the live control surface for spell verification. Use level-specific status docs only as supporting context, and prefer current repo anchors over any older component map that implies a cleaner or more centralized architecture than the repo actually has.
