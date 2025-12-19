# Data Pipelines

## Purpose

This domain covers all build-time scripts, validators, and generators that process game data. These tools ensure data integrity, generate derived artifacts, and maintain consistency across the codebase.

## Key Entry Points

| File | Role |
|------|------|
| `scripts/validate-data.ts` | Main data validation script |
| `scripts/check-non-ascii.ts` | ASCII character validation |
| `scripts/generateGlossaryIndex.js` | Glossary index generation |
| `scripts/generate-architecture-compendium.ts` | Architecture doc generation |

## Subcomponents

- **Validation Scripts**:
  - `validate-data.ts` - Comprehensive data validation
  - `validateSpellJsons.ts/js` - Spell JSON validation
  - `check-non-ascii.ts` - Character encoding checks
  - `check-spell-integrity.ts` - Spell data integrity
- **Generation Scripts**:
  - `generateGlossaryIndex.js` - Glossary index
  - `generate-spell-manifest.mjs` - Spell manifest
  - `regenerate-manifest.ts` - Manifest regeneration
  - `generate-architecture-compendium.ts` - Architecture docs
- **Migration Scripts**:
  - `migrate-glossary-entries-to-json.ts` - Glossary migration
  - `migrate-legacy-spells-to-v2.ts` - Spell format migration
  - `expand-spell-jsons.ts` - Spell JSON expansion
  - `update-spell-json-from-references.ts` - Spell data updates
- **Utility Scripts**:
  - `formatSpellJsons.js` - JSON formatting
  - `compressGlossaryLinks.js` - Link compression
  - `fix-spell-frontmatter.js` - Frontmatter fixes
  - `add_spell.js` - Single spell addition

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `scripts/` | Directory | All pipeline scripts (~28 files) |
| `scripts/validate-data.ts` | Script | Data validation |
| `scripts/check-non-ascii.ts` | Script | Encoding checks |
| `scripts/validateSpellJsons.ts` | Script | Spell validation |
| `scripts/generateGlossaryIndex.js` | Script | Glossary index |
| `scripts/generate-spell-manifest.mjs` | Script | Spell manifest |
| `scripts/expand-spell-jsons.ts` | Script | Spell expansion |
| `scripts/formatSpellJsons.js` | Script | JSON formatting |
| `scripts/migrate-*.ts` | Scripts | Migration tools |
| `scripts/update-spell-json-from-references.ts` | Script | Reference updates |
| `public/data/spells_manifest.json` | Generated | Spell index |
| `docs/architecture/_generated/` | Generated | Architecture artifacts |

## Dependencies

### Depends On

- **[Spells](./spells.md)**: Spell JSON data for validation
- **[Glossary](./glossary.md)**: Glossary entries for indexing

### Used By

- **Build Process**: `npm run validate`
- **[Spells](./spells.md)**: Generated manifests
- **[Glossary](./glossary.md)**: Generated indexes

## Script Commands

```bash
# Run all data validation
npm run validate

# Validate spell JSONs
npx --no-install tsx scripts/validateSpellJsons.ts

# Check non-ASCII characters
npx --no-install tsx scripts/check-non-ascii.ts

# Generate glossary index
node scripts/generateGlossaryIndex.js

# Generate architecture compendium
npx --no-install tsx scripts/generate-architecture-compendium.ts
```

## Boundaries / Constraints

- Scripts must be idempotent - running twice produces same result
- Generated files should have clear markers indicating they are generated
- Validation failures should produce clear, actionable error messages
- Scripts should not modify source data unless explicitly designed to

## Open Questions / TODOs

- [ ] Document script dependencies and execution order
- [ ] Clarify which scripts are safe to run automatically
- [ ] Map generated file locations and purposes
