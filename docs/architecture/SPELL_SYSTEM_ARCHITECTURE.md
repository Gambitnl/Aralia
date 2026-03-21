# Spell System Architecture

## Status

This is now a live architecture note rewritten against the current repo.
The spell system is still evolving, but the core data, loading, validation, and execution surfaces described here are real enough to document without relying on stale migration percentages.

## Core Shape

The current spell system is still fundamentally data-driven:

- spell definitions live in JSON under public/data/spells
- the checked-in manifest lives at public/data/spells_manifest.json
- spell typing lives in src/types/spells.ts
- runtime validation lives under src/systems/spells/validation
- loading and lookup live through SpellService and SpellContext
- execution now spans both spell-to-ability translation and command-based spell execution

## Verified Current Components

### Data Layer

- Spell JSON files live under public/data/spells/level-*.
- The checked-in manifest file is public/data/spells_manifest.json.
- The JSON schema file exists at src/systems/spells/schema/spell.schema.json.
- docs/spells/SPELL_JSON_EXAMPLES.md still exists as a contributor/example surface.

### Validation Layer

- src/systems/spells/validation/spellValidator.ts exists and is the live runtime validation surface referenced by the hook and broader spell tooling.
- src/hooks/useSpellGateChecks.ts exists and performs manifest, fetch, and validation checks against live spell data.

### Loading And Access Layer

- src/services/SpellService.ts exists and provides manifest lookup plus lazy spell-detail loading.
- src/context/SpellContext.tsx exists and eagerly loads spell data for React consumers, with progress and issue reporting.

### Execution Layer

- src/utils/character/spellAbilityFactory.ts exists and still translates spell data into combat-ready abilities.
- src/commands/factory/SpellCommandFactory.ts exists and represents the more explicit command-based execution lane for structured spell effects.
- src/hooks/useAbilitySystem.ts remains a key integration point for combat execution.

### Presentation Layer

- src/components/CharacterSheet/Spellbook/SpellbookOverlay.tsx exists.
- Spellbook, combat, glossary, and character-creation surfaces still form the main consumer lanes for spell data, but this note should stay conservative about exactly how complete each consumer is at any given moment.

## Historical Drift To Note

The older version of this note drifted in several ways:

- it pointed at src/utils/spellAbilityFactory.ts, but the live file now lives at src/utils/character/spellAbilityFactory.ts
- it referenced scripts/generate-spell-manifest.ts, but that script was not found in the current repo during this pass
- it instructed maintainers to run npm run validate:spells, but that npm script is not present in the current package.json
- it treated migration percentages and completion states as if they were current architecture truth, which is too unstable for this kind of reference note

## Safe Current Interpretation

The safest current reading is:

- the repo already has a real spell data model
- the repo already has real spell loading and validation lanes
- the repo already has multiple execution surfaces, including spellAbilityFactory and SpellCommandFactory
- some migration, coverage, and execution gaps still exist, but they should be documented in narrower status or task docs rather than baked into this architecture note as fixed percentage claims

## Maintenance Guidance

When this note is updated in the future:

- prefer current file paths over remembered historical ones
- separate architecture shape from migration-status reporting
- treat package.json scripts as the authority for command names
- keep this note focused on stable system lanes, not temporary percent-complete dashboards
