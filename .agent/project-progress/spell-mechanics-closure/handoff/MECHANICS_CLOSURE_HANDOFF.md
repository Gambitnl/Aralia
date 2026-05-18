# Spell Mechanics Closure Handoff

Status: active handoff surface
Last updated: 2026-05-14

This file is the human restart point for the spell mechanics closure goal. The generated reports remain the source for exact counts, but this file records the current phase, last completed batch, in-flight edits, and the next safe action for a new agent.

## Current Goal Text

Complete the Aralia spell mechanics closure phase across all 459 spells.

Use the canonical prose in each reference `.md` as the source of truth, compare it against the structured `.md` fields and runtime `.json`, and close all actionable mechanics buckets discovered during review. For each actionable bucket, update the spell structured template, runtime JSON template/schema expectations, spell `.md` structured fields, runtime JSON files, validation/audit scripts, and reports as needed.

All spells should conform to the eventual template shape. Fields that do not apply must use a schema-safe not-applicable sentinel rather than being omitted where the template expects the field. Existing fields and values may be revised when they flatten, hide, or misrepresent mechanics.

Keep template files heavily commented through machine-readable metadata: every field should explain its purpose, source/prose meaning, runtime mapping, accepted values, and not-applicable behavior where relevant.

Track and close repeat extraction failure patterns at corpus level when feasible. Keep separate buckets for intentionally deferred flavor/descriptive prose, special user questions, PowerShell/runtime environment issues, and JSON formatting drift.

Work by precise mechanic shape. Before editing schema, templates, spell files, or reports for a bucket, classify the remaining actionable rows into tight subfamilies that share the same runtime representation and closure rule. Choose batches that close a meaningful set of rows with one coherent model, while keeping genuinely unique or high-risk rows separate. Do not expand schemas one value at a time when a broader reviewed vocabulary or model is clearly needed for the same mechanic family.

Separate narrow reuse batches from new-model batches. Reuse existing schema/template surfaces when they accurately express the mechanic. When a finding family needs a new model, design the model around the full compatible subfamily first, document what it covers and what it intentionally does not cover, then propagate it across every matching spell in that batch.

Use small reviewable helper scripts for repetitive propagation or report querying when doing so reduces manual error, but keep them explicit: scripts should take concrete spell ids and values, print before/after summaries, and leave generated reports and validation gates as the source of truth.

Use staged verification. During a batch, run targeted fast checks after local edits. At batch end, run the full validation/parity/runtime-template/mechanics/typecheck gate set once, record the exact results, and update the handoff/history/report surfaces.

Pre-empt file ballooning with mandatory between-batch modularization checkpoints. After each mechanics bucket or batch is closed and its gates are run, pause before starting the next bucket and review active scripts, reports, templates, schema/type files, manual-review shards, and handoff files. If any file has become hard to review, risky to edit, conflict-prone, or large enough that adding more behavior would make it worse, modularize it before continuing. Treat this as part of the mechanics-closure workflow, not optional cleanup, and verify behavior/output equivalence after any split.

Maintain a concise restart surface. Keep the handoff focused on current counts, current goal text, latest completed batch, latest gates, active file map, known process constraints, and next safe action. Move detailed older batch evidence into history shards before the handoff becomes hard to review.

Mark the goal complete only after all actionable discovered buckets are closed or intentionally deferred, JSON formatting/schema drift is accounted for, and the validation, parity, runtime-template, mechanics-discovery, and typecheck gates pass cleanly.

## Primary Reports

- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
  - Human grouped index of remaining `actionable_open` findings.
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.json`
  - Machine-readable grouped index for scripts or dashboards.
- `docs/tasks/spells/mechanics-discovery/SPELL_MECHANICS_DISCOVERY_REPORT.md`
  - Full generated mechanics-discovery report.
- `.agent/roadmap-local/spell-validation/spell-mechanics-discovery.json`
  - Machine-readable full discovery report.
- `docs/tasks/spells/mechanics-discovery/buckets/*.md`
  - Per-bucket status reports with open/closed/deferred counts.
- `docs/tasks/spells/mechanics-discovery/manual-review-overrides/*.json`
  - Manual finding decisions. These are the active review/control files.
- `docs/tasks/spells/mechanics-discovery/CONDITIONAL_ENDING_BATCH_PLAN.md`
  - Manual batch plan for the remaining `conditional_ending` rows. Use this instead of one-off row selection while that bucket remains active.
- `docs/tasks/spells/mechanics-discovery/MECHANICS_SUBFAMILY_CLASSIFICATION*.md`
  - Candidate subfamily planning reports generated from open findings. Use these to pick precise shared-shape batches before editing.
- `docs/tasks/spells/mechanics-discovery/refinements/*.md`
  - Human-reviewed refinements of broad classifier groups into closure-ready mechanic shapes. Use these when a classifier label is too mixed for a single schema batch.

## Project File Map

This goal is spread across several file groups. A new agent should treat these as the active project surface, without trying to enumerate every individual spell file in the handoff.

Canonical and structured spell sources:

- `docs/spells/reference/level-*/*.md`
  - One file per spell.
  - Each file contains the structured Aralia field block plus the canonical prose snapshot.
  - The canonical prose snapshot is the source of truth for mechanics; the structured field block is the first machine-actionable extraction layer.

Runtime spell data:

- `public/data/spells/level-*/*.json`
  - One runtime JSON file per spell.
  - These are the files loaded by runtime systems and validated by spell JSON gates.

Templates and schema contracts:

- `docs/tasks/spells/templates/spell-structured-template.json`
  - Machine-readable registry of accepted structured markdown fields.
- `docs/tasks/spells/templates/spell-json-template.json`
  - Machine-readable registry of accepted runtime JSON fields.
- `docs/tasks/spells/templates/parts/structured/*.json`
  - Ordered structured-template shards. Edit these first, then regenerate the aggregate template.
- `docs/tasks/spells/templates/parts/runtime-json/*.json`
  - Ordered runtime-template shards. Edit these first, then regenerate the aggregate template.
- `src/systems/spells/schema/spell.schema.json`
  - Stable aggregate JSON Schema for spell runtime data. Existing tools read this path.
- `src/systems/spells/schema/parts/*.json`
  - Reviewable source shards for the runtime JSON Schema. Edit these first, then regenerate the aggregate schema.
- `src/types/spells.ts`
  - Public TypeScript spell data types used by source code; re-exports split targeting, mode, attack, check, controlled-entity, fall/status, illusion, and protection metadata contracts.
- `src/types/spellCoreMetadata.ts`
  - Core school/rarity/attack metadata split out of `spells.ts` during the post-duration-progression modularization checkpoint.
- `src/types/spellDamageMetadata.ts`
  - Damage type names and descriptions split out of `spells.ts` during the glyph placement/trigger lifetime checkpoint.
- `src/types/spellDurationMetadata.ts`
  - Duration-progression TypeScript contracts for repeated casting, full-concentration permanence, and similar duration-state mechanics.
- `src/types/spellTargeting.ts`
  - Targeting, geometry, scalable count, and target-instance TypeScript types split out during the Druid Grove checkpoint.
- `src/types/spellProtectionMetadata.ts`
  - Protection, prevention, linked-damage, resistance-suppression, and damage-interaction TypeScript types split out during the Death Ward checkpoint.
- `src/types/spellLifecycleMetadata.ts`
  - End-of-spell/effect cleanup and sustain-requirement TypeScript types split out across the Heroism and Crown of Madness checkpoints.
- `src/systems/spells/validation/spellValidator.ts`
  - Zod validator for runtime spell JSON.
- `src/systems/spells/validation/durationProgressionSchemas.ts`
  - Split Zod validator module for runtime duration-progression payloads.
- `src/systems/spells/validation/targetingSchemas.ts`
  - Split Zod validator module for runtime spell targeting.
- `src/systems/spells/validation/effectProtectionSchemas.ts`
  - Split Zod validator module for runtime spell protection, prevention, linked-damage, and damage-interaction payloads.
- `src/systems/spells/validation/effectLifecycleSchemas.ts`
  - Split Zod validator module for runtime end-cleanup and sustain-requirement payloads.

Mechanics discovery and tracking:

- `docs/tasks/spells/mechanics-discovery/SPELL_MECHANICS_DISCOVERY_REPORT.md`
- `.agent/roadmap-local/spell-validation/spell-mechanics-discovery.json`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.json`
- `docs/tasks/spells/mechanics-discovery/buckets/*.md`
- `docs/tasks/spells/mechanics-discovery/CONDITIONAL_ENDING_BATCH_PLAN.md`
- `docs/tasks/spells/mechanics-discovery/manual-review-overrides/*.json`
- `docs/tasks/spells/mechanics-discovery/repeat-patterns.md`

Audit and generation scripts:

- `scripts/auditSpellMechanicsDiscovery.ts`
- `scripts/regenerateActionableSchemaBuckets.ts`
- `scripts/validateSpellJsons.ts`
- `scripts/classifyMechanicsClosureSubfamilies.ts`
- `scripts/auditSpellRuntimeTemplate.ts`
- `scripts/auditSpellStructuredAgainstJson.ts`
- `scripts/splitSpellTemplatePart.ts`
- `scripts/syncSpellTemplateRegistry.ts`
- `scripts/syncSpellJsonSchemaRegistry.ts`

Related validation/reporting surfaces:

- `docs/tasks/spells/SPELL_RUNTIME_TEMPLATE_AUDIT_REPORT.md`
- `.agent/roadmap-local/spell-validation/spell-runtime-template-audit.json`
- `docs/tasks/spells/SPELL_STRUCTURED_VS_JSON_REPORT.md`
- `.agent/roadmap-local/spell-validation/spell-structured-vs-json-report.json`
- `docs/tasks/spells/SPELL_MECHANICS_CONTRACT_AUDIT_REPORT.md`
- `.agent/roadmap-local/spell-validation/spell-mechanics-contract-audit.json`

Environment/process memory:

- `.agent/rules/environment-learnings/codex-desktop-terminal.md`
  - Codex Desktop-specific PowerShell/runtime learnings.
- `AGENTS.md`
  - Repo-level operating rules.
- `.agent/workflows/USER.local.md`
  - User calibration and risk preferences.

## Current Counts

Last confirmed generated counts after created-object cleanup batch 01:

- Actionable open findings: 1235
- Grouped mechanics families: 24
- `choice_or_mode`: 234 total, 128 open, 103 closed, 2 deferred flavor, 1 special question
- `conditional_ending`: 237 total, 54 open, 183 closed
- `aftermath_or_memory`: 56 total, 23 open, 33 closed
- `status_or_state_change`: 171 total, 88 open, 83 closed
- `attack_or_save_modifier`: 303 total, 123 open, 180 closed
- `ward_alarm_or_trigger`: 60 total, 30 open, 29 closed, 1 deferred flavor

Counts came from:

```powershell
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
```

The latest actionable report timestamp after created-object cleanup batch 01 is `2026-05-14T11:42:13.258Z`.

## Last Completed Batch

Created-object cleanup batch 01 closed the narrow spell-end object cleanup shape for Swift Quiver and Magic Jar:

- Added end-cleanup vocabulary:
  - `created_ammunition`
  - `spell_material_container`
  - `created_objects`
  - `spell_component`
  - `disintegrate`
  - `destroy`
- Updated Swift Quiver structured markdown and runtime JSON with spell-end cleanup that disintegrates all ammunition created by the spell.
- Updated Magic Jar structured markdown and runtime JSON with spell-end cleanup that destroys the material container.
- Closed:
  - `swift-quiver::aftermath_or_memory`
  - `magic-jar::aftermath_or_memory`
- Kept `swift-quiver::conditional_ending` open, but narrowed it to the remaining possession-based ending when the quiver leaves the caster's possession.
- Kept Magic Jar's larger soul-return/death/container-destruction ending row open because this batch only closed the spell-end container destruction aftermath.

Validation evidence:

```powershell
npx tsx scripts\syncSpellTemplateRegistry.ts --write-aggregate
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --write-aggregate
npx tsx scripts\validateSpellJsons.ts
npx tsx scripts\syncSpellTemplateRegistry.ts --check
npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check
npx tsx scripts\auditSpellStructuredAgainstJson.ts
npx tsx scripts\auditSpellRuntimeTemplate.ts
npx tsx scripts\validateSpellTemplateContracts.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellLifecycleMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\systems\spells\validation\effectLifecycleSchemas.ts
npx tsx scripts\auditSpellMechanicsDiscovery.ts
npx tsx scripts\regenerateActionableSchemaBuckets.ts
npm run typecheck
```

Results:

- Spell JSON validation: 459 valid, 0 invalid.
- Template registry check: structured aggregate matched 37 parts; runtime JSON aggregate matched 21 parts.
- JSON Schema registry check: aggregate semantically matched 5 parts.
- Structured-vs-JSON parity: 459 compared, 0 mismatches.
- Runtime-template audit: 28 warnings, 0 errors, 2 grouped warning families.
- Template contract validation: 46 issues, matching the known baseline for this phase.
- Dependency sync: `src/types/spellLifecycleMetadata.ts` and `src/systems/spells/validation/effectLifecycleSchemas.ts` updated successfully.
- Typecheck: passed.
- Actionable index: 1235 open findings, 24 grouped mechanics families.
- `aftermath_or_memory`: 56 total findings, 23 open, 33 closed.

Previous completed batch history has been moved to:

- `docs/tasks/spells/mechanics-discovery/MECHANICS_CLOSURE_BATCH_HISTORY.md`

Keep only the latest completed batch in this handoff. Move older batch detail back into the history file when this restart surface grows past the review threshold.

## Latest Modularization Checkpoint

The latest between-batch modularization checkpoint ran after glyph placement/trigger lifetime batch 01 because `src/types/spells.ts` crossed the 1000-line watch point again:

- Moved damage type names, damage type descriptions, and damage type traits out of `src/types/spells.ts` and into `src/types/spellDamageMetadata.ts`.
- Kept the public `spells.ts` re-export surface stable for existing imports of `DamageType`, `DamageTypeDefinitions`, and `DamageTypeTraits`.
- Reduced `src/types/spells.ts` from about 1032 lines to 993 lines.
- Left `src/types/spellDamageMetadata.ts` at 85 lines.
- Older modularization and schema-registry details live in `docs/tasks/spells/mechanics-discovery/batch-history/MECHANICS_CLOSURE_BATCH_HISTORY_PART_05.md`.

Validation evidence:

```powershell
npm run typecheck
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spellDamageMetadata.ts
npx tsx misc\dev_hub\codebase-visualizer\server\index.ts --sync src\types\spells.ts
npm run typecheck
```

Results:

- Typecheck passed before and after dependency header sync.
- Dependency sync completed for `src/types/spellDamageMetadata.ts` and `src/types/spells.ts`.
- `spellValidator.ts` remains close to the watch threshold at 993 lines; consider a validator split before broad validator additions.

## Current In-Flight Batch

No mechanics bucket is currently in flight. The latest completed mechanics batch is created-object cleanup batch 01. Older completed-batch detail lives in `MECHANICS_CLOSURE_BATCH_HISTORY.md` and the `batch-history/` shards.

The current process-iteration checkpoint created a candidate subfamily classifier and generated:

- `docs/tasks/spells/mechanics-discovery/MECHANICS_SUBFAMILY_CLASSIFICATION.md`
- `docs/tasks/spells/mechanics-discovery/MECHANICS_SUBFAMILY_CLASSIFICATION.json`
- `docs/tasks/spells/mechanics-discovery/MECHANICS_SUBFAMILY_CLASSIFICATION-conditional-aftermath.md`
- `docs/tasks/spells/mechanics-discovery/MECHANICS_SUBFAMILY_CLASSIFICATION-conditional-aftermath.json`

The focused `conditional_ending` / `aftermath_or_memory` classification was generated before glyph placement/trigger lifetime batch 01 and created-object cleanup batch 01, so use it as planning context rather than exact current counts. The regenerated authoritative counts are in the Current Counts section above.

The `external_destruction_or_dispel` classifier group was manually refined into smaller closure shapes in:

- `docs/tasks/spells/mechanics-discovery/refinements/EXTERNAL_DESTRUCTION_OR_DISPEL_REFINEMENT.md`

That refinement found the group is mixed. Do not treat all ten rows as one schema batch.

## Next Safe Action

Resume from `docs/tasks/spells/mechanics-discovery/refinements/EXTERNAL_DESTRUCTION_OR_DISPEL_REFINEMENT.md` and choose the next precise subfamily. The safest likely follow-up is **Swift Quiver possession-based ending** as a narrow conditional-ending reuse check:

- `swift-quiver::conditional_ending`

Recommended next decision:

- Confirm the quiver-leaves-possession sentence against canonical `.md` prose and current runtime `.json`.
- Check whether existing `effects[].conditionalEndings[]` trigger `holder_releases_item` accurately covers a quiver leaving the caster's possession, or whether a more precise possession-loss trigger is needed.
- Keep Dispel Magic, Druid Grove, Sequester, spell-linked object destruction/use-count rows, and the already-closed Swift Quiver ammunition cleanup out of that batch unless review proves they share the exact same runtime shape.
- Use fast targeted checks during edits, then the full gate set at batch end.

Before editing another broad schema family, re-check whether `src/types/spells.ts`, `src/systems/spells/validation/spellValidator.ts`, `src/systems/spells/validation/effectLifecycleSchemas.ts`, the schema part files, or the large template JSON files need another focused split. `spell.schema.json` now has a stable shard/aggregate workflow; future JSON Schema edits should happen in `src/systems/spells/schema/parts/*.json` followed by `npx tsx scripts\syncSpellJsonSchemaRegistry.ts --write-aggregate` and `--check`.

## Environment Notes

Use the Codex Desktop-specific learning file for environment issues:

- `.agent/rules/environment-learnings/codex-desktop-terminal.md`

Known active PowerShell constraints:

- Avoid nested `powershell -Command` one-liners with unescaped `$`.
- Avoid quote-heavy `node -e` or `node -p` snippets through nested PowerShell.
- Avoid broad status-token searches across all manual-review shards.
- Use exact finding-id `rg -n -e "spell-id::bucket-id" <directory>` searches.
- If file filtering is needed, prefer `rg -g "level-4*.json" -n -e "pattern" <directory>` over relying on PowerShell native glob expansion.
- Use Node or existing project scripts for JSON writes, not PowerShell `Set-Content -Encoding UTF8`, to avoid BOM risk.

## Modularization Watch

Current watch surfaces after created-object cleanup batch 01:

- `src/types/spells.ts`: 993 lines after splitting damage metadata into `src/types/spellDamageMetadata.ts`.
- `src/types/spellDamageMetadata.ts`: 85 lines.
- `src/types/spellLifecycleMetadata.ts`: 156 lines.
- `src/systems/spells/validation/spellValidator.ts`: 993 lines and still a watch item before broad validator edits.
- `src/systems/spells/validation/effectLifecycleSchemas.ts`: 130 lines.
- `src/systems/spells/schema/parts/20-effect-payloads.json`: 933 lines and still the largest schema source shard.
- `src/systems/spells/schema/parts/30-lifecycle-protection-and-appearance.json`: 831 lines after the end-cleanup batches.
- `scripts/spellRuntimeTemplateAudit/vocabulary.ts`: 669 lines.
- `scripts/classifyMechanicsClosureSubfamilies.ts`: 355 lines.
- `docs/tasks/spells/templates/parts/structured/26-30-effects-ending-fall-cleanup.json`: 618 lines.
- `docs/tasks/spells/templates/parts/runtime-json/08-31-effects-death-cleanup-granted-actions.json`: 534 lines.
- `docs/tasks/spells/mechanics-discovery/MECHANICS_CLOSURE_HANDOFF.md`: 347 lines before this update.
- `docs/tasks/spells/mechanics-discovery/MECHANICS_SUBFAMILY_CLASSIFICATION.md`: 524 lines.
- `docs/tasks/spells/mechanics-discovery/MECHANICS_SUBFAMILY_CLASSIFICATION-conditional-aftermath.md`: 163 lines.

Required between-batch checkpoint:

- Do not split the two template JSON files unless a loader/merge point is added first.
- JSON Schema now has a loader/merge point. Edit `src/systems/spells/schema/parts/*.json` first, regenerate `spell.schema.json`, and run `npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check`.
- Before starting the next mechanics bucket, consider whether another focused modularization is needed in `src/types/spells.ts`, `spellValidator.ts`, the schema part files, large template part files, or manual-review override shards.
- Prefer behavior-preserving splits by responsibility before adding more broad schema families.
- Further split manual-review override shards if a new batch makes them hard to review. The prior oversized `level-2.json`, `level-3-40-59.json`, `level-3-20-39.json`, and `level-3-residual.json` shards have already been split.

## AI Arbitration Boundary

The project already has:

- `arbitrationType`: `mechanical`, `ai_assisted`, `ai_dm`
- `aiContext.prompt`
- `aiContext.playerInputRequired`

Working rule:

- deterministic mechanics should still become structured fields and JSON data
- irreducible/open-ended spell authority should be routed to arbitration rather than forced into brittle schema
- mixed spells may need both ordinary structured mechanics and an arbitration branch

Wish is the key example: listed modes and stress mechanics are structured; the open-ended "state your wish to the DM" branch should be arbitration-aware.
