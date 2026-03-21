# Race Addition Guide (Developer)

Last Updated: 2026-03-11
Purpose: Describe the current race-addition workflow based on the repo as it exists now.

## Current Shape Of The Race Lane

Adding a race still touches several surfaces, but one major part of the workflow changed:
- src/data/races/index.ts now auto-discovers race files with import.meta.glob
- that means new race data files no longer need a manual import added to the main race index

Verified supporting surfaces in this pass:
- src/data/races/index.ts
- src/data/races/raceGroups.ts
- src/data/names/raceNames.ts
- src/data/names/physicalTraits.ts
- public/data/glossary/entries/races/
- scripts/generateGlossaryIndex.js

## Step 1: Add The Race Data File

Create a new race file under src/data/races/.

The practical rule is:
- export a real Race object
- make sure it carries the fields the current race lane expects
- keep the file in the same pattern as nearby race files so auto-discovery can pick it up cleanly

Because index.ts now auto-discovers race files, this is the core registration step.

## Step 2: Decide Whether A Race Group Update Is Needed

Not every new race needs a new race-group entry.

Only update src/data/races/raceGroups.ts when you are adding:
- a new parent grouping used by the character-creator accordion surface
- a new umbrella group description or comparison-trait surface

If the race belongs inside an existing family, the group metadata may not need any change.

## Step 3: Update NPC Generation Support

If the new race should participate in NPC generation, update both of these:
- src/data/names/raceNames.ts
- src/data/names/physicalTraits.ts

Those files still act as current anchors for generated names and physical-trait constraints.

## Step 4: Add Glossary Coverage

If the race should be discoverable in the glossary, add a glossary entry JSON under public/data/glossary/entries/races/.

Use the current glossary JSON-entry pattern from docs/guides/@GLOSSARY-CONTRIBUTOR-GUIDE.md.

Important current-state correction:
- this repo does not currently expose a package script called glossary:index in package.json
- the glossary index generation logic exists in scripts/generateGlossaryIndex.js
- if glossary indexes need regeneration, use the actual script surface rather than an assumed package wrapper

## Practical Checklist

- [ ] Add the race data file under src/data/races/
- [ ] Confirm the export shape matches nearby race files
- [ ] Update src/data/races/raceGroups.ts only if a new parent group or accordion grouping is required
- [ ] Update src/data/names/raceNames.ts if NPC generation should support the race
- [ ] Update src/data/names/physicalTraits.ts if NPC generation should support the race
- [ ] Add a glossary entry under public/data/glossary/entries/races/ if the race should be glossary-visible
- [ ] Regenerate glossary indexes through the real script surface if needed
- [ ] Verify the race appears cleanly in the character-creator flow you actually touched

## Common Drift To Avoid

Do not assume:
- that index.ts still needs a manual import registration step
- that every new race requires a new race-group entry
- that a package command named glossary:index exists
- that older file-URL links in earlier versions of this guide are still the right reference form
