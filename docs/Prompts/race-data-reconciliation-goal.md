# Race Data Reconciliation Goal Prompt

Use this with Codex `/goal` when starting the race data reconciliation project.

```text
/goal Build Aralia's race data reconciliation pipeline without stopping until there is a validated report-driven workflow that compares Aralia's implemented race data against the vendored 5etools race corpus, classifies which race mechanics are already implementable versus unsupported, and produces actionable mechanic buckets for future implementation.

Working directory:
F:\Repos\Aralia

Read first:
- AGENTS.md
- .agent/workflows/USER.local.md
- src/data/races/index.ts
- src/data/races/*.ts
- src/types/character.ts
- src/utils/character/characterUtils.ts
- src/utils/character/characterValidation.ts
- src/utils/character/spellUtils.ts
- src/components/CharacterCreator/hooks/useCharacterAssembly.ts
- public/data/glossary/entries/races/**/*.json
- Any docs related to races, character creation, glossary, data pipelines, or runtime data
- The gitignored vendored 5etools repo/directory recently imported into this workspace. Discover its path locally; do not assume its exact location.

Core intent:
Aralia currently stores mechanical race data mostly in TypeScript files under src/data/races/*.ts. There is also glossary/display race JSON under public/data/glossary/entries/races/**/*.json. A vendored 5etools data repo exists locally and contains race data from many sources in a different structured format.

The long-term goal is not to blindly replace Aralia race data. The goal is to create a reconciliation pipeline that helps Aralia evolve toward validated, runtime-loadable, mechanically legible race data while preserving Aralia-specific implemented scope, reflavors, IDs, descriptions, and future-facing scaffolding.

Important constraints:
- Do not overwrite Aralia race data from 5etools.
- Do not bulk-convert all races as a first move.
- Do not delete or flatten existing race scaffolding, glossary data, lineage structures, visual metadata, or character creator behavior.
- Treat 5etools as a reference corpus, not an authoritative replacement.
- Source references may be missing or stripped, so matching must be confidence-scored and reviewable.
- Some Aralia races are reflavored or custom variants. Preserve that identity.
- Keep changes additive and report-driven unless a small code helper is clearly needed.
- If modifying exported signatures, utils, hooks, or state files, run:
  npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync <path>
- Follow Aralia comment expectations: comments should explain what changed, why, what was preserved, and what remains deferred.

Primary deliverable:
Create a race reconciliation workflow that can be run locally and produces reports/artifacts answering:

1. Which Aralia races exist?
2. Which vendored 5etools race entries are likely matches?
3. Which matches are high-confidence, medium-confidence, low-confidence, reflavored/custom, or unmatched?
4. Which race details/mechanics are already expressible and enforceable by Aralia?
5. Which race details are representable but not currently enforced?
6. Which race details require new mechanic families?
7. Which unsupported mechanics overlap across many races and should be bucketed together for future implementation?
8. Which race details are display/lore-only for now?
9. Which Aralia race data is stale, structurally inconsistent, or missing fields that the pipeline can safely detect without rewriting it?

Suggested artifacts:
Create these or close equivalents if the repo has a better convention:

- docs/reports/race-reconciliation/README.md
  Explains the workflow, what it compares, how to run it, and how to interpret the reports.

- docs/reports/race-reconciliation/aralia-race-inventory.json
  Machine-readable inventory of implemented Aralia race data.

- docs/reports/race-reconciliation/vendor-race-inventory.json
  Machine-readable inventory of vendored 5etools race data.

- docs/reports/race-reconciliation/aralia-to-vendor-crosswalk.json
  Candidate matches with confidence, reasons, and notes.

- docs/reports/race-reconciliation/mechanics-support-report.json
  Per-race and per-trait classification into support buckets.

- docs/reports/race-reconciliation/mechanic-buckets.md
  Human-readable summary of unsupported/repeated mechanics, sorted by implementation leverage.

- docs/reports/race-reconciliation/reconciliation-summary.md
  Human-readable executive summary: what was found, what is safe to implement now, what needs design, and recommended next steps.

If a script is needed, prefer:
- scripts/raceReconciliationInventory.ts
or a similarly named script following repo conventions.

Support bucket taxonomy:
Classify each detected race detail into one of these buckets:

1. already_implementable
   Aralia can currently represent and enforce this mechanic.
   Examples may include:
   - walk speed
   - darkvision range
   - fixed ability bonuses, where still used
   - known racial spells, if already consumed
   - base skill proficiencies, if already consumed
   - race-owned HP/AC/speed fields that current utilities recalculate

2. representable_not_enforced
   Aralia can store or display this data, but gameplay does not fully consume it yet.
   Examples may include:
   - tool proficiencies
   - weapon proficiencies
   - language proficiencies
   - swim/climb/fly speeds if movement does not use them
   - advantage on narrow saves if no roll hook consumes it
   - special rest behavior if rest systems do not consume it

3. needs_mechanic_family
   The mechanic repeats across races but lacks a proper Aralia system.
   Bucket these by reusable family, not one-off trait name.
   Examples:
   - condition_save_advantage
   - damage_resistance
   - limited_use_reaction
   - once_per_rest_spell
   - natural_weapon
   - alternate_movement_mode
   - powerful_build
   - death_prevention
   - reroll_or_luck
   - creature_communication
   - environmental_adaptation
   - shapeshifting_or_disguise
   - innate_teleport
   - choice_of_skill
   - choice_of_resistance
   - choice_of_spellcasting_ability

4. ambiguous_requires_human_mapping
   Matching or behavior is unclear.
   Use this for:
   - reflavored races
   - renamed races
   - edition/source ambiguity
   - stripped source references
   - similar but non-identical trait wording
   - Aralia-specific custom variants

5. display_lore_only
   Useful descriptive material, but not currently intended as gameplay mechanics.

Crosswalk requirements:
For every Aralia race, produce a match record like:

{
  "araliaRaceId": "half_orc",
  "araliaName": "Half-Orc",
  "status": "matched | reflavored | custom | unmatched | ambiguous",
  "vendorCandidates": [
    {
      "vendorName": "Half-Orc",
      "vendorSource": "unknown_or_available_source",
      "vendorPath": "...",
      "confidence": "high | medium | low",
      "reasons": ["name match", "trait overlap", "speed match", "darkvision match"]
    }
  ],
  "notes": "Human-readable explanation."
}

Mechanics report requirements:
For every race trait/detail that can be extracted from Aralia and/or vendor data, produce records like:

{
  "araliaRaceId": "half_orc",
  "traitName": "Relentless Endurance",
  "mechanicKey": "death_prevention.drop_to_1_hp_once",
  "support": "needs_mechanic_family",
  "bucket": "death_prevention",
  "araliaCurrentRepresentation": "trait_text_only",
  "vendorEvidence": "...short summary, not long copyrighted text...",
  "recommendedNextStep": "Define a death-prevention reaction/trigger mechanic."
}

Copyright/source caution:
- Do not copy large 5etools text verbatim into reports.
- Store short identifiers, structural summaries, field names, and brief paraphrases.
- Use file paths and trait names as references.
- If exact wording is needed, keep excerpts minimal.

Implementation strategy:
Work in checkpoints.

Checkpoint 1: Discovery
- Locate the vendored 5etools data.
- Identify the relevant race files/format.
- Inventory Aralia race data files and glossary race files.
- Produce a short discovery note in the summary report.

Checkpoint 2: Aralia inventory
- Extract Aralia race IDs, names, baseRace, traits, abilityBonuses, knownSpells, visual metadata, choice structures, and fields currently present.
- Do not change race data.
- Emit aralia-race-inventory.json.

Checkpoint 3: Vendor inventory
- Extract vendor race names, identifiers, sources if available, speed, senses, traits/entries, spell grants, resistances, proficiencies, choices, and any structured mechanics the vendor format exposes.
- Emit vendor-race-inventory.json.
- Keep extracted wording minimal and summarized.

Checkpoint 4: Crosswalk
- Match Aralia races to vendor candidates using deterministic and fuzzy signals:
  - normalized name
  - known aliases
  - trait name overlap
  - speed/darkvision overlap
  - lineage/subrace relation
  - notes for reflavored/custom variants
- Emit aralia-to-vendor-crosswalk.json.
- Confidence must be explicit. Do not pretend uncertain matches are certain.

Checkpoint 5: Mechanic support classifier
- Build a classifier that maps extracted race details into the support bucket taxonomy.
- Start conservative. If a detail cannot be confidently mapped, mark it ambiguous.
- Produce mechanics-support-report.json.

Checkpoint 6: Overlap buckets
- Aggregate unsupported mechanics by family.
- Count how many Aralia races and vendor candidates mention each family.
- Provide examples and recommended implementation order by leverage.
- Emit mechanic-buckets.md.

Checkpoint 7: Summary and next steps
- Write reconciliation-summary.md explaining:
  - what exists
  - what is matched
  - what is uncertain
  - what Aralia can implement now
  - what mechanic families would unlock the most race traits
  - what should not be automated yet
  - recommended next project prompt for actually migrating to runtime race files

Validation:
At minimum, run:
- npm run typecheck, if TypeScript files were added or changed
- the focused script directly, e.g. npx tsx scripts/raceReconciliationInventory.ts
- any existing relevant tests if touched code has tests
- git diff --check on touched files

If repo-wide typecheck is blocked by unrelated existing issues, report that clearly and run the most focused validation available.

Stopping condition:
Stop only when:
- The workflow can be run locally.
- The Aralia race inventory exists.
- The vendor race inventory exists.
- The crosswalk exists with confidence levels.
- The mechanics support report exists with bucket classifications.
- The mechanic bucket summary exists and identifies overlapping unsupported mechanic families.
- The reconciliation summary explains what was preserved, what remains uncertain, and what the next implementation phase should be.
- Focused validation has passed, or any blockers are clearly documented with exact commands and errors.

Progress reporting:
Keep a compact progress log in docs/reports/race-reconciliation/README.md or reconciliation-summary.md.
At each checkpoint, note:
- completed work
- generated artifacts
- validation run
- uncertainty or blockers
- next checkpoint

Do not expand into implementing all unsupported race mechanics during this goal. The goal is the reconciliation and bucketing pipeline, not the full race mechanics engine.
```
