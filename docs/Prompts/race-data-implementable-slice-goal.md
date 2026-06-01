# Race Data Implementable Slice Goal Prompt

Use this with Codex `/goal` after the initial race reconciliation scaffold exists. This prompt intentionally shifts from "make reports" to "implement everything that is already safely implementable, and leave a clear, honest list of what is not."

```text
/goal Repair and advance Aralia's race reconciliation work by implementing the race mechanics that Aralia can already support today, while producing a clear unresolved list for every race detail that cannot be safely implemented yet.

Working directory:
F:\Repos\Aralia

Read first:
- AGENTS.md
- .agent/workflows/USER.local.md (if present; local-only)
- docs/Prompts/race-data-reconciliation-goal.md
- docs/reports/race-reconciliation/README.md
- docs/reports/race-reconciliation/reconciliation-summary.md
- docs/reports/race-reconciliation/mechanic-buckets.md
- docs/reports/race-reconciliation/mechanics-support-report.json
- docs/reports/race-reconciliation/aralia-race-inventory.json
- docs/reports/race-reconciliation/vendor-race-inventory.json
- docs/reports/race-reconciliation/aralia-to-vendor-crosswalk.json
- scripts/raceReconciliationInventory.ts
- scripts/__tests__/raceReconciliationInventory.test.ts
- src/data/races/*.ts
- src/data/races/index.ts
- src/types/character.ts
- src/utils/character/characterUtils.ts
- src/utils/character/characterValidation.ts
- src/utils/character/spellUtils.ts
- src/components/CharacterCreator/hooks/useCharacterAssembly.ts
- Any combat, movement, rest, spell, saving throw, condition, inventory, and character-sheet code paths that appear to consume race-derived mechanics
- The local vendored 5etools data under vendor/5etools-src, if present

Core intent:
The first reconciliation pass may have produced useful scaffolding, but it may also have classified race mechanics by keyword rather than by actual Aralia engine support. This goal is to make the pipeline useful in practice:

1. Build an explicit capability matrix of race mechanics Aralia actually supports today.
2. Implement or normalize every race detail that can already be represented and enforced safely by existing systems.
3. Produce a clear list of all race details that cannot be implemented yet, bucketed by the missing mechanic family they need.

Important distinction:
"Trait text mentions a mechanic" is not the same as "Aralia implements that mechanic."

Do not mark a detail as implemented unless there is a concrete code path that consumes the structured data during character creation, combat, movement, resting, spell aggregation, validation, or display.

Important constraints:
- Do not bulk overwrite Aralia race files from 5etools.
- Do not migrate every race to a new runtime format in this goal.
- Do not implement new broad mechanic engines unless one is truly tiny, already scaffolded, and necessary to safely support many existing race fields.
- Prefer using existing Aralia fields and utilities first.
- Preserve Aralia-specific names, IDs, descriptions, reflavors, visual metadata, and future-facing scaffolding.
- Treat 5etools as a reference/cross-check corpus, not the source of truth.
- Keep changes additive and narrow.
- Do not hide unsupported mechanics by leaving them as vague trait text only. If they cannot be implemented, list them clearly.
- If modifying exported signatures, utils, hooks, or state files, run:
  npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync <path>
- Follow Aralia code-commentary expectations: comments should explain what changed, why, what was preserved, and what remains deferred.

Primary deliverable:
Create an implementable race-mechanics slice that:

1. Documents what Aralia can enforce today.
2. Updates race data or normalization logic for every already-supported race mechanic that can be safely structured now.
3. Regenerates reconciliation reports with classifications based on the capability matrix.
4. Produces an unresolved mechanics report listing everything that could not be implemented yet, grouped by missing mechanic family and implementation leverage.

Required new or revised artifacts:

- docs/reports/race-reconciliation/aralia-mechanic-capability-matrix.json
  Machine-readable list of race mechanic families and whether Aralia enforces, represents, displays, or does not support them.

- docs/reports/race-reconciliation/aralia-mechanic-capability-matrix.md
  Human-readable explanation of supported and unsupported race mechanic families, with exact code references for support claims.

- docs/reports/race-reconciliation/implemented-race-mechanics.md
  List of race details implemented or normalized during this goal, with file paths and validation notes.

- docs/reports/race-reconciliation/unresolved-race-mechanics.md
  Clear list of all race details that could not be implemented yet, grouped by missing mechanic family.

- docs/reports/race-reconciliation/reconciliation-quality-notes.md
  Notes on false positives or weak classifications from the previous reconciliation pass, including examples and how they were corrected.

- revised docs/reports/race-reconciliation/mechanics-support-report.json
  Must include capability-backed classifications, confidence, and code references where applicable.

- revised docs/reports/race-reconciliation/mechanic-buckets.md
  Must separate "implemented now", "represented only", and "blocked by missing mechanic family".

Capability matrix requirements:
For each mechanic family, include:

{
  "mechanicFamily": "walk_speed",
  "supportStatus": "enforced | represented_only | display_only | unsupported | ambiguous",
  "dataFields": ["speed", "race.traits"],
  "enforcementPaths": ["src/utils/character/characterUtils.ts:..."],
  "displayPaths": ["src/components/CharacterSheet/..."],
  "limitations": ["Only walk speed is enforced; swim/fly/climb are not."],
  "exampleRaceIds": ["human", "wood_elf"],
  "confidence": "high | medium | low"
}

Do not use line ranges in final user-facing summaries, but report artifacts may include file paths and function names.

Likely already-supported or partially-supported mechanics to investigate first:
- fixed/flexible ability bonuses
- walk speed
- darkvision
- canonical race rehydration for premades/saved characters
- known racial spells
- racial spell aggregation
- spellcasting ability selections for racial spells
- selected race choices stored in racialSelections
- fixed skill proficiencies, if character assembly consumes them
- race-owned HP adjustments, if currently enforced
- armor class recalculation from race/ability changes, if currently enforced
- visual metadata/display fields
- validation of missing required race choices

Likely not fully supported yet; verify before marking:
- damage resistance
- condition-specific saving throw advantage
- death prevention reactions
- natural weapons
- alternate movement modes such as fly/swim/climb/burrow
- tool, weapon, and language proficiencies
- powerful build/carrying capacity
- limited-use reactions
- race-owned rerolls/luck
- innate teleport actions
- shapeshifting/disguise mechanics
- special rest behavior
- creature communication
- environmental adaptations not consumed by travel/rest/survival systems

Implementation strategy:
Work in checkpoints.

Checkpoint 1: Audit the previous reconciliation output
- Identify obvious bad classifications.
- Specifically inspect suspicious cases such as Breath Weapon being classified as weapon_proficiency.
- Write initial notes in reconciliation-quality-notes.md.

Checkpoint 2: Build the Aralia capability matrix
- Inspect actual code paths, not just trait text.
- For each mechanic family, record support status and code references.
- Do not proceed to broad implementation until this matrix exists.

Checkpoint 3: Identify the implementable slice
- From the capability matrix and race inventories, find every race detail that can be safely implemented with existing fields/utilities.
- Prefer existing patterns over new abstractions.
- Produce a short planned implementation list in implemented-race-mechanics.md before editing race data or utilities.

Checkpoint 4: Implement safe supported mechanics
- Implement only mechanics that existing systems can consume.
- Examples of acceptable work:
  - ensure premade/saved character normalization uses canonical race data
  - ensure speed/darkvision derive from canonical race data where that is already supported
  - move safe structured fields into existing Race fields if they are already consumed
  - add validation for missing required race choices if the validation system already supports it
  - add tests proving existing systems consume the structured data
- Do not convert unsupported trait text into fake "implemented" fields.

Checkpoint 5: Produce the unresolved list
- For every race detail not implemented, list:
  - race ID
  - trait/detail name
  - current representation
  - why it could not be implemented
  - missing mechanic family
  - suggested engine/system owner
  - examples of other races needing the same family
- Sort by mechanic family and leverage.

Checkpoint 6: Repair the reconciliation classifier
- Update scripts/raceReconciliationInventory.ts so classifications are based on the capability matrix.
- Every "already_implementable" or "implemented" classification must cite support from the capability matrix.
- Keyword matching may suggest a bucket, but cannot prove support.
- Add tests for at least:
  - Breath Weapon is not classified as weapon proficiency.
  - Darkvision or walk speed can be classified as implemented only because the capability matrix says they are enforced.
  - Unsupported traits are bucketed into unresolved mechanic families.

Checkpoint 7: Regenerate reports and summarize
- Regenerate all race reconciliation reports.
- Update README.md with the corrected interpretation.
- Update reconciliation-summary.md with:
  - what was actually implemented
  - what remains unresolved
  - which previous classifications were corrected
  - next recommended implementation family

Validation:
At minimum, run:
- npx vitest run scripts/__tests__/raceReconciliationInventory.test.ts
- npx tsx scripts/raceReconciliationInventory.ts
- npm run typecheck, if TypeScript files changed
- relevant focused tests for any touched character/race utilities
- git diff --check on touched files

If repo-wide typecheck is blocked by unrelated existing issues, report that clearly and run the most focused validation available.

Stopping condition:
Stop only when:
- The capability matrix exists and cites concrete Aralia code paths.
- The implementable slice has been implemented or explicitly deemed empty with evidence.
- implemented-race-mechanics.md lists what changed and why it is safe.
- unresolved-race-mechanics.md clearly lists what could not be implemented yet.
- The reconciliation classifier no longer treats keyword matches as proof of implementation.
- The reports distinguish:
  1. enforced now,
  2. represented but not enforced,
  3. display/lore only,
  4. blocked by missing mechanic family,
  5. ambiguous/manual review.
- Focused validation passes, or blockers are documented with exact commands and errors.

Do not stop at "reports were generated" if the classifications are still not useful for implementation. The point is to get everything currently implementable implemented, and to make the rest unmistakably visible.
```
