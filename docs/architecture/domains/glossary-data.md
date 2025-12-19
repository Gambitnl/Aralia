# Glossary Data Domain

Static data content for the glossary system - classes, races, rules, spells.

## Purpose

Contains all the JSON data files that populate the glossary. These are the "source of truth" for D&D 5e content including class features, racial traits, rules, conditions, and more.

## Key Entry Points

| Path | Description |
|------|-------------|
| `public/data/glossary/entries/` | All glossary JSON entries |
| `public/data/spells/` | Spell JSON files |
| `public/data/spells_manifest.json` | Spell index/manifest |

## Subcomponents

### Class Data
| Path | Content |
|------|---------|
| `public/data/glossary/entries/classes/*.json` | Base class definitions |
| `public/data/glossary/entries/classes/*_spell_list.json` | Class spell lists |
| `public/data/glossary/entries/classes/*_subclasses/*.json` | Subclass options |

### Race Data
| Path | Content |
|------|---------|
| `public/data/glossary/entries/races/*.json` | Base race definitions |
| `public/data/glossary/entries/races/elf_lineages/*.json` | Elf lineage options |
| `public/data/glossary/entries/races/gnome_subraces/*.json` | Gnome subrace options |
| `public/data/glossary/entries/races/goliath_ancestries/*.json` | Goliath ancestry options |

### Rules Data
| Path | Content |
|------|---------|
| `public/data/glossary/entries/rules/*.json` | Core rules (ability checks, actions, etc.) |
| `public/data/glossary/entries/rules/conditions/*.json` | Condition definitions |

### Item Data
| Path | Content |
|------|---------|
| `public/data/glossary/entries/magic_items/*.json` | Magic item definitions |

### Spell Data
| Path | Content |
|------|---------|
| `public/data/spells/*.json` | Individual spell files |
| `public/data/spells_manifest.json` | Spell manifest/index |
| `public/data/spells_fidelity.json` | Spell fidelity tracking |

### Other Data Files
| Path | Content |
|------|---------|
| `public/data/cantrip_consistency_report.md` | Cantrip audit report |
| `public/data/cantrip_table.md` | Cantrip reference table |

## Adding New Content

1. Create JSON file following the schema in `src/types/spells.ts` (for spells) or existing examples
2. Validate with `npx tsx scripts/validate-data.ts`
3. Update manifest if applicable
4. Run `npm run build` to verify

## Dependencies

- **Imported by:** `src/services/spellLoader.ts`, `src/components/Glossary/`, `src/hooks/useSpellLoader.ts`
- **Validated by:** `scripts/validateSpellJsons.js`, `scripts/validate-data.ts`

## Boundaries

### Owned by this domain
- All files in `public/data/glossary/`
- All files in `public/data/spells/`
- Data markdown files in `public/data/`

### DO NOT MODIFY without validation
- Spell JSONs must pass schema validation
- Adding new classes/races requires corresponding validator updates
