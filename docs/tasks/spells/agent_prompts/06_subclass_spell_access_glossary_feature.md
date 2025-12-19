# Agent Prompt 06 - Show Subclass Exceptional Spell Access in Spell Glossary Cards

Repo: `AraliaV4/Aralia`

Goal: In the glossary spell card UI, show which subclasses grant access to a spell that the base class spell list does NOT normally include ("exceptional access"). Only list subclasses that DO grant access (not subclasses that don't).

Prereq reading:
- `docs/tasks/spells/agent_prompts/00_overview_and_execution_order.md`

## Definitions
- "Base class access": spell is in the base class spell list registry (see `src/data/classes/index.ts` spellList arrays).
- "Subclass exceptional access": a subclass grants the spell even though the base class spell list does not include it.

Important: This feature must not rely on `spell.classes` alone, because `spell.classes` may include spells that are actually subclass-only (and we want to detect/represent that difference).

## Tasks

### 1) Identify where subclass spell lists live (or add them)
Investigate whether subclass spell lists exist already in code/data. Search for:
- domain/oath/patron/circle spell lists
- "expanded spell list", "domain spells", "oath spells", "circle spells", "patron spells"

If they do not exist as structured data, create a new structured registry for subclass spell access.

Recommended shape (example):
- `src/data/spell_access/subclassSpellAccess.ts`
  - exports a typed array/map of entries like:
    - baseClassId (e.g. `cleric`)
    - subclassId (stable id)
    - subclassName
    - grantedSpells: string[] (spell ids)
    - rulesNote?: string (optional, for display)

Keep IDs consistent with existing naming conventions (dash/underscore as used elsewhere). If there is a glossary id for the subclass, reuse it.

### 2) Compute "exceptional access" per spell
Create a build-time or runtime-derived index mapping:
- spellId -> list of { baseClassName, subclassName, subclassId, notes? }

Computation rule:
- For each subclass-granted spellId:
  - determine the base class spell list (from `src/data/classes/index.ts`).
  - if spellId is NOT in the base class list, then include it as "exceptional access".

Output options:
- Option A (recommended): generate a public index file:
  - `public/data/spell_access/subclasses.json`
  - and load it in the glossary at runtime.
- Option B: compute at runtime from TS data (simpler but increases bundle/runtime cost).

### 3) Update glossary spell card UI
Update `src/components/Glossary/SpellCardTemplate.tsx` to display a new section, e.g.:
- "Subclass Access" (or "Subclass Spell Access")

Display requirements:
- If no exceptional subclass access exists for the spell, hide the section.
- If present:
  - group by base class (e.g., "Warlock:", "Cleric:", etc)
  - list subclass names under each base class
  - keep it compact (collapse/expand if the list is long)

### 4) Ensure the glossary search can still find it
If you add new data (subclass names) and want them searchable via the glossary search box, ensure they are wired into the search match logic (the glossary list search checks `entry.title`, `entry.aliases`, `entry.tags`).
This can be done by:
- adding alias/tag metadata in the spells index generation, OR
- keeping it in-card only (OK if user did not request search integration).

### 5) Reporting / SSOT consolidation
While implementing, if you discover duplicated logic for "spell access" across multiple files (e.g. class lists in multiple places), write a short report listing:
- which files define spell membership
- which should become the SSOT
- what the consolidation plan is (do not do the consolidation unless requested)

## Fixtures / manual verification
Pick at least 5 known subclass-only spells (from your local rules sources) across multiple classes and confirm:
- the base class list does NOT include the spell
- the subclass registry DOES include it
- the spell card shows the subclass(es) correctly

## Commands
- `npm run validate`
- `npx --no-install tsx scripts/regenerate-manifest.ts`
- `node scripts/generateGlossaryIndex.js`

## Deliverable
- A structured subclass spell access registry (or confirmed existing one) and an index used by the UI.
- Spell glossary cards show "Subclass Access" for spells with exceptional subclass access.
- A rollout plan for adding the rest of subclasses/spells after fixtures are validated, with checkpoints for user review.

