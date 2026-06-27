# Spells

## Purpose

The Spells domain covers spell data, validation, loading, translation into executable abilities, targeting support, effect execution, and spell-facing UI surfaces.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/systems/spells/
- src/types/spells.ts
- public/data/spells/
- public/data/spells_manifest.json
- src/hooks/useSpellGateChecks.ts
- src/services/SpellService.ts
- src/context/SpellContext.tsx
- src/utils/character/spellAbilityFactory.ts

## Current Domain Shape

The domain currently includes these active lanes:
- targeting systems under src/systems/spells/targeting/
- validation and schema under src/systems/spells/validation/ and src/systems/spells/schema/
- mechanics such as concentration and related spell execution support under src/systems/spells/mechanics/
- AI-assisted spell support under src/systems/spells/ai/
- spell JSON data and manifest files under public/data/
- React consumers through spellbook, glossary, character, and combat-facing surfaces

## Boundaries And Constraints

- Spell JSON remains the primary runtime data lane for spell definitions.
- Validation and schema checks matter because downstream systems assume structured spell fields exist.
- The spell domain is data-driven, but not fully free of hybrid legacy behavior; some translation still falls back to description parsing.
- Gate-check and fidelity tooling still bridge between code/data truth and older migration-gap documentation.

## Historical Drift Corrected

The older version of this file drifted in several ways:
- it pointed at src/utils/spellAbilityFactory.ts instead of the current src/utils/character/spellAbilityFactory.ts path
- it presented the spell JSON lane as a cleaner single-source-of-truth story than the broader migration workflow currently supports
- it implied migration percentages and progress states that are no longer trustworthy without a fresh count

## What Is Materially Implemented

This pass verified that the following are materially present:
- manifest-driven spell loading
- schema and runtime validation
- spell gate checking
- spellbook UI integration
- spell-to-ability translation
- multi-effect command creation support
- large-scale per-level spell JSON coverage across the manifest and level folders

## Open Follow-Through Questions

- Which spell execution paths still rely on silver-standard description parsing instead of fully structured effect handling?
- Which spell gap documents remain live inputs versus purely historical migration records?
- Which spell-facing docs should remain active reference surfaces versus preserved migration history?

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/architecture/domains/spells.md","sha256WithoutMarker":"fd7903f1011c0347d4a18e6165f8545170124e20a74b2ac8e5429c0ce91c4ecd","markedAtUtc":"2026-06-26T00:12:35.436Z"} -->
