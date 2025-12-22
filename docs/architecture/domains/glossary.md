# Glossary

## Purpose

The Glossary provides an in-game reference system for D&D 5e rules, spells, items, conditions, and other game concepts. It allows players to look up information during gameplay without leaving the application.

## Key Entry Points

| File | Role |
|------|------|
| `src/components/Glossary/Glossary.tsx` | Main glossary modal component |
| `src/components/Glossary/GlossaryContentRenderer.tsx` | Renders glossary entry content |
| `src/components/Glossary/SpellCardTemplate.tsx` | Specialized spell display template |
| `src/data/glossaryData.ts` | Glossary data loading utilities |

## Subcomponents

- **Entry Display**: `FullEntryDisplay.tsx`, `GlossaryDisplay.tsx` - Renders individual entries
- **Search/Filter**: Within `Glossary.tsx` - Category filtering and text search
- **Tooltips**: `GlossaryTooltip.tsx` - Hover tooltips for inline references
- **Spell Cards**: `SpellCardTemplate.tsx` - Formatted spell information display
- **Single Entry Modal**: `SingleGlossaryEntryModal.tsx` - Standalone entry viewer

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/components/Glossary/*.ts*` | Directory | All glossary UI components and index |
| `src/data/glossaryData.ts` | Data | Glossary data utilities |
| `src/utils/glossaryUtils.ts` | Utils | General glossary utilities |


## Dependencies

### Depends On

- **[Spells](./spells.md)**: Displays spell data from spell JSON files
- **[Data Pipelines](./data-pipelines.md)**: Uses generated glossary index

### Used By

- **[Character Creator](./character-creator.md)**: Links to glossary for class/race info
- **[Character Sheet](./character-sheet.md)**: Links to glossary for ability/spell info
- **[Combat](./combat.md)**: References conditions and rules during combat

## Boundaries / Constraints

- Glossary is read-only - it displays information but does not modify game state
- All glossary data should come from `public/data/glossary/` JSON files
- Spell data comes from `public/data/spells/` JSON files (shared with Spells domain)

## Open Questions / TODOs

- [ ] Consider caching strategy for large glossary datasets
- [ ] Evaluate search performance with growing entry count
- [ ] Document relationship between glossary entries and spell JSON schema

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/components/Glossary/__tests__/Glossary.test.tsx` | Glossary main component tests |
| `src/components/Glossary/__tests__/GlossaryDisplay.test.tsx` | Glossary display component tests |
| `src/components/__tests__/GlossaryContentRenderer.test.tsx` | Glossary content renderer tests |
| `src/components/__tests__/GlossaryFullEntryDisplay.test.tsx` | Glossary full entry display tests |
| `src/utils/__tests__/glossaryUtils.test.ts` | Glossary utility tests |
