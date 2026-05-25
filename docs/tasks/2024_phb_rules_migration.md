# 2024 PHB Rules Migration Tracker

**Current Objective:**
Implement the 2024 Player's Handbook (PHB) rules from the 5e.tools vendor repository into the Aralia glossary.

**Active Work:**
- Finished!

**Completed Work:**
- Investigated `vendor/5etools-src/data/variantrules.json`, `actions.json`, and `conditionsdiseases.json`.
- Identified target data structure and `source: "XPHB"` filter.
- Formulated implementation plan.
- Built `scripts/ingestRules.ts` to extract, convert to Markdown, and write out 2024 PHB rules.
- Upgraded the ingestion script to automatically detect and replace duplicate rules from earlier versions (e.g., removing old 2014 movement/equipment files and placing the 2024 versions in `rules/`).
- Upgraded the `stripMarkup` function inside the ingest script to emit Aralia native `[[term_id|display]]` shorthand links instead of dropping `5e.tools` tags into plain text, solving the intra-glossary cross-linking issue.
- Restructured `src/components/Glossary/glossaryRuleChapters.ts` to organize the 147 new rules into 7 broad, semantic sidebar chapters (e.g. Core Resolution, Combat & Actions, Conditions & States).
- Successfully ingested 147 rules into `public/data/glossary/entries/rules/`.
- Rebuilt the `main.json` glossary index successfully without ID collisions.

**Blockers:**
- None.

**Newly Discovered Gaps:**
- Some specific nested tables in the JSON are somewhat complex to parse perfectly into Markdown. The script does a best-effort structural mapping.

**Adjacent But Out-of-Scope Findings:**
- Other 5e.tools data categories (e.g., items, feats, species) also have 2024 versions that need ingestion eventually, but this task is strictly focused on core rules for the glossary.

**Next Recommended Actions:**
- Visually inspect complex tables (like Exhaustion or specific weapon properties) in the Aralia Glossary UI to ensure the Markdown parser handled them correctly.
