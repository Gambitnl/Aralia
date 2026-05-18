# Race Reconciliation Summary
## Discovery Note
- Aralia race source: src/data/races/*.ts loaded through scripts/load-race-data.ts.
- Glossary race display source: public/data/glossary/entries/races/**/*.json.
- Vendored 5etools race corpus: vendor/5etools-src/data/races.json.
- Foundry supplement considered when present: vendor/5etools-src/data/foundry-races.json.
## What Exists
- Aralia selectable race records inventoried: 106.
- Vendor race/subrace/foundry records inventoried: 266.
- Mechanics report records generated: 1445.
## Crosswalk Status
- ambiguous: 22
- matched: 72
- reflavored: 12
## Mechanic Support Status
- ambiguous_requires_human_mapping: 375
- blocked_by_missing_mechanic_family: 362
- display_lore_only: 369
- enforced_now: 303
- represented_not_enforced: 36
## Highest-Leverage Unsupported Buckets
- damage_resistance: 99 records
- condition_save_advantage: 41 records
- environmental_adaptation: 36 records
- powerful_build: 30 records
- breath_weapon: 22 records
- limited_use_reaction: 20 records
- creature_communication: 20 records
- natural_weapon: 18 records
- skill_proficiency: 18 records
- reroll_or_luck: 17 records
- choice_of_skill: 14 records
- alternate_movement_mode: 10 records
## Preserved Intent
- No Aralia race TypeScript files were overwritten.
- No glossary race JSON files were rewritten.
- Aralia-specific IDs, reflavors, baseRace groupings, visual metadata, descriptions, and current trait text remain the reviewed source of truth.
- 5etools data is used only as a local reference corpus with confidence-scored matches.
## Uncertainty And Human Review
- Medium/low confidence candidates remain ambiguous in the crosswalk.
- Custom or reflavored Aralia IDs are marked as custom/reflavored instead of being forced onto vendor identities.
- Source references in vendor data may be missing or may differ by edition/source; review before migration.
- Vendor trait evidence is summarized by field and trait names to avoid copying large text.
## Structural Warnings Detected
- aarakocra: has both legacy imageUrl and visual metadata
- half_elf_aquatic: has both legacy imageUrl and visual metadata
- astral_elf: has both legacy imageUrl and visual metadata
- bugbear: has both legacy imageUrl and visual metadata
- centaur: has both legacy imageUrl and visual metadata
- changeling: has both legacy imageUrl and visual metadata
- deep_gnome: has both legacy imageUrl and visual metadata
- drow: has both legacy imageUrl and visual metadata
- half_elf_drow: has both legacy imageUrl and visual metadata
- forest_gnome: has both legacy imageUrl and visual metadata
- duergar: has both legacy imageUrl and visual metadata
- half_elf: has both legacy imageUrl and visual metadata
- halfling: has both legacy imageUrl and visual metadata
- hearthkeeper_halfling: has both legacy imageUrl and visual metadata
- high_elf: has both legacy imageUrl and visual metadata
- half_elf_high: has both legacy imageUrl and visual metadata
- hill_dwarf: has both legacy imageUrl and visual metadata
- kenku: has both legacy imageUrl and visual metadata
- lightfoot_halfling: has both legacy imageUrl and visual metadata
- lotusden_halfling: has both legacy imageUrl and visual metadata
- mender_halfling: has both legacy imageUrl and visual metadata
- mountain_dwarf: has both legacy imageUrl and visual metadata
- pallid_elf: has both legacy imageUrl and visual metadata
- rock_gnome: has both legacy imageUrl and visual metadata
- runeward_dwarf: has both legacy imageUrl and visual metadata
- sea_elf: has both legacy imageUrl and visual metadata
- seersight_half_elf: has both legacy imageUrl and visual metadata
- shadar_kai: has both legacy imageUrl and visual metadata
- shadowveil_elf: has both legacy imageUrl and visual metadata
- stormborn_half_elf: has both legacy imageUrl and visual metadata
- stout_halfling: has both legacy imageUrl and visual metadata
- tabaxi: has both legacy imageUrl and visual metadata
- triton: has both legacy imageUrl and visual metadata
- wood_elf: has both legacy imageUrl and visual metadata
- half_elf_wood: has both legacy imageUrl and visual metadata
- wordweaver_gnome: has both legacy imageUrl and visual metadata
## Recommended Next Project Prompt
Create the first missing mechanic family from docs/reports/race-reconciliation/unresolved-race-mechanics.md, starting with damage_resistance or breath_weapon. Preserve existing TypeScript race data as the behavioral baseline, add validators that compare new structured data against current Race records, and do not migrate custom/reflavored races until their mappings are manually approved.
## Progress Log
- Checkpoint 1 Discovery: located Aralia race TypeScript files, glossary race JSON, existing race sync scripts, and vendor/5etools-src/data/races.json.
- Checkpoint 2 Aralia inventory: generated aralia-race-inventory.json without changing race data.
- Checkpoint 3 Vendor inventory: generated vendor-race-inventory.json with structural summaries and minimal text.
- Checkpoint 4 Crosswalk: generated confidence-scored aralia-to-vendor-crosswalk.json.
- Checkpoint 5 Mechanic support classifier: generated capability-backed mechanics-support-report.json.
- Checkpoint 6 Overlap buckets: generated mechanic-buckets.md and unresolved-race-mechanics.md sorted by implementation family.
- Checkpoint 7 Summary and next steps: generated this summary with preserved intent, uncertainty, and next prompt.
## Completion Audit - 2026-05-10
- Required artifacts present: aralia-mechanic-capability-matrix.json, aralia-mechanic-capability-matrix.md, implemented-race-mechanics.md, unresolved-race-mechanics.md, reconciliation-quality-notes.md, mechanics-support-report.json, and mechanic-buckets.md.
- Capability matrix audit: 27 mechanic-family rows; support statuses include enforced, represented_only, display_only, unsupported, and ambiguous; every enforced row cites at least one concrete enforcement path.
- Mechanics report audit: 1445 records; support statuses include enforced_now, represented_not_enforced, display_lore_only, blocked_by_missing_mechanic_family, and ambiguous_requires_human_mapping; enforced_now and blocked_by_missing_mechanic_family records all carry capability-backed classifications.
- Implementation decision: no race source files were bulk overwritten or migrated. The safe implementable slice for this goal is classifier/report normalization around mechanics already consumed by Aralia fields and utilities; unsupported trait text remains visible in unresolved-race-mechanics.md instead of being converted into fake runtime data.
- Spot checks after regeneration: astral_elf / Astral Trance and beastborn_human / Skillful are unresolved; centaur / Natural Affinity remains enforced through the hardcoded race skill-selection path; black_dragonborn / Breath Weapon is unresolved under breath_weapon.
- Fresh validation commands: npx tsx scripts/raceReconciliationInventory.ts exited 0; npx vitest run scripts/__tests__/raceReconciliationInventory.test.ts passed 10/10; npm run typecheck exited 0; npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync scripts/raceReconciliationInventory.ts exited 0 and reported the script is excluded; git diff --check on the touched race reconciliation files exited 0.
- Worktree note: the repository has many unrelated pre-existing edits outside this race reconciliation slice. This audit only validates scripts/raceReconciliationInventory.ts, scripts/__tests__/raceReconciliationInventory.test.ts, and docs/reports/race-reconciliation.
