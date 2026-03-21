# Guide: Adding a New Character Race to Aralia RPG

Last Updated: 2026-03-11
Purpose: Describe the current end-to-end race-addition workflow across race data, NPC support, and glossary coverage.

## Current Core Surfaces

Verified anchors in this pass:
- src/data/races/index.ts
- src/data/races/raceGroups.ts
- src/data/names/raceNames.ts
- src/data/names/physicalTraits.ts
- public/data/glossary/entries/races/
- public/data/glossary/index/character_races.json
- scripts/generateGlossaryIndex.js

## Part 1: Character Creator And Data Integration

### Step 1: Add The Race Data File

Create the new race file under src/data/races/.

Important current-state correction:
- src/data/races/index.ts now auto-discovers race files with import.meta.glob
- that means the old manual import-and-register step is no longer the default path

### Step 2: Decide Whether Group Metadata Needs A Change

Only update src/data/races/raceGroups.ts when the new race needs:
- a new parent accordion grouping
- new comparison-trait metadata
- new umbrella description text

If the race fits inside an existing family, a race-group change may not be needed.

### Step 3: Add NPC Generation Support If Needed

If the race should appear in NPC generation flows, update:
- src/data/names/raceNames.ts
- src/data/names/physicalTraits.ts

Those are still the verified anchors for generated names and physical-trait constraints.

## Part 2: Glossary Coverage

Important current-state correction:
- race glossary entries are JSON files under public/data/glossary/entries/races/
- this guide no longer assumes markdown race glossary entries
- grouped race index output lives at public/data/glossary/index/character_races.json
- glossary generation is driven through scripts/generateGlossaryIndex.js

If the race should be glossary-visible, add or update the JSON entry first, then regenerate indexes.

## Practical Checklist

- [ ] Add the race data file under src/data/races/
- [ ] Confirm the export shape matches nearby race files
- [ ] Update raceGroups.ts only if a new parent grouping or comparison surface is required
- [ ] Update raceNames.ts if NPC generation should support the race
- [ ] Update physicalTraits.ts if NPC generation should support the race
- [ ] Add glossary JSON coverage under public/data/glossary/entries/races/ if needed
- [ ] Regenerate glossary indexes through scripts/generateGlossaryIndex.js
- [ ] Verify the race appears correctly in the character-creator flow you actually touched

## Common Drift To Avoid

Do not assume:
- that race registration still requires a manual import in src/data/races/index.ts
- that every race must create a new race-group entry
- that glossary race entries are markdown files
- that character_races.json should be treated as hand-authored source of truth before checking the generator output
