# Guide: Designing Glossary Entries

Last Updated: 2026-03-11
Purpose: Describe the current glossary-entry design rules without carrying forward stale assumptions about file format or spell entry storage.

## Current Glossary Shape

Verified anchors in this pass:
- public/data/glossary/entries/
- public/data/glossary/index/
- scripts/generateGlossaryIndex.js
- docs/guides/@GLOSSARY-CONTRIBUTOR-GUIDE.md
- scripts/add_spell.js

## Core Rule: Entry Files Are JSON

Glossary entries are JSON files under public/data/glossary/entries/.

Each entry carries metadata fields plus a markdown field for the rendered body.

Spells are the important exception:
- spell glossary content is not stored as separate glossary entry files
- the Spells category is generated from public/data/spells_manifest.json
- spell rendering is driven from spell JSON and the spell-aware glossary surfaces

## File Naming And ID Rule

Keep the filename and the id aligned.

Practical rule:
- create a JSON file whose basename matches the entry id
- keep the filePath accurate to the entry's location under public/data/glossary/entries/
- avoid duplicate ids across the glossary tree

## What The Index Generator Currently Does

scripts/generateGlossaryIndex.js currently:
- scans glossary JSON entries
- generates category index files under public/data/glossary/index/
- builds the spell index from public/data/spells_manifest.json
- performs special grouping logic for at least Character Classes and Character Races

That means some hierarchy is now generator-aware, not purely manual.

## Hierarchy Guidance

Do not assume every nested glossary relationship still requires the same manual index surgery described in older versions of this guide.

Current practical rule:
- for ordinary entries, add the JSON entry and regenerate indexes first
- for custom hierarchy work, inspect the generated index output before manually reshaping anything
- for Character Classes and Character Races, expect the generator to already perform category-specific grouping work

## Spell Workflow Note

The helper script scripts/add_spell.js exists in this repo.

Use the real current spell workflow and spell docs when working with spells, but keep this design guide focused on glossary-entry rules rather than treating it as the primary spell-addition guide.

## Practical Checklist

- [ ] Create or update the glossary JSON entry under public/data/glossary/entries/
- [ ] Keep id, filename, and filePath aligned
- [ ] Keep the markdown body inside the JSON entry rather than treating the entry itself as a markdown file
- [ ] Regenerate indexes through scripts/generateGlossaryIndex.js
- [ ] Check the resulting category index before doing any manual hierarchy reshaping
- [ ] For spells, do not create duplicate standalone glossary entry files unless the current spell workflow explicitly requires it

## Common Drift To Avoid

Do not assume:
- that glossary entries are markdown source files
- that spell entries need standalone glossary content files
- that every hierarchy still requires manual JSON nesting after regeneration
- that a design guide should override the actual generator behavior on disk
