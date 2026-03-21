# Spell Integration Status: Cantrips (Level 0)

Last Updated: 2026-03-12

This file is the current level-0 status note. It no longer pretends that every cantrip has been run through a complete end-to-end integration matrix just because the migration-era table once marked them Data Only.

## Verified Current Inventory Fact

A manual repo check during the 2026-03-12 doc pass confirmed:
- ../../public/data/spells/level-0 currently contains 44 spell JSON files
- the level-0 lane still exists as the canonical cantrip folder
- the glossary spell index still includes cantrip entries under ../../public/data/glossary/index/spells.json

## What This File Means Now

Use this file as a level-0 orientation note, not as a proof that every cantrip has identical execution maturity.

What is safe to say:
- cantrips are present in the structured spell-data lane
- the manifest-driven spell loader still uses the level-0 folder
- the old migration effort did create a real cantrip inventory

What this file does not claim:
- that every cantrip has been freshly tested in character creation, spellbook, combat, and glossary during this doc pass
- that every cantrip uses only one execution path
- that older integration labels such as Data Only still describe current reality

## Cross-Cutting Cantrip Evidence Verified In The Current Repo

The broader spell-overhaul docs already verify several cantrip-backed mechanic lanes that older status notes treated as missing or untested:
- Light demonstrates structured light metadata in ../../public/data/spells/level-0/light.json
- Mind Sliver demonstrates a save-penalty rider in ../../public/data/spells/level-0/mind-sliver.json
- Mold Earth demonstrates terrain manipulation structure in ../../public/data/spells/level-0/mold-earth.json

Those examples are useful because they show that the cantrip lane is not only bare metadata. They still do not substitute for per-spell gameplay verification across all 44 cantrips.

## Practical Reading Rule

If you need the current cantrip list, trust the spell folder and manifest.
If you need execution truth for a specific cantrip, use:
- ./SPELL_INTEGRATION_CHECKLIST.md
- ../../src/systems/spells/validation/spellValidator.ts
- ../../src/context/SpellContext.tsx
- ../../src/utils/character/spellAbilityFactory.ts
- any spell-specific overhaul note that has already been re-audited

## Historical Note

Earlier versions of this file used a large per-spell Data Only table and implied that integration testing had not started at all.
That wording is now too blunt for the current repo. It obscures the fact that some cross-cutting cantrip mechanics have been implemented and verified, while broad per-spell regression coverage still remains uneven.
