# Spell Alignment Arbitration Ledger

Last Updated: 2026-04-09

This ledger records spell-alignment mismatches that need arbitration or that were already arbitrated.

## Current Status Note

This file is now best read as the durable arbitration policy surface rather than
the live mismatch counter.

The live active grouped review surfaces are:
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - `418` mismatches across `9` grouped buckets on `2026-04-09`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - `177` mismatches across `7` grouped buckets on `2026-04-09`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_DESCRIPTION_SUBBUCKET_REPORT.md`
  - `51` description mismatches split into `6` review families on `2026-04-09`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_HIGHER_LEVEL_DESCRIPTION_COVERAGE_REPORT.md`
  - `7` analyzed higher-level description mismatches, all currently `represented-elsewhere`

The main reason this ledger still matters is that the remaining spell-truth work
is now mostly grouped review and policy interpretation rather than broad blind sync.

When an arbitration outcome concludes that the current spell model is too weak,
the main implementation surfaces to inspect next are:
- `F:\Repos\Aralia\src\types\spells.ts`
- `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts`
- `F:\Repos\Aralia\scripts\add_spell.js`
- `F:\Repos\Aralia\src\systems\spells\mechanics\ScalingEngine.ts`

The point of this file is not to treat every mismatch as equally urgent. The point is to make sure every mismatch is captured somewhere durable, so repeated patterns can be discovered and handled in grouped passes instead of being rediscovered one spell at a time.

## Working Rule

- record all meaningful mismatches
- group recurring mismatch families where possible
- prioritize larger grouped patterns before isolated one-off mismatches
- do not silently let JSON, markdown, validator, or runtime behavior "win" when the mismatch affects modeling, semantics, or completion claims
- use group keys to spot the same problem across many spells before drilling into isolated cases

## Suggested Statuses

- `open`
- `grouped`
- `arbitrated`
- `accepted-adaptation`
- `fixed`

## Suggested Mismatch Families

- `markdown-vs-json`
- `json-vs-validator`
- `json-vs-phb`
- `runtime-vs-data`
- `workflow-doc-vs-current-schema`

## Record Template

Use one entry per mismatch unless it is clearly part of an already tracked grouped family.

### Required Fields

- `id`
- `status`
- `family`
- `group_key`
- `spell`
- `field_or_mechanic`
- `source_a`
- `source_b`
- `mismatch_summary`
- `why_it_matters`
- `arbitration_needed`
- `resolution`

### Recommended Group-Key Shape

Use:
- `mismatch family / field_or_mechanic`

Examples:
- `markdown-vs-json / effects[].type`
- `json-vs-validator / targeting.validTargets`
- `json-vs-phb / Goodberry healing model`

Guiding principle:
- group by repeated mismatch pattern first
- do not group by spell name first unless the issue is truly unique to that one spell

### Optional Fields

- `notes`
- `links_to_related_entries`
- `phb_reference`
- `runtime_evidence`
- `introduced_by`
- `date_detected`

### Entry Template

- `id`:
- `status`:
- `family`:
- `group_key`:
- `spell`:
- `field_or_mechanic`:
- `source_a`:
- `source_b`:
- `mismatch_summary`:
- `why_it_matters`:
- `arbitration_needed`:
- `resolution`:
- `notes`:

## Current Entries

### Entry 001

- `id`: `spell-align-001`
- `status`: `fixed`
- `family`: `json-vs-validator`
- `group_key`: `json-vs-validator / source`
- `spell`: `all-spells`
- `field_or_mechanic`: `source`
- `source_a`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `source_b`: `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts`
- `mismatch_summary`: `The isolated spell schema validator now runs successfully, and the first repo-wide failure is that the validator requires a top-level source field while the current spell JSON files do not provide one. The current grouped impact is 469 invalid spell files out of 469 scanned.`
- `why_it_matters`: `This blocks honest schema-validation completion for the whole spell dataset and is large enough that it should be handled as one grouped arbitration bucket rather than as hundreds of separate spell fixes. It is also a clean example of why the validator, JSON, and later markdown parity work must be treated as separate implementation layers.`
- `arbitration_needed`: `Yes. The project needs to decide whether source should become a required field in all spell JSON files, whether the validator requirement should be relaxed or made optional, or whether the field should be derived elsewhere instead of stored per spell.`
- `resolution`: `Arbitrated on 2026-03-20: the top-level source field is deprecated and should be removed from the live validator rather than reintroduced into every spell JSON file. The validator was updated accordingly.`
- `notes`: `Detected on 2026-03-20 by the repaired isolated validator path in F:\Repos\Aralia\scripts\validateSpellJsons.ts using npm run validate:spells. After removing the dead source requirement from F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts, npm run validate:spells reported 469 valid / 0 invalid.`

### Entry 002

