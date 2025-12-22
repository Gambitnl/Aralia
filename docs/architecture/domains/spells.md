# Spells

## Purpose

The Spells domain manages all spell data, casting mechanics, targeting systems, and spell effects. It handles the D&D 5e spell system including spell slots, concentration, components, and scaling.

## Key Entry Points

| File | Role |
|------|------|
| `src/systems/spells/` | Spell mechanics systems |
| `src/types/spells.ts` | Spell type definitions (25KB) |
| `public/data/spells/` | Spell JSON data (~470 files) |
| `src/hooks/useSpellGateChecks.ts` | Spell validation hook |

## Subcomponents

- **Targeting**: `targeting/` - Spell target selection and validation
- **Effects**: `effects/` - Spell effect application
- **Mechanics**: `mechanics/` - Core spell mechanics (concentration, components)
- **Validation**: `validation/` - Spell data validation
- **Schema**: `schema/` - Spell JSON schema
- **AI Integration**: `ai/` - AI-assisted spell handling

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/systems/spells/**/*.ts` | Directory | Spell system implementation |
| `src/systems/spells/targeting/*.ts` | Directory | Targeting subsystem |
| `src/systems/spells/effects/*.ts` | Directory | Effect subsystem |
| `src/systems/spells/mechanics/*.ts` | Directory | Core mechanics |
| `src/systems/spells/validation/*.ts` | Directory | Validation |
| `src/systems/spells/schema/*.json` | Directory | JSON schema |
| `src/systems/spells/ai/*.ts` | Directory | AI integration |
| `src/types/spells.ts` | Types | Spell type definitions |
| `src/utils/spell*.ts` | Utils | Spell utility functions |
| `src/utils/concentrationUtils.ts` | Utils | Concentration management |
| `src/hooks/useSpellGateChecks.ts` | Hook | Spell validation |
| `src/services/SpellService.ts` | Service | Spell data service |
| `public/data/spells/**/*.json` | Data | Spell JSON files |
| `public/data/spells_manifest.json` | Data | Spell index/manifest |
| `public/data/spells_fidelity.json` | Data | Spell fidelity tracking |

## Dependencies

### Depends On

- **[Character Sheet](./character-sheet.md)**: Spellcasting ability scores
- **[Data Pipelines](./data-pipelines.md)**: Spell JSON validation and generation

### Used By

- **[Combat](./combat.md)**: Spell casting during combat
- **[Glossary](./glossary.md)**: Spell reference display
- **[Character Creator](./character-creator.md)**: Spell selection during creation

## Boundaries / Constraints

- Spell JSON files are the single source of truth (SSOT) for spell data
- All spell data must conform to the schema in `src/systems/spells/schema/`
- Spell effects should not directly modify character state - use proper dispatches
- Concentration is managed separately from individual spell effects

## Open Questions / TODOs

- [ ] Complete migration of remaining spells to JSON format
- [ ] Document targeting system architecture
- [ ] Clarify higher-level casting mechanics
- [ ] Map spell school effects and interactions
