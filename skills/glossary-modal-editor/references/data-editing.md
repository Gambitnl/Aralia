# Glossary Data Editing

## Entry files (`public/data/glossary/entries/`)

- Each glossary term lives in `/public/data/glossary/entries/<category>/<id>.json`.
- The entry JSON must include `id`, `title`, `category`, `filePath`, `markdown`, and the optional helpers (`tags`, `excerpt`, `aliases`, `seeAlso`). The filename (minus `.json`) must exactly match `id` (see `docs/guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md` for the required shape).
- Use kebab-case for new IDs and keep `filePath` rooted under `/data/glossary/entries/`. Duplicate IDs or stale file paths break the indexer.
- Rich entries (classes/races/etc.) may embed HTML tables, SVG icons, or `glossary-term-link-from-markdown` spans directly inside the `markdown` field; wrap custom blocks with `div.not-prose` to avoid unexpected typography styling (`docs/guides/@GLOSSARY-CONTRIBUTOR-GUIDE.md`).
- If you want a tooltip-style reference, wrap the trigger text with `<span class="glossary-term-link-from-markdown" data-term-id="...">` so both the tooltip and navigation callbacks work.

## Index construction (`scripts/generateGlossaryIndex.js`)

- Every time you add, rename, or reorganize entry files, run `node scripts/generateGlossaryIndex.js`. The script scans `/public/data/glossary/entries`, verifies JSON syntax, enforces unique IDs, and writes sorted category files plus `main.json` under `/public/data/glossary/index/`.
- The indexer skips `spells/` entries because spells are rendered from `public/data/spells` and `public/data/spells_manifest.json`; those entries are assembled at runtime (the script logs which levels were generated).
- Character classes and Character Races get extra treatment: Character classes are grouped into main classes, subclasses, spell lists, and artificer infusions. Character Races use parent races (Dwarf, Elf, Human, etc.) as accordion groups containing subchoices (Hill Dwarf, Mountain Dwarf, Mark of Warding, etc.). The `subEntries` array pattern allows nested sidebar navigation for both categories. If you need a multi-level sidebar beyond what the script produces, edit the generated category JSON manually by moving objects into a `subEntries` array (see `docs/guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md` for the JSON pattern), then rerun the script to regenerate surrounding metadata.
- The index files the app loads are the only catalog sources; never edit `/public/data/glossary/index/*` by hand unless you are debugging, and always keep them in sync with the entry files.

## Verification checklist

1. `node scripts/generateGlossaryIndex.js` completes without errors (watch for duplicate ID or missing `category` warnings).
2. The generated `main.json` timestamp (`lastGenerated`) updates and the relevant `/data/glossary/index/<slug>.json` contains your new IDs.
3. The app’s glossary modal (or tooltip) can open the new term through `handleNavigateToGlossary` without logging “term not found.”
4. If you changed the data source (e.g., moved a file), restart the dev server to ensure cached index data reloads.

Refer to `docs/guides/GLOSSARY_ENTRY_DESIGN_GUIDE.md` for detailed JSON conventions and `docs/guides/@GLOSSARY-CONTRIBUTOR-GUIDE.md` for advanced formatting tips before touching the files.