- `id`: `spell-align-002`
- `status`: `fixed`
- `family`: `markdown-vs-json`
- `group_key`: `markdown-vs-json / Status`
- `spell`: `reference-spell-docs`
- `field_or_mechanic`: `Status`
- `source_a`: `F:\Repos\Aralia\docs\spells\reference\**\*.md`
- `source_b`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `mismatch_summary`: `The spell reference markdown files exposed a structured Status field, usually set to Complete, even though the live spell JSON parity layer contains no matching status field.`
- `why_it_matters`: `Status is workflow/progress metadata rather than spell-truth data. Leaving it in the structured spell fact block mixes project state with spell facts and makes the reference docs look more authoritative than the parity layer can support.`
- `arbitration_needed`: `Resolved on 2026-03-20.`
- `resolution`: `Arbitrated on 2026-03-20: remove Status from the spell reference markdown files entirely rather than keeping it as a structured parity field.`
- `notes`: `Bulk removal was applied across the spell reference markdown set before rerunning the parity collector.`

### Entry 003

- `id`: `spell-align-003`
- `status`: `fixed`
- `family`: `markdown-vs-json`
- `group_key`: `markdown-vs-json / Source`
- `spell`: `reference-spell-docs`
- `field_or_mechanic`: `Source`
- `source_a`: `F:\Repos\Aralia\docs\spells\reference\**\*.md`
- `source_b`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `mismatch_summary`: `The spell reference markdown files exposed a structured Source field, typically a PHB citation like "PHB 2024 p.xxx", even though the live spell JSON parity layer contains no matching source field.`
- `why_it_matters`: `Source citations may still be valuable reference information, but they are not backed by the live spell JSON parity layer. Keeping them in the structured spell fact block makes them look like parity data instead of separate provenance metadata.`
- `arbitration_needed`: `Resolved on 2026-03-20.`
- `resolution`: `Arbitrated on 2026-03-20: remove Source from the spell reference markdown files entirely rather than keeping it as a structured parity field.`
- `notes`: `Bulk removal was applied across the spell reference markdown set before rerunning the parity collector.`

### Entry 004

- `id`: `spell-align-004`
- `status`: `fixed`
- `family`: `markdown-vs-json`
- `group_key`: `markdown-vs-json / Utility Type`
- `spell`: `reference-spell-docs`
- `field_or_mechanic`: `Utility Type`
- `source_a`: `F:\Repos\Aralia\docs\spells\reference\**\*.md`
- `source_b`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `mismatch_summary`: `Many spell reference markdown files omitted Utility Type even though the primary JSON effect was UTILITY and already carried a concrete utilityType value.`
- `why_it_matters`: `UTILITY by itself is too broad to preserve trustworthy spell-reference parity. The subtype carries meaningful structure for human interpretation, parity validation, and later roadmap modeling.`
- `arbitration_needed`: `Resolved on 2026-03-20.`
- `resolution`: `Arbitrated on 2026-03-20: whenever the relevant JSON effect is UTILITY, the spell reference markdown must include Utility Type and mirror the exact JSON utilityType value.`
- `notes`: `Bulk backfill was applied across the spell reference markdown set before rerunning the parity collector.`

### Entry 005

- `id`: `spell-align-005`
- `status`: `fixed`
- `family`: `markdown-vs-json`
- `group_key`: `markdown-vs-json / missing reference body`
- `spell`: `reference-spell-docs`
- `field_or_mechanic`: `missing reference body`
- `source_a`: `F:\Repos\Aralia\docs\spells\reference\**\*.md`
- `source_b`: `F:\Repos\Aralia\public\data\spells\**\*.json`
- `mismatch_summary`: `A subset of spell reference markdown files were zero-byte placeholders rather than real structured spell reference docs. Because those files had no body at all, they generated broad downstream parity failures for fields like Effect Type, Utility Type, Duration, and targeting even when the matching JSON files already contained the necessary data.`
- `why_it_matters`: `Blank reference docs are a parent issue rather than an isolated field mismatch. They prevent honest parity reporting because the collector cannot distinguish between true modeling drift and the absence of any spell reference body at all.`
- `arbitration_needed`: `Resolved on 2026-03-20.`
- `resolution`: `Arbitrated on 2026-03-20: blank or structurally missing spell reference docs may be regenerated directly from verified JSON rather than waiting for manual per-spell rewrites.`
- `notes`: `A dedicated regeneration script was added at F:\Repos\Aralia\scripts\regenerateBlankSpellReferenceDocs.ts and used to rebuild 23 zero-byte spell reference docs. After a clean rerun of npm run validate:spell-markdown, the mismatch surface dropped from 1057 mismatches in 31 grouped buckets to 637 mismatches in 23 grouped buckets.`

### Entry 006

