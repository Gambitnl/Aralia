# NORTH STAR: PHB2024 Glossary Audit

**Project Objective:**
Ingest and structure all remaining 2024 Player's Handbook (XPHB) content from the `5e.tools` vendor repository into the Aralia glossary. Classes, races, and spells are explicitly out of scope for this pass.

**Intended Outcome:**
The Glossary contains full Markdown-formatted rule entries for 2024 Feats, Backgrounds, Items, Skills, Senses, Languages, and Hazards. The sidebar taxonomy gracefully categorizes them, and intra-glossary Markdown links (e.g., `[[skill_id|Display]]`) work seamlessly.

**Current State:**
Core rules (actions, conditions, variant rules) were ingested. The remaining content categories require dedicated parsing and JSON generation.

**Scope Boundaries:**
- **In Scope:** Feats, Backgrounds, Items, Skills, Senses, Languages, Hazards, Optional Features marked `source: "XPHB"` or `basicRules2024: true`.
- **Out of Scope:** Spells, Classes, Races (Subclasses, Subraces), pre-2024 content unless updated to 2024 mechanics.

**Project Pointers:**
- [Living Tracker](./TRACKER.md)
- [Gap Registry](./GAPS.md)
- [Decision Log](./DECISIONS.md)

**Resume Path:**
Read `TRACKER.md` to see the current active task and blocks. If picking up from scratch, verify which data files have been processed by running `node scripts/generateGlossaryIndex.js` and checking the frontend.