- `id`: `spell-align-006`
- `status`: `fixed`
- `family`: `json-vs-phb`
- `group_key`: `json-vs-phb / classes missing in regenerated batch`
- `spell`: `regenerated-reference-batch`
- `field_or_mechanic`: `classes`
- `source_a`: `F:\Repos\Aralia\public\data\spells\level-3\catnap.json and the regenerated-batch peer files`
- `source_b`: `official D&D Beyond spell pages used in F:\Repos\Aralia\docs\tasks\spells\SPELL_REGENERATED_REFERENCE_OFFICIAL_CHECK.md`
- `mismatch_summary`: `During the official-source verification pass for the 23 regenerated spell reference docs, the local spell JSON files repeatedly exposed empty classes arrays even when the official D&D Beyond spell page clearly listed one or more classes for the same spell.`
- `why_it_matters`: `Class availability is a first-order canonical spell fact. When it is blank in the local JSON, the regenerated markdown reference is structurally present but still not trustworthy as a canon-facing reference. This also distorts any later capability or class-access analysis built on the spell dataset.`
- `arbitration_needed`: `Resolved on 2026-03-23.`
- `resolution`: `Arbitrated on 2026-03-23: local spell JSON should store only default/base class access in classes, while subclass or domain-specific access should be stored separately in a new subClasses field and mirrored in markdown as Sub-Classes. The regenerated 23-spell batch was backfilled using the verified official-source review, and the one legacy spell outside that batch that still embedded a subclass in classes (light) was split to match the new rule.`
- `notes`: `Implemented via F:\Repos\Aralia\scripts\backfillRegeneratedSpellClasses.ts plus validator/parity support updates in F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts and F:\Repos\Aralia\scripts\validateSpellMarkdownParity.ts. After moving the lone legacy subclass entry out of F:\Repos\Aralia\public\data\spells\level-0\light.json, npm run validate:spells returned to a fully green state.`

### Entry 007

- `id`: `spell-align-007`
- `status`: `grouped`
- `family`: `json-vs-phb`
- `group_key`: `json-vs-phb / placeholder top-level defaults in regenerated batch`
- `spell`: `regenerated-reference-batch`
- `field_or_mechanic`: `top-level canonical spell facts`
- `source_a`: `F:\Repos\Aralia\public\data\spells\level-4\guardian-of-nature.json and the regenerated-batch peer files`
- `source_b`: `official D&D Beyond spell pages used in F:\Repos\Aralia\docs\tasks\spells\SPELL_REGENERATED_REFERENCE_OFFICIAL_CHECK.md`
- `mismatch_summary`: `The official-source verification pass surfaced a repeated placeholder-like pattern in part of the regenerated batch: local JSON often uses school Evocation, range distance 0, instantaneous duration, empty classes, flattened material data, and blank descriptions even when the official spell page clearly exposes different canonical top-level facts.`
- `why_it_matters`: `This is not a small markdown drift problem. It means some regenerated docs now accurately mirror local JSON that still appears materially wrong at the canonical top-level spell-fact layer. If the project fixes markdown alone here, it will make the spell-truth surface look cleaner while leaving the underlying implementation data untrustworthy.`
- `arbitration_needed`: `Yes. The project needs to decide whether these spells should now enter a JSON-repair lane that backfills canonical top-level facts from official sources before any further markdown parity polishing is attempted on them.`
- `resolution`: `A first grouped repair pass was applied on 2026-03-23, but the bucket is not fully closed yet. The repair script at F:\Repos\Aralia\scripts\repairRegeneratedTopLevelDefaults.ts updated clearly evidenced top-level facts for find-greater-steed, guardian-of-nature, shadow-of-moil, sickening-radiance, storm-sphere, summon-greater-demon, vitriolic-sphere, banishing-smite, control-winds, galders-speedy-courier, staggering-smite, temporal-shunt, tether-essence, and gravity-sinkhole. The unresolved remainder is now the narrower question of which placeholder-default spells still need more top-level source repair, especially where the report did not give enough exact data to patch safely.`
- `notes`: `The strongest examples called out in F:\Repos\Aralia\docs\tasks\spells\SPELL_REGENERATED_REFERENCE_OFFICIAL_CHECK.md are find-greater-steed, guardian-of-nature, shadow-of-moil, sickening-radiance, storm-sphere, summon-greater-demon, vitriolic-sphere, banishing-smite, and control-winds. A 2026-03-22 follow-up also closed the earlier page-discovery gap for gravity-sinkhole, temporal-shunt, gravity-fissure, and tether-essence using user-approved secondary sources, which further reinforced the same placeholder-default pattern rather than weakening it. After the first grouped repair pass, npm run validate:spells remained green at 469 valid / 0 invalid. The markdown parity counts did not drop because the markdown files were intentionally regenerated to mirror the repaired JSON immediately, so this issue remains a json-vs-phb tracking lane rather than a markdown-parity bucket.`
